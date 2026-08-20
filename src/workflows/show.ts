#!/usr/bin/env bun
//! O `CONTEXT.md` de um workflow, inteiro.
//!
//!     my workflows show do_a_drip
//!     my workflows show 004_do_a_drip     com ou sem o número, dá no mesmo
//!
//! Verbatim, nunca resumo: o `CONTEXT.md` é o contrato do workflow, e resumir
//! contrato é escrever um segundo contrato que ninguém assinou.
//!
//! depends_on: src/workflows/tree.ts
//! impacts:    src/cli/my.ts

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WORKFLOWS, body, categories, find, workflows } from './tree.ts'

export function main(argv: string[]): number {
  const [arg] = argv
  if (!arg) {
    console.error('usage: my workflows show <nome>')
    return 2
  }

  const hit = find(arg)
  if (hit) {
    console.log(body(hit.category, hit.workflow))
    return 0
  }

  // Uma FAMÍLIA também tem contrato, e `03_agents` não tem filho nenhum: ela É a
  // folha. Sem esta passada, `show 03_agents` caía no erro com o mapa — e o mapa
  // listava `03_agents` como categoria existente, que é a pior forma de falhar.
  const family = categories().find((c) => c === arg || c.replace(/^\d+_/, '') === arg.replace(/^\d+_/, ''))
  if (family && existsSync(join(WORKFLOWS, family, 'CONTEXT.md'))) {
    console.log(readFileSync(join(WORKFLOWS, family, 'CONTEXT.md'), 'utf8').trimEnd())
    return 0
  }

  // O erro CARREGA o mapa: quem errou o nome não precisa de um segundo comando.
  console.error(`nenhum workflow chamado "${arg}". As categorias:\n`)
  for (const c of categories()) console.error(`  ${c}\n    ${workflows(c).join('  ')}`)
  return 1
}

if (import.meta.main) process.exit(main(process.argv.slice(2)))
