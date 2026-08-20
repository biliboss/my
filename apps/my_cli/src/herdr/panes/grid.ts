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

import type { Fail } from '../../shared/result.ts'
import { split } from './split.ts'

export async function grid(
  root: string,
  count: number,
  cwd: string,
): Promise<{ ok: true; panes: string[] } | Fail> {
  if (count <= 1) return { ok: true, panes: [root] }

  const cols = Math.ceil(Math.sqrt(count))
  // Quantos panes cada coluna leva. `count` raramente fecha a grade — 3 em 2
  // colunas é 2+1 — e distribuir o resto nas primeiras é o que mantém as colunas
  // com altura parecida.
  const tall = count % cols
  const height = (c: number) => Math.floor(count / cols) + (c < tall ? 1 : 0)

  // As cabeças de coluna, partindo pra DIREITA. O `ratio` encolhe conforme as
  // colunas nascem: partir sempre no meio deixaria a última com metade da tela.
  const heads = [root]
  for (let c = 1; c < cols; c++) {
    const out = await split(heads[c - 1]!, { direction: 'right', ratio: 1 / (cols - c + 1), cwd })
    if (!out.ok) return out
    heads.push(out.pane)
  }

  const columns: string[][] = []
  for (const [c, head] of heads.entries()) {
    const column = [head]
    for (let r = 1; r < height(c); r++) {
      const out = await split(column[r - 1]!, { direction: 'down', ratio: 1 / (height(c) - r + 1), cwd })
      if (!out.ok) return out
      column.push(out.pane)
    }
    columns.push(column)
  }

  return { ok: true, panes: columns.flat() }
}

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
