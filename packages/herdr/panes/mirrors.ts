import { result } from '../run.ts'
import { upstream, type Fail } from "@my/shared/result"
import { has } from "@my/shared/argv"

export type Mirror = {
  /** O pane DAQUI que mostra a tela de lá. */
  pane: string
  host: string
  /** O pane NA OUTRA CAIXA. Mesmo formato, outra máquina — ids são por host. */
  remote: string
  /** O `ssh` que carrega a tela ainda está de pé? */
  live: boolean
}

/** Roda com `MY_HERDR_HOST` fora do caminho e devolve o ambiente como estava —
 *  mesma razão do `mirror.ts`: este verbo é sobre ESTA caixa. */
async function local<T>(fn: () => Promise<T>): Promise<T> {
  const saved = process.env.MY_HERDR_HOST
  delete process.env.MY_HERDR_HOST
  try {
    return await fn()
  } finally {
    if (saved !== undefined) process.env.MY_HERDR_HOST = saved
  }
}

export async function mirrors(): Promise<{ ok: true; mirrors: Mirror[] } | Fail> {
  return local(async () => {
    const panes = await result(['pane', 'list'])
    if (!panes.ok) return upstream(panes.error)

    const ids: string[] = (panes.result?.panes ?? []).map((p: { pane_id: string }) => p.pane_id).filter(Boolean)

    // Em PARALELO: são N+1 chamadas ao herdr e elas não dependem uma da outra.
    // Em série, um pane travado atrasaria a leitura de todos os outros.
    const found = await Promise.all(
      ids.map(async (pane): Promise<Mirror | undefined> => {
        const info = await result(['pane', 'process-info', '--pane', pane])
        if (!info.ok) return undefined
        const procs: { argv?: string[]; name?: string }[] = info.result?.process_info?.foreground_processes ?? []

        const mir = procs.find((p) => p.name === 'herdr-mirror' || p.argv?.[0]?.endsWith('herdr-mirror'))
        if (!mir?.argv) return undefined

        // `herdr-mirror pane <host> <pane> …` — a posição é o contrato do
        // binário, então lemos DEPOIS do literal `pane` em vez de contar
        // índices a partir do zero: um flag novo antes dele quebraria a contagem.
        const i = mir.argv.indexOf('pane')
        const host = i > -1 ? mir.argv[i + 1] : undefined
        const remote = i > -1 ? mir.argv[i + 2] : undefined
        if (!host || !remote) return undefined

        return { pane, host, remote, live: procs.some((p) => p.name === 'ssh') }
      }),
    )

    return { ok: true as const, mirrors: found.filter((m): m is Mirror => m !== undefined) }
  })
}

