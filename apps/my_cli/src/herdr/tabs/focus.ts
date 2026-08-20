//! Traz uma aba pra frente: `bun run src/herdr/tabs/focus.ts w3K:t2`.
//!
//! Cercado por herança: `w3K:t2` nomeia o workspace dele, então bloquear `w3K`
//! bloqueia isto sem uma segunda chamada e sem um segundo lugar pra esquecer.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts
//! impacts:    src/herdr/tabs/CONTEXT.md

import { did } from '../run.ts'
import { fence } from '../policy.ts'
import { upstream, type Fail } from '../../shared/result.ts'

export async function focus(id: string): Promise<{ ok: true; id: string } | Fail> {
  const fenced = fence(id)
  if (fenced) return fenced

  const out = await did(['tab', 'focus', id])
  return out.ok ? { ok: true, id } : upstream(out.error ?? 'herdr failed')
}

if (import.meta.main) {
  const out = await focus(Bun.argv[2] ?? '')
  console.log(out.ok ? out.id : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
