//! O que os subverbos de `my gh` compartilham: o flag, o formato, a impressão.
//!
//! Primitiva com DOIS chamadores desde o primeiro dia (`issues.ts` e `prs.ts`) —
//! é a regra desta pasta, e não uma aposta de que um dia terá.
//!
//! Os QUATRO FORMATOS são regra da casa, não deste verbo: `--tsv` e `--jsonl` na
//! LINHA que alguém vai filtrar, `--json` inteiro pro `jq`, e sem flag alinhado
//! pro humano. Comando que só fala com humano obriga o próximo a reparsear texto
//! alinhado, e alinhamento muda.
//!
//! impacts: src/gh/issues.ts · src/gh/prs.ts · src/shared/findings.ts

export type Fmt = 'human' | 'json' | 'jsonl' | 'tsv'

export function fmtOf(argv: string[]): Fmt {
  if (argv.includes('--json')) return 'json'
  if (argv.includes('--jsonl')) return 'jsonl'
  if (argv.includes('--tsv')) return 'tsv'
  return 'human'
}

/** O valor de um flag `--nome valor`. Devolve `undefined` quando não veio, pra
 *  quem chama decidir se aquilo era obrigatório. */
export function flag(argv: string[], nome: string): string | undefined {
  const i = argv.indexOf(nome)
  return i >= 0 ? argv[i + 1] : undefined
}

/** TSV sem cabeçalho: cabeçalho é linha que todo consumidor tem que pular, e
 *  quem pula errado soma o texto como dado. As colunas ficam na docstring. */
const tsv = (cols: (string | number | undefined)[]) =>
  cols.map((c) => String(c ?? '').replace(/\t|\n/g, ' ')).join('\t')

export function out<T>(fmt: Fmt, rows: T[], cols: (r: T) => (string | number | undefined)[], human: (r: T) => string): void {
  if (fmt === 'json') return console.log(JSON.stringify(rows, null, 2))
  for (const r of rows)
    console.log(fmt === 'tsv' ? tsv(cols(r)) : fmt === 'jsonl' ? JSON.stringify(r) : human(r))
}
