import { envelopeError, run } from '../run.ts'
import { upstream, type Fail } from "@biliboss/shared/result"
import { value } from "@biliboss/shared/argv"

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

