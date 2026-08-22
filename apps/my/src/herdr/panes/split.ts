#!/usr/bin/env bun
//! Parte um pane em dois, e imprime o id do NOVO.
//!
//!     bun run src/herdr/panes/split.ts w3K:p2            ao lado (duas colunas)
//!     bun run src/herdr/panes/split.ts w3K:p2 --down     empilhado
//!
//! `right` é o padrão porque duas colunas é o único layout em que dois agentes
//! ficam legíveis lado a lado — que é o caso de uso que pediu este verbo
//! (@02_areas/00_workflows/04_experimental/00_compare/CONTEXT.md).
//!
//! `--no-focus` sempre que não pedirem foco: partir é SETUP, e setup que rouba a
//! tela deixa uma sequência scriptada impossível de acompanhar enquanto roda.
//!
//! Cercado: partir um pane muda a tela de quem está olhando pra ela.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts · src/shared/argv.ts · 02_areas/00_workflows/04_experimental/00_compare/CONTEXT.md
//! impacts:    02_areas/00_workflows/04_experimental/00_compare/CONTEXT.md · src/herdr/agents/cli.ts · src/herdr/panes/grid.ts

import { split } from "@my/herdr/panes/split";
import { has, value } from "@my/shared/argv";

if (import.meta.main) {
  const pane = Bun.argv[2]
  if (!pane) {
    console.error('usage: split.ts <pane-id> [--down] [--ratio 0.5] [--cwd <path>]')
    process.exit(2)
  }
  const ratio = value('ratio')
  const out = await split(pane, {
    direction: has('down') ? 'down' : 'right',
    ratio: ratio === undefined ? undefined : Number(ratio),
    cwd: value('cwd'),
  })
  console.log(out.ok ? out.pane : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
