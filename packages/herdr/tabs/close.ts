import { did } from '../run.ts'
import { fence } from '../policy.ts'
import { upstream, type Fail } from "@biliboss/shared/result"

export async function close(id: string): Promise<{ ok: true; closed: string } | Fail> {
  const fenced = fence(id)
  if (fenced) return fenced

  const out = await did(['tab', 'close', id])
  return out.ok ? { ok: true, closed: id } : upstream(out.error ?? 'herdr failed')
}

