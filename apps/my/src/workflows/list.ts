#!/usr/bin/env bun
//! As categorias, ou os workflows de uma delas.
//!
//!     my workflows list                as categorias, com quantos workflows cada uma tem
//!     my workflows list 00_product     os workflows daquela categoria, com a descrição
//!     my workflows list product        o número é a ordem, e ordem muda — dá no mesmo
//!     my workflows list --json | --jsonl | --tsv
//!
//! A LARGURA SAI DO CONTEÚDO, nunca de um número escrito à mão. `padEnd(20)` e
//! `padEnd(26)` eram os dois valores daqui, e os dois estouraram com nome que já existe
//! no disco (medido 19/08):
//!
//!     05_acme-corretor1                        ← 20 chars + a contagem, colados
//!     01_territorial_intelligenceCarteira própria… ← 26 chars + a descrição
//!
//! Coluna colada não é feiura: quem lê por coluna — `awk`, `cut`, ou o olho — soma o
//! nome com o dado. É o defeito que @src/shared/gh.ts nomeia como a razão de existir o
//! `--tsv`, e é por isso que os quatro formatos entram junto com o conserto: alinhar
//! resolve pro humano, e `--tsv` resolve pra quem vier depois.
//!
//! depends_on: src/workflows/tree.ts · src/shared/findings.ts
//! impacts:    src/cli/my.ts

import { emit } from "@my/shared/findings"
import { categories, category, summary, workflows } from './tree.ts'

/** A coluna cabe no MAIOR nome, mais dois de respiro. Lista vazia devolve 0 — sem o
 *  guarda, `Math.max()` de nada é `-Infinity` e o `padEnd` some com a linha. */
const width = (names: string[]): number => (names.length ? Math.max(...names.map((n) => n.length)) + 2 : 0)

export function main(argv: string[]): number {
  const [arg] = argv.filter((a) => !a.startsWith('--'))

  if (!arg) {
    const rows = categories().map((c) => ({ categoria: c, workflows: workflows(c).length }))
    const w = width(rows.map((r) => r.categoria))
    // LISTAR NÃO É ACHADO: o exit do `emit` diz "encontrei coisas", que num check é 1.
    // Aqui encontrar é o trabalho — o exit fica 0, e o 1 se reserva pra categoria que
    // não existe, logo abaixo.
    emit(argv, {
      json: { categorias: rows.length },
      findings: rows,
      cols: (r) => [r.categoria, r.workflows],
      human: () => {
        for (const r of rows) console.log(`${r.categoria.padEnd(w)}${r.workflows}`)
      },
    })
    return 0
  }

  const found = category(arg)
  if (!found) {
    // O erro CARREGA a saída: quem errou o nome não precisa de um segundo comando.
    console.error(`nenhuma categoria chamada "${arg}". As que existem:\n`)
    for (const c of categories()) console.error(`  ${c}`)
    console.error(`\num workflow se abre com \`my workflows show ${arg}\``)
    return 1
  }

  const rows = workflows(found).map((w) => ({ workflow: w, resumo: summary(found, w) }))
  const w = width(rows.map((r) => r.workflow))
  emit(argv, {
    json: { categoria: found, workflows: rows.length },
    findings: rows,
    cols: (r) => [r.workflow, r.resumo],
    human: () => {
      for (const r of rows) console.log(`${r.workflow.padEnd(w)}${r.resumo}`)
    },
  })
  return 0
}

if (import.meta.main) process.exit(main(process.argv.slice(2)))
