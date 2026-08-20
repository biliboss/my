#!/usr/bin/env bun
//! As tasks de um projeto, AGRUPADAS POR SPRINT, com o lugar e o desfecho de cada uma.
//!
//!     my tasks list                    o projeto corrente
//!     my tasks list -P local-registry  troca o corrente, e LEMBRA
//!     my tasks list --tsv              uma linha por task, com a sprint na coluna 2
//!     my tasks list -s blocked         só as travadas
//!
//! A SOMA que importa é a de cada SPRINT, não a do projeto: o teto de 10 min é da
//! sprint, porque é um agente que roda as tasks dela em ordem
//! (#sprint_order_and_size). Quem quer só a soma e a crítica: `my sprints list`.
//!
//! As tasks SOLTAS de `tasks/NNN_*` — a forma anterior à sprint-pasta — saem num
//! grupo `—` no fim. Continuam sendo lidas enquanto existirem; quem acusa é o
//! `my projects check` (`unsprinted_tasks`).
//!
//! DOIS EIXOS, DUAS COLUNAS. `place` é a PASTA — `backlog/`, `tasks/`,
//! `in_progress/`, `done/` —, e responde onde a task está na FILA. `state` é o
//! `output.md`, e responde como ela TERMINOU: `draft`, `doing`, `done`,
//! `blocked`, `dropped`. Os dois últimos não têm pasta, então a coluna única que
//! existia aqui os escondia — uma task fechada com `--blocked` continua parada em
//! `in_progress/`, e a lista dizia `doing` sobre ela.
//!
//! depends_on: src/tasks/model.ts · src/sprints/model.ts · src/tasks/new.ts
//! impacts:    src/tasks/new.ts · src/tasks/monitor.ts

import { Command } from 'commander'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Task } from '../runs.ts'
import { fmtOf, out } from '../shared/gh.ts'
import { sprints, tasksSoltas } from '../sprints/model.ts'
import { type Place, RAIZ, type State, lembra, ler, placeDe, projetoCorrente, stateDe } from './model.ts'

/** Uma task da lista com os DOIS eixos separados: `place` é a pasta (onde ela
 *  está na fila), `state` é o `output.md` (como ela terminou).
 *
 *  Eles vêm juntos porque nenhum dos dois responde sozinho: @src/runs.ts deixa a
 *  PASTA ganhar do campo — um worker morto deixa a pasta parada onde o `ls`
 *  mostra —, e o preço disso é que `blocked` e `dropped`, que não têm pasta,
 *  sumiam da lista. Uma task travada em `in_progress/` aparecia como `doing`. */
export type Listada = {
  projeto: string
  sprint: string
  sprintTitulo: string
  nnn: string
  title: string
  place: Place
  state: State
  duration?: number
  proof?: string
  /** A pasta, relativa à raiz — é o que o consumidor abre (`.doing/claim.json`, `refs/`). */
  dir?: string
  refs?: string[]
}

/** AS TASKS DE UM PROJETO, na ordem do planejamento: as sprints pela pasta (o
 *  número conta pra baixo) e as soltas de `tasks/` no fim.
 *
 *  Esta é a função; `main` abaixo é só a casca que traduz argv e imprime. */
export function list(projeto: string, state?: State): Listada[] {
  const grupos: { sprint: string; titulo: string; tasks: Task[] }[] = [
    ...sprints(projeto).map((s) => ({ sprint: s.pasta, titulo: s.titulo, tasks: s.tasks })),
    ...(tasksSoltas(projeto).length
      ? [{ sprint: '—', titulo: 'tasks/ — solta, forma anterior à sprint-pasta', tasks: tasksSoltas(projeto) }]
      : []),
  ]
  return grupos
    .flatMap((g) =>
      g.tasks.map((t): Listada => {
        const abs = t.dir ? join(RAIZ, t.dir) : undefined
        return {
          projeto,
          sprint: g.sprint,
          sprintTitulo: g.titulo,
          nnn: t.id,
          title: t.title,
          place: abs ? placeDe(abs) : 'tasks',
          // O desfecho vem do `output.md` CRU, e não do `state` que `runs.ts` já
          // sobrescreveu com a pasta: é a única leitura que enxerga `blocked`.
          state: abs && existsSync(join(abs, 'CONTEXT.md')) ? stateDe(ler(abs)) : 'draft',
          duration: t.duration,
          proof: t.proof,
          dir: t.dir,
          refs: t.refs,
        }
      }),
    )
    .filter((r) => !state || r.state === state)
}

