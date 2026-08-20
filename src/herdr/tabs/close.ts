//! Fecha uma aba: `bun run src/herdr/tabs/close.ts w3K:t2`. É a chamada que faz a herança da cerca valer a pena — sem ela, um workspace bloqueado se esvazia uma aba por vez.
//!
//! Cercado por herança: `w3K:t2` nomeia o workspace dele, então bloquear `w3K`
//! bloqueia isto sem uma segunda chamada e sem um segundo lugar pra esquecer.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts
//! impacts:    src/herdr/tabs/CONTEXT.md

import { did } from '../run.ts'
import { fence } from '../policy.ts'
import { upstream, type Fail } from '../../shared/result.ts'

export async function close(id: string): Promise<{ ok: true; closed: string } | Fail> {
  const fenced = fence(id)
  if (fenced) return fenced

  const out = await did(['tab', 'close', id])
  return out.ok ? { ok: true, closed: id } : upstream(out.error ?? 'herdr failed')
}

if (import.meta.main) {
  const out = await close(Bun.argv[2] ?? '')
  console.log(out.ok ? out.closed : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
