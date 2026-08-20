//! One log channel, zero dependencies.
//!
//! The extension host has no stdout to tail, so a silent failure is invisible.
//! `createOutputChannel(name, { log: true })` is the editor's own logger — levels,
//! timestamps and a filter in the UI — which is everything a wrapper would add.
//!
//! `vscode` is loaded LAZILY, and the import above is type-only. `disk/commits.ts`
//! and `gh/api.ts` are loaded by `node --test` outside the extension host (they
//! `require('../out/...')` directly), where `vscode` does not resolve — with a
//! static import, merely IMPORTING this file to log a warning would have broken
//! both suites at load. The console fallback exists for exactly that context, and
//! nowhere else.

import type * as vscode from 'vscode'

let channel: vscode.LogOutputChannel | undefined

/** Created on first use: touching the vscode API before activation throws. */
export function log(): vscode.LogOutputChannel {
  channel ??= open()
  return channel
}

function open(): vscode.LogOutputChannel {
  try {
    return (require('vscode') as typeof import('vscode')).window.createOutputChannel('my', { log: true })
  } catch {
    // No host, so no channel and no UI to filter it: stderr is the only place left,
    // and a test that trips a warning should still say so.
    const write = (level: string) => (message: string, ...rest: unknown[]) => console.error(`[my ${level}]`, message, ...rest)
    return {
      name: 'my',
      logLevel: 1,
      onDidChangeLogLevel: (() => ({ dispose() {} })) as never,
      trace: write('trace'),
      debug: write('debug'),
      info: write('info'),
      warn: write('warn'),
      error: write('error'),
      append: write('info'),
      appendLine: write('info'),
      replace: write('info'),
      clear() {},
      show() {},
      hide() {},
      dispose() {},
    } as unknown as vscode.LogOutputChannel
  }
}

/** Why a subprocess failed, in one line — the CAUSE, never just "it failed".
 *
 *  A missing binary and an expired `gh auth` both end as an empty list, and a
 *  sidebar that renders the same nothing for both teaches nothing: `gh` not on the
 *  PATH is a five-second install, `gh auth status` is a different fix, and no
 *  network is neither. The exit code and the process's own stderr are the whole
 *  diagnosis, which is why they belong in the line.
 *
 *  Three callers (`disk/prs.ts`, `disk/commits.ts`, `gh/api.ts`) format the same
 *  thing, which is the only reason this is a function and not three template
 *  strings. stderr is capped at three lines: a `git log` with a bad revision
 *  prints a usage screen, and a log entry nobody scrolls past is a log entry
 *  nobody reads. */
export function whyFailed(failure: unknown): string {
  const e = failure as { code?: string; status?: number | null; signal?: string | null; stderr?: Buffer | string } | null
  if (e?.code === 'ENOENT') return 'not on the PATH'
  const stderr = e?.stderr ? String(e.stderr).trim().split('\n').slice(0, 3).join(' · ') : ''
  // A signal is not an exit code, and `status` is null when one arrives. Seen for real:
  // a `git log` killed as a dangling process printed `Command failed: git log …`, which
  // reads like git rejected the revision when nothing of the sort happened.
  if (e?.signal) return `killed by ${e.signal}${stderr ? `: ${stderr}` : ''}`
  if (typeof e?.status === 'number') return `exit ${e.status}${stderr ? `: ${stderr}` : ''}`
  if (stderr) return stderr
  return failure instanceof Error ? failure.message : String(failure)
}
