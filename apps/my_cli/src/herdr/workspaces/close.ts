//! Closing a workspace — one, or every one that is not fenced.
//!
//!     bun run src/workspaces/close.ts cockpit
//!     bun run src/workspaces/close.ts --all
//!
//! This is the destructive verb of the house, and `block` is the ONLY thing
//! standing between a workspace and `--all`. That is the whole point of the
//! fence, and the reason it is worth putting up before a session that might
//! sweep.
//!
//! Hidden ones close too: hiding is a listing filter, not protection.
//!
//! The marks are dropped AFTER the close, or a recycled id would inherit a
//! fence set for a workspace that no longer exists.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts · src/herdr/workspaces/list.ts · src/shared/argv.ts
//! impacts:    src/herdr/workspaces/CONTEXT.md

import { did } from '../run.ts'
import { blockedReason, fence, forget } from '../policy.ts'
import { upstream, type Fail } from '../../shared/result.ts'
import { list } from './list.ts'
import { resolve } from './resolve.ts'
import { has } from '../../shared/argv.ts'

const inHerdr = (id: string) => did(['workspace', 'close', id])

export async function close(key: string): Promise<{ ok: true; id: string; label: string } | Fail> {
  const found = await resolve(key)
  if (!found.ok) return found

  const { id, label } = found.workspace
  const fenced = fence(id)
  if (fenced) return fenced

  const out = await inHerdr(id)
  if (!out.ok) return upstream(out.error ?? 'herdr failed')

  forget(id)
  return { ok: true, id, label }
}

export type Sweep = {
  ok: boolean
  closed: { id: string; label: string }[]
  failed: { id: string; label: string; error: string }[]
  kept: { id: string; label: string; reason?: string }[]
}

/**
 *  Close everything except what is blocked.
 *
 *  SEQUENTIAL and not `Promise.all`: herdr renumbers workspaces as they close,
 *  and eight concurrent closes against a shifting list is how the wrong pane dies.
 */
export async function closeAll(): Promise<Sweep | Fail> {
  const listed = await list({ includeHidden: true })
  if (!listed.ok) return listed

  const sweep: Sweep = {
    ok: true,
    closed: [],
    failed: [],
    kept: listed.workspaces
      .filter((w) => blockedReason(w.id))
      .map((w) => ({ id: w.id, label: w.label, reason: w.blocked?.reason })),
  }

  for (const { id, label } of listed.workspaces.filter((w) => !blockedReason(w.id))) {
    const out = await inHerdr(id)
    if (out.ok) {
      forget(id)
      sweep.closed.push({ id, label })
    } else {
      sweep.failed.push({ id, label, error: out.error ?? 'herdr failed' })
    }
  }

  sweep.ok = sweep.failed.length === 0
  return sweep
}

if (import.meta.main) {
  const out = has('all') ? await closeAll() : await close(Bun.argv[2] ?? '')
  console.log(JSON.stringify(out, null, 2))
  process.exit(out.ok ? 0 : 1)
}
