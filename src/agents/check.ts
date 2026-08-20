#!/usr/bin/env bun
//! `View.check` (@packages/interfaces/agents.ts) — SÓ o que `~/.me/agents.json` sozinho
//! consegue provar: nenhum nome lembrado aponta pro MESMO pane que outro.
//!
//!     my agents check
//!     my agents check --json | --jsonl | --tsv
//!
//! SEPARADO de `list.ts` DE PROPÓSITO, e não por gosto de arquivo pequeno: TODO
//! módulo de `src/herdr/` que este sistema toca (`agents/list.ts`, `agents/roster.ts`
//! — e por tabela `clone.ts`, que os importa) carrega um `if (import.meta.main) {
//! … await … }` no rodapé, e Bun marca como ASSÍNCRONO qualquer módulo que
//! IMPORTE ESTATICAMENTE um módulo assim — mesmo dentro de um `if` que nunca roda
//! ao ser importado. `src/shared/house.ts` descobre `check()` com `require()`
//! SÍNCRONO; contra um módulo assim ele recebe `TypeError: require() async module
//! … is unsupported` (medido 20/08), engolido pelo `try/catch` de `checkDe` como
//! "não declara check". `list.ts` importa herdr estaticamente porque `all()`
//! PRECISA dele; `check()` não precisa de herdr NENHUM (só do arquivo em disco), e
//! por isso só ele podia ficar limpo o bastante pra ser achado.
//!
//! Reconciliar contra o herdr de verdade (nome que já não resolve pra pane nenhum)
//! é `roster()` — async, chama herdr — e por isso não pode ser ISTO. Ver o
//! parágrafo ASYNC AND ENVELOPED em `agents.ts`.
//!
//! depends_on: —
//! impacts:    src/shared/house.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { store } from '../home/paths.ts'
import { emit } from '../shared/findings.ts'
import type { Finding } from '@biliboss/interfaces/agents.ts'

const ROSTER_STORE = () => store('agents')

export function check(): Finding[] {
  let raw: Record<string, { pane: string }>
  try {
    raw = JSON.parse(readFileSync(ROSTER_STORE(), 'utf8'))
  } catch {
    // Arquivo ausente e corrompido contam a mesma história: nenhum agente
    // lembrado, logo nenhuma colisão possível.
    return []
  }
  const byPane = new Map<string, string[]>()
  for (const [name, entry] of Object.entries(raw)) {
    const list = byPane.get(entry.pane) ?? []
    list.push(name)
    byPane.set(entry.pane, list)
  }
  const findings: Finding[] = []
  for (const [pane, names] of byPane) {
    if (names.length > 1) findings.push({ path: ROSTER_STORE(), says: `${names.join(', ')} apontam todos pro mesmo pane ${pane}` })
  }
  return findings
}

export function main(argv: string[]): number {
  const achados = check()
  return emit<Finding>(argv, {
    findings: achados,
    cols: (f) => [f.path, f.says],
    human: () => {
      for (const f of achados) console.log(`${f.path}\n  ${f.says}`)
      console.log(achados.length ? `\n${achados.length} achado(s)` : 'nada torto')
    },
  })
}

if (import.meta.main) process.exit(main(process.argv.slice(2)))
