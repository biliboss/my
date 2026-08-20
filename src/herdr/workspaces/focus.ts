//! Traz um workspace pra frente.
//!
//!     bun run src/herdr/workspaces/focus.ts cockpit
//!
//! CERCADO, apesar de não mudar nada em disco: `block` quer dizer deixa esse em
//! paz, e arrancar a tela de alguém pra um workspace que ele cercou É tocar nele.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts · src/herdr/workspaces/resolve.ts
//! impacts:    src/herdr/workspaces/CONTEXT.md

import { did } from '../run.ts'
import { fence } from '../policy.ts'
import { upstream, type Fail } from '../../shared/result.ts'
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

if (import.meta.main) {
  const out = await focus(Bun.argv[2] ?? '')
  console.log(out.ok ? out.id : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
