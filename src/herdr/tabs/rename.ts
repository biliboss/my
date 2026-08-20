//! Renomeia uma aba: `bun run src/herdr/tabs/rename.ts w3K:t2 revisao`.
//!
//! Cercado por herança: `w3K:t2` nomeia o workspace dele, então bloquear `w3K`
//! bloqueia isto sem uma segunda chamada e sem um segundo lugar pra esquecer.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts
//! impacts:    src/herdr/tabs/CONTEXT.md

import { did } from '../run.ts'
import { fence } from '../policy.ts'
import { upstream, type Fail } from '../../shared/result.ts'

export async function rename(id: string, label: string): Promise<{ ok: true; id: string; label: string } | Fail> {
  const fenced = fence(id)
  if (fenced) return fenced

  const out = await did(['tab', 'rename', id, label])
  return out.ok ? { ok: true, id, label } : upstream(out.error ?? 'herdr failed')
}

if (import.meta.main) {
  const [id, label] = Bun.argv.slice(2)
  if (!id || !label) {
    console.error('usage: rename.ts <tab-id> <label>')
    process.exit(2)
  }
  const out = await rename(id, label)
  console.log(out.ok ? `${out.id} → ${out.label}` : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
