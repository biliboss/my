import { did } from '../run.ts'
import { fence } from '../policy.ts'
import { upstream, type Fail } from "@biliboss/shared/result"
import { resolve } from './resolve.ts'

export async function focus(key: string): Promise<{ ok: true; id: string } | Fail> {
  const found = await resolve(key)
  if (!found.ok) return found

  const { id } = found.workspace
  const fenced = fence(id)
  if (fenced) return fenced

  const out = await did(['workspace', 'focus', id])
  return out.ok ? { ok: true, id } : upstream(out.error ?? 'herdr failed')
}

