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

import { result } from '../run.ts'
import { fence } from '../policy.ts'
import { upstream, type Fail } from '../../shared/result.ts'
import { has, value } from '../../shared/argv.ts'

export async function split(
  pane: string,
  opts: { direction?: 'right' | 'down'; ratio?: number; cwd?: string; focus?: boolean } = {},
): Promise<{ ok: true; pane: string } | Fail> {
  const fenced = fence(pane)
  if (fenced) return fenced

  const args = ['pane', 'split', pane, '--direction', opts.direction ?? 'right']
  if (opts.ratio) args.push('--ratio', String(opts.ratio))
  if (opts.cwd) args.push('--cwd', opts.cwd)
  args.push(opts.focus ? '--focus' : '--no-focus')

  const out = await result(args)
  if (!out.ok) return upstream(out.error)

  const id = out.result?.pane?.pane_id ?? out.result?.new_pane?.pane_id ?? out.result?.pane_id
  if (!id) return upstream(`herdr split the pane but returned no id: ${JSON.stringify(out.result).slice(0, 200)}`)
  return { ok: true, pane: id }
}

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
