#!/usr/bin/env bun
//! A FILA em movimento: uma linha por MUDANÇA de estado de task, pra sempre.
//!
//!     my tasks monitor                      o projeto inteiro, todas as sprints
//!     my tasks monitor -P auto-system       outro projeto
//!     my tasks monitor -S 999               uma sprint só
//!     my tasks monitor -S 999,998,997       várias, por prefixo
//!     my tasks monitor --once               o retrato de agora, e sai
//!     my tasks monitor --jsonl              uma linha JSON por evento, pro worker
//!
//! O `list` responde "o que existe"; este responde "o que MUDOU desde a última
//! vez", que é a pergunta de quem espera trabalho aparecer. A saída é uma linha
//! por evento e nada mais — é o contrato da Monitor tool e do `while read` de um
//! worker: linha que chega é trabalho que mudou de mão.
//!
//! O estado vem do disco a cada tique, e o disco JÁ É a verdade (`state:` do
//! `output.md`, `done/` e `backlog/` como pasta). Sem banco, sem fila paralela:
//! `agent_tasks/` morreu em 19/08 por reinventar o que `my tasks` já tinha, e um
//! monitor com estado próprio seria a mesma reinvenção pela porta dos fundos.
//!
//! O primeiro tique EMITE as tasks abertas — quem sobe o monitor não sabe o que
//! já estava lá, e monitor que só fala do futuro deixa a fila cheia em silêncio.
//! Quem não quer isso passa `--changes-only`.
//!
//! depends_on: src/tasks/list.ts · src/tasks/model.ts · src/sprints/model.ts
//! impacts:    —

import { Command } from 'commander'
import { fmtOf } from '../shared/gh.ts'
import { acharSprint } from '../sprints/model.ts'
import { list } from './list.ts'
import { type Place, type State, agora, lembra, projetoCorrente } from './model.ts'

/** Task que ninguém está tocando — trabalho que um worker PODE pegar.
 *
 *  Os DOIS eixos entram: nem `doing`/`done`/`blocked`/`dropped` no desfecho, nem
 *  `in_progress`/`done` no lugar. Só o desfecho não bastava — uma task puxada
 *  por um agente que morreu antes do `start` fica em `in_progress/` com o
 *  `output.md` ainda em `draft`, e o monitor a oferecia pro próximo worker. */
const ABERTA = (t: Snap) => !['doing', 'done', 'blocked', 'dropped'].includes(t.state) && t.place !== 'in_progress' && t.place !== 'done'

type Snap = { key: string; sprint: string; id: string; title: string; place: Place; state: State; dir?: string; duration?: number }

/** O retrato do disco AGORA: uma entrada por task, com a sprint no endereço.
 *  A chave é `<sprint>/<nnn>` porque o NNN reinicia em cada sprint — chave só
 *  com o número faria a 001 de duas sprints serem a mesma task.
 *
 *  Lê pelo `list` e não por conta própria: dois leitores do mesmo disco divergem
 *  na primeira correção, e foi o `list` que aprendeu a separar lugar de desfecho. */
function retrato(slug: string, filtro?: Set<string>): Map<string, Snap> {
  const m = new Map<string, Snap>()
  for (const r of list(slug)) {
    if (filtro && !filtro.has(r.sprint)) continue
    const key = `${r.sprint}/${r.nnn}`
    m.set(key, { key, sprint: r.sprint, id: r.nnn, title: r.title, place: r.place, state: r.state, dir: r.dir, duration: r.duration })
  }
  return m
}

type Evento = { at: string; event: 'open' | 'appeared' | 'state' | 'gone'; from?: string } & Snap

/** Os dois eixos numa etiqueta só, pro `from` de um evento. */
const onde = (s: Snap) => `${s.place}/${s.state}`

/** O que mudou entre dois retratos. Task que sumiu é evento: ela foi movida pra
 *  outro projeto ou apagada, e quem espera por ela precisa parar de esperar.
 *
 *  MUDANÇA É NOS DOIS EIXOS: `backlog/draft` → `tasks/draft` é uma promoção que o
 *  worker precisa ver, e o desfecho não mexeu. Comparar só o `state` perdia ela. */
export function diff(antes: Map<string, Snap>, depois: Map<string, Snap>): Evento[] {
  const evs: Evento[] = []
  for (const [k, s] of depois) {
    const a = antes.get(k)
    if (!a) evs.push({ at: agora(), event: 'appeared', ...s })
    else if (onde(a) !== onde(s)) evs.push({ at: agora(), event: 'state', from: onde(a), ...s })
  }
  for (const [k, s] of antes) if (!depois.has(k)) evs.push({ at: agora(), event: 'gone', ...s })
  return evs
}

