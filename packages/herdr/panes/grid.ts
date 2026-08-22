import type { Fail } from "@my/shared/result"
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

