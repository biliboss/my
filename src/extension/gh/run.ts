//! The ONE place the EXTENSION shells out to `gh` — same policy as
//! `src/gh/run.ts`, different runtime.
//!
//! Two runners and not one, and this is the boundary, not drift: `src/gh/run.ts`
//! uses `Bun.spawn`, and this half of the house is deliberately Bun-free — it runs
//! in the VS Code extension host, compiled by `tsc`, where `Bun` does not exist.
//! Importing the other file here would break the extension at load. So the POLICY
//! is copied on purpose and the two headers point at each other; what must never
//! drift is the three rules below.
//!
//! 1. **A timeout, always** — 15 000 ms, the number measured in `src/gh/run.ts`
//!    (eight calls, 0.34 s–0.63 s, 19/08). It kills a hung `gh`, it does not police
//!    latency.
//! 2. **Retry on 5xx**, three attempts, 1 s · 2 s. The GitHub 503 measured on 17/08
//!    reached the tree through two paths that had no protection at all.
//! 3. **Never throws** — `{ ok: false, error }`, one shape to branch on.
//!
//! SYNC and ASYNC both exist because the two call sites are shaped differently, and
//! neither shape is negotiable: `disk/prs.ts` is called from the tree's synchronous
//! render, and `api.ts` is already a promise. Making the tree async would cascade
//! through `prsFor` into every row.
//!
//! depends_on: src/gh/run.ts
//! impacts:    src/extension/gh/api.ts · src/extension/disk/prs.ts
//!
//! A dependência acima é de POLÍTICA, não de import: este arquivo nunca importa
//! aquele, e não pode. A prosa desce pra cá porque o campo é lista de PATH — uma
//! nota entre parênteses na própria linha vira caminho quebrado pro `citations`.

import { execFile, execFileSync } from 'node:child_process'
import { whyFailed } from '../log.js'

/** Measured in `src/gh/run.ts` — see that header for the samples. */
export const GH_TIMEOUT_MS = 15_000
export const GH_RETRIES = 3

export type GhResult = { ok: true; stdout: string } | { ok: false; error: string }

/** GitHub's own 5xx and a call that hung. NOT 4xx: a 404 answers the same three
 *  times, and retrying it only makes the user wait to read the same message. */
const RETRIABLE = /HTTP 5\d\d|timeout|timed out|ETIMEDOUT/i

function sleepSync(ms: number): void {
  // No `await` available on the tree's synchronous path, and this only runs after a
  // failure that is about to be retried — at most 1 s + 2 s, twice in a process.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

export function ghSync(
  args: string[],
  { timeoutMs = GH_TIMEOUT_MS, retries = GH_RETRIES }: { timeoutMs?: number; retries?: number } = {},
): GhResult {
  let last = 'gh never ran'
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // stderr PIPED, never ignored: it is the whole diagnosis, and it is what the
      // caller logs. `gh` prints "gh auth login" on an expired token.
      const stdout = execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeoutMs,
        maxBuffer: 5 * 1024 * 1024,
      })
      return { ok: true, stdout }
    } catch (failure) {
      last = whyFailed(failure)
      // A TIMEOUT IS NOT RETRIED HERE, and only here. `whyFailed` names a killed child
      // `killed by SIGTERM`, which `RETRIABLE` deliberately does not match: this runs on
      // the tree's synchronous render, so three hung calls would block the extension
      // HOST for 45 s — a frozen editor, not a slow sidebar. One 15 s ceiling and an
      // empty PR line is the honest trade; the async path above still retries, because
      // there nothing is blocked. A 5xx still retries on both.
      if (!RETRIABLE.test(last) || attempt === retries - 1) return { ok: false, error: last }
      sleepSync(1000 * (attempt + 1))
    }
  }
  return { ok: false, error: last }
}

export async function ghAsync(
  args: string[],
  { timeoutMs = GH_TIMEOUT_MS, retries = GH_RETRIES }: { timeoutMs?: number; retries?: number } = {},
): Promise<GhResult> {
  let last = 'gh never ran'
  for (let attempt = 0; attempt < retries; attempt++) {
    const attemptResult = await new Promise<GhResult>((resolve) => {
      execFile('gh', args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (!error) return resolve({ ok: true, stdout })
        // `gh` puts the useful message on stderr; the Error's own text is
        // "Command failed", which says nothing.
        resolve({ ok: false, error: stderr.trim() || whyFailed(error) })
      })
    })
    if (attemptResult.ok) return attemptResult

    last = attemptResult.error
    if (!RETRIABLE.test(last) || attempt === retries - 1) return attemptResult
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
  }
  return { ok: false, error: last }
}