/** A FILA EM MOVIMENTO: chama `on` uma vez por mudança, pra sempre, até `stop()`.
 *
 *  O primeiro tique emite as ABERTAS (`--changes-only` desliga): quem sobe o
 *  monitor não sabe o que já estava lá, e monitor que só fala do futuro deixa a
 *  fila cheia em silêncio.
 *
 *  Esta é a função; `main` abaixo é só a casca que traduz argv e imprime. */
export function monitor(
  projeto: string,
  on: (e: Evento) => void,
  opts: { sprints?: readonly string[]; interval?: number; changesOnly?: boolean } = {},
): { stop(): void } {
  // A lista vira `Set` AQUI, e não na casca: quem chama de dentro do processo
  // passa os nomes que tem na mão, e `Set` é detalhe de como se procura.
  const filtro = opts.sprints?.length ? new Set(opts.sprints) : undefined
  let atual = retrato(projeto, filtro)
  if (!opts.changesOnly) for (const s of atual.values()) if (ABERTA(s)) on({ at: agora(), event: 'open', ...s })
  const id = setInterval(
    () => {
      const novo = retrato(projeto, filtro)
      for (const e of diff(atual, novo)) on(e)
      atual = novo
    },
    Math.max(1, opts.interval ?? 5) * 1000,
  )
  return { stop: () => clearInterval(id) }
}

export function command(): Command {
  return new Command('monitor')
    .description('Uma linha por mudança de estado na fila de tasks — do projeto inteiro ou de sprints escolhidas.')
    .option('-P, --project <slug>', 'o projeto. Passado uma vez, fica lembrado — senão vem do cwd')
    .option('-S, --sprints <lista>', 'uma ou mais sprints, separadas por vírgula (`999` ou `999_slug`). Sem isto: o projeto inteiro')
    .option('--sprint <nnn>', 'açúcar pra `--sprints` com uma só')
    .option('--interval <s>', 'segundos entre dois retratos do disco', '5')
    .option('--once', 'imprime o retrato de agora e sai — o `--once` é o teste do monitor')
    .option('--changes-only', 'não emite as abertas do primeiro tique; só o que mudar daqui pra frente')
    .option('--jsonl', 'uma linha JSON por evento')
}

export async function main(argv: string[]): Promise<number> {
  const cmd = command().exitOverride()
  try {
    cmd.parse(argv, { from: 'user' })
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1
  }
  const opts = cmd.opts()
  const { slug } = projetoCorrente(opts.project)
  if (!slug) return console.error('sem projeto corrente: passe `-P <slug>` uma vez e ele fica lembrado'), 1
  if (opts.project) lembra(slug)

  // As sprints chegam por PREFIXO (`999`), igual ao resto da casa, e cada uma é
  // resolvida no nome de pasta inteiro antes de virar filtro: filtrar pelo que o
  // humano digitou faria `999` casar zero contra `999_serve_images`.
  const escolhidas: string[] = []
  const pedidas: string[] = [...(opts.sprints ? String(opts.sprints).split(',') : []), ...(opts.sprint ? [opts.sprint] : [])]
    .map((s) => s.trim())
    .filter(Boolean)
  for (const p of pedidas) {
    const achada = acharSprint(slug, p)
    if ('erro' in achada) return console.error(achada.erro), 1
    escolhidas.push(achada.pasta)
  }

  const jsonl = fmtOf(argv) === 'jsonl' || opts.jsonl
  const linha = (e: Evento) =>
    jsonl
      ? JSON.stringify(e)
      : `${e.at} ${e.event.padEnd(9)} ${e.sprint}/${e.id} ${e.from ? `${e.from} → ` : ''}${onde(e)}  ${e.title}`

  const rodando = monitor(slug, (e) => console.log(linha(e)), {
    sprints: escolhidas,
    interval: Number(opts.interval),
    changesOnly: opts.changesOnly,
  })
  if (opts.once) return rodando.stop(), 0

  // Espera sem fim de propósito: quem mata é a Monitor tool, o `timeout` ou o
  // Ctrl-C de quem chamou. Monitor que se encerra sozinho é monitor que some no
  // meio de um turno longo, que é exatamente quando ele importa.
  await new Promise(() => {})
  return 0
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)))
