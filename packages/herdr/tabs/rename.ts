import { did } from '../run.ts'
import { fence } from '../policy.ts'
import { upstream, type Fail } from "@my/shared/result"

export async function rename(id: string, label: string): Promise<{ ok: true; id: string; label: string } | Fail> {
  const fenced = fence(id)
  if (fenced) return fenced

  const out = await did(['tab', 'rename', id, label])
  return out.ok ? { ok: true, id, label } : upstream(out.error ?? 'herdr failed')
}

