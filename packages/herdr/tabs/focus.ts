import { did } from '../run.ts'
import { fence } from '../policy.ts'
import { upstream, type Fail } from "@my/shared/result"

export async function focus(id: string): Promise<{ ok: true; id: string } | Fail> {
  const fenced = fence(id)
  if (fenced) return fenced

  const out = await did(['tab', 'focus', id])
  return out.ok ? { ok: true, id } : upstream(out.error ?? 'herdr failed')
}