export function command(): Command {
  return new Command('list')
    .description('As tasks do projeto, por prioridade, com o lugar e o desfecho de cada uma.')
    .option('-P, --project <slug>', 'o projeto. Passado uma vez, fica lembrado — senão vem do cwd')
    .option('-s, --state <state>', 'só as de um desfecho: draft, doing, done, blocked, dropped')
    .option('--json', 'a lista inteira, pro jq')
    .option('--jsonl', 'uma task por linha')
    .option('--tsv', 'uma task por linha, pro awk')
}

export function main(argv: string[]): number {
  const cmd = command().exitOverride()
  try {
    cmd.parse(argv, { from: 'user' })
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1
  }
  const opts = cmd.opts()
  const { slug, porque } = projetoCorrente(opts.project)
  if (!slug) return console.error('sem projeto corrente: passe `-P <slug>` uma vez e ele fica lembrado'), 1
  if (opts.project) lembra(slug)

  const rows = list(slug, opts.state as State | undefined)

  const fmt = fmtOf(argv)
  if (fmt !== 'human') {
    // `dir` sai no JSON porque a PASTA é o que o consumidor abre: o crachá do
    // claim (`<dir>/.doing/claim.json`), os `refs/`, o `CONTEXT.md`. Sem ela, quem
    // consome o JSON tinha que remontar o caminho a partir de projeto+sprint+nnn —
    // e remontar caminho é como se descobre tarde que a forma mudou.
    out(fmt, rows, (r) => [r.projeto, r.sprint, r.nnn, r.place, r.state, r.duration, r.title], (r) => `${r.sprint} ${r.nnn} ${r.title}`)
    return 0
  }
  const total = rows.reduce((n, t) => n + (t.duration ?? 0), 0)
  // A contagem de sprints é a das sprints REAIS: o grupo `—` das tasks soltas não
  // é uma sprint, e contá-lo faria a linha do topo mentir sobre o plano.
  const sprintsVistas = [...new Set(rows.map((r) => r.sprint))]
  console.log(`${slug} (${porque}) · ${sprintsVistas.filter((s) => s !== '—').length} sprints · ${rows.length} tasks · ${total || '?'} min somados`)
  for (const s of sprintsVistas) {
    const doGrupo = rows.filter((r) => r.sprint === s)
    // A soma que importa é a DA SPRINT — é ela que tem teto de 10 min, porque um
    // agente roda as tasks dela em ordem (#sprint_order_and_size).
    console.log(`\n  ${s}  ${doGrupo.reduce((n, t) => n + (t.duration ?? 0), 0) || '?'} min · ${doGrupo[0]!.sprintTitulo}`)
    for (const t of doGrupo) {
      // OS DOIS EIXOS, em duas colunas: `in_progress blocked` é uma linha que a
      // coluna única não sabia escrever — ela imprimia `doing` e escondia o motivo.
      console.log(`    ${t.nnn} ${t.place.padEnd(11)} ${t.state.padEnd(7)} ${t.title}${t.refs?.length ? `  (+${t.refs.length})` : ''}`)
      console.log(`       ${t.duration ?? '?'} min · proof: ${t.proof?.trim().split('\n')[0] ?? 'FALTA'}`)
      // `## Why` faltando é o achado mais caro: task sem porquê é executada ao pé da
      // letra e entrega a coisa errada com a prova passando.
      if (t.dir && !readFileSync(join(RAIZ, t.dir, 'CONTEXT.md'), 'utf8').includes('## Why'))
        console.log('       sem `## Why` — o pedido não diz por quê')
    }
  }
  if (!rows.length) console.log('  nenhuma task ainda — `my sprints new "<título>"` e depois `my tasks new "<título>"`')
  return 0
}

if (import.meta.main) process.exit(main(process.argv.slice(2)))
