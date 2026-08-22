//! QUAIS PANES DAQUI SÃO ESPELHO DE OUTRA CAIXA, e se o fio ainda está de pé.
//!
//!     bun run src/herdr/panes/mirrors.ts                  # os espelhos, com o estado
//!     bun run src/herdr/panes/mirrors.ts w3D:p1           # ESTE pane remoto tem espelho?
//!     bun run src/herdr/panes/mirrors.ts --json
//!
//! O ESTADO VEM DO PROCESSO, NÃO DE UM REGISTRO NOSSO. `herdr pane process-info`
//! devolve o argv vivo do pane, e o espelho aparece ali literalmente —
//! `herdr-mirror pane fonseca-vps w3D:p1`. Guardar um `mirrors.json` ao lado
//! seria um segundo registro do mesmo fato, e o dia em que o ssh cai sem ninguém
//! avisar é justamente o dia em que os dois discordam.
//!
//! `LIVE` EXIGE OS DOIS PROCESSOS. O `herdr-mirror` sozinho é o supervisor: ele
//! continua no pane depois que o `ssh` morre, e um pane com a última tela
//! congelada é indistinguível de um pane que ninguém tocou. Por isso `DEAD` não
//! é ausência do espelho — é o espelho presente com o transporte caído.
//!
//! E `DEAD` É INSTANTÂNEO, NÃO CRÔNICO. Medido 22/08: matando o `ssh` de um
//! espelho, a leitura imediata sai `DEAD` (exit 1) e a de três segundos depois
//! sai `live` de novo, com PID novo — o supervisor reconecta sozinho. Então um
//! `DEAD` isolado é uma reconexão em curso; o que significa problema é o mesmo
//! pane saindo `DEAD` em leituras seguidas.
//!
//! SEMPRE LOCAL. Espelho é uma coisa DAQUI, então este verbo ignora
//! `MY_HERDR_HOST`: perguntar "quem está espelhado" pra caixa de lá responde
//! outra pergunta com cara de resposta. Quem quiser o inverso pergunta de lá.
//!
//! Sai 1 quando um espelho existe e está `dead`, e 0 quando todos vivos — assim
//! um script consegue reagir sem reparsear texto.
//!
//! depends_on: src/herdr/run.ts · src/shared/argv.ts
//! impacts:    src/herdr/panes/mirror.ts · src/herdr/panes/CONTEXT.md

import { result } from '../run.ts'
import { upstream, type Fail } from '../../shared/result.ts'
import { has } from '../../shared/argv.ts'

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

if (import.meta.main) {
  const alvo = Bun.argv.slice(2).find((a) => !a.startsWith('-'))
  const out = await mirrors()
  if (!out.ok) {
    console.error(`✗ ${out.error}`)
    process.exit(1)
  }

  // Um pane remoto como argumento vira FILTRO, e a ausência dele é resposta:
  // "não está espelhado" é o que alguém pergunta antes de espelhar.
  const rows = alvo ? out.mirrors.filter((m) => m.remote === alvo || `${m.host}:${m.remote}` === alvo) : out.mirrors

  if (has('json')) console.log(JSON.stringify(rows, null, 2))
  else if (!rows.length) console.log(alvo ? `${alvo} NÃO tem espelho nesta caixa` : 'nenhum espelho nesta caixa')
  else for (const m of rows) console.log(`${m.pane}\t${m.host}\t${m.remote}\t${m.live ? 'live' : 'DEAD'}`)

  process.exit(rows.some((m) => !m.live) ? 1 : 0)
}
