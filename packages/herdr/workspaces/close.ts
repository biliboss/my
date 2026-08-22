import { did } from '../run.ts'
import { blockedReason, fence, forget } from '../policy.ts'
import { upstream, type Fail } from "@biliboss/shared/result"
import { list } from './list.ts'
import { resolve } from './resolve.ts'
import { has } from "@biliboss/shared/argv"

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

