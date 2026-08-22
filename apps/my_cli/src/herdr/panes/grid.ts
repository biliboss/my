#!/usr/bin/env bun
//! Uma grade de panes na MESMA aba, a partir do pane raiz.
//!
//!     bun run src/herdr/panes/grid.ts w3K:p1 4
//!
//! Colunas primeiro (`right`), depois as linhas de cada coluna (`down`). Foi a
//! única forma que deu layout legível pra N > 2: partir sempre o ÚLTIMO pane
//! alternando direção monta uma escada, e com quatro agentes ninguém lê escada.
//!
//! A ordem de volta é a ordem de LEITURA — esquerda pra direita, de cima pra
//! baixo — e é ela que casa com a ordem em que quem chamou nomeou os lados.
//!
//! Subiu de `00_compare/run.ts` pra cá em 17/08 quando ganhou o SEGUNDO chamador
//! (`01_review_loop`), que é a regra de `src/CONTEXT.md`: primitiva com dois
//! chamadores, nunca com um.
//!
//! depends_on: src/herdr/panes/split.ts · 02_areas/00_workflows/04_experimental/01_review_loop/CONTEXT.md
//! impacts:    02_areas/00_workflows/04_experimental/00_compare/run.ts · 02_areas/00_workflows/04_experimental/01_review_loop/run.ts

import { grid } from "@biliboss/herdr/panes/grid";

if (import.meta.main) {
  const [root, count] = Bun.argv.slice(2)
  if (!root || !count) {
    console.error('usage: grid.ts <root-pane> <count>')
    process.exit(2)
  }
  const out = await grid(root, Number(count), process.cwd())
  console.log(out.ok ? out.panes.join(' ') : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
