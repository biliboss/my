//! O que o pane está mostrando.
//!
//!     bun run src/herdr/panes/read.ts w3K:p2
//!     bun run src/herdr/panes/read.ts w3K:p2 --lines 40
//!
//! NÃO cercado, de propósito: ler não muda nada, e um workspace bloqueado é
//! exatamente aquele que alguém quer acompanhar sem tocar.
//!
//! Texto puro, e por isso NÃO passa pelo `result()`: esta saída é saída de
//! terminal, não envelope. Embrulhar num campo de string só põe uma camada de
//! escape entre quem chama e o que ele veio ler.
//!
//! depends_on: src/herdr/run.ts · src/shared/argv.ts
//! impacts:    src/herdr/panes/CONTEXT.md

import { envelopeError, run } from '../run.ts'
import { upstream, type Fail } from '../../shared/result.ts'
import { value } from '../../shared/argv.ts'

export async function read(
  pane: string,
  opts: { lines?: number; source?: string } = {},
): Promise<{ ok: true; text: string } | Fail> {
  const args = ['pane', 'read', pane]
  if (opts.lines) args.push('--lines', String(opts.lines))
  // Medido em 17/08: `--lines N` contra a fonte padrão (`recent`) imprime NADA e
  // sai 0 — leitura vazia silenciosa, com cara de pane morto. Só funciona com
  // snapshot explícito, então pedir contagem de linhas assume `visible` a menos
  // que quem chama diga outra coisa.
  const source = opts.source ?? (opts.lines ? 'visible' : undefined)
  if (source) args.push('--source', source)

  const out = await run(args)
  if (!out.ok) return upstream(envelopeError(out.error ?? '') ?? out.error ?? 'herdr failed')

  const failure = envelopeError(out.stdout)
  return failure ? upstream(failure) : { ok: true, text: out.stdout }
}

if (import.meta.main) {
  const lines = value('lines')
  const out = await read(Bun.argv[2] ?? '', { lines: lines === undefined ? undefined : Number(lines) })
  if (!out.ok) {
    console.error(`✗ ${out.error}`)
    process.exit(1)
  }
  process.stdout.write(out.text)
}
