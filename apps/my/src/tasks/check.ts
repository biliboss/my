#!/usr/bin/env bun
//! O que está TORTO na fila de tasks — e sai 1 quando acha alguma coisa.
//!
//!     my tasks check                   TODOS os projetos
//!     my tasks check -P study-bloom    um só
//!     my tasks check --tsv             uma linha por achado, pro awk
//!
//! TRÊS PERGUNTAS, e cada uma nasceu de um jeito de a fila mentir:
//!
//!   in_progress sem claim   a pasta diz "um agente está nisso" e não há crachá
//!                           dentro dela. É o worker que morreu, ou o `--blocked`
//!                           que soltou a trava e deixou a pasta onde estava.
//!   worktree morta          `output.md` aponta pra um caminho que não existe
//!                           mais — o `done` vai recusar, e só na hora de fechar.
//!   done sem prova          fechada sem `proof:` declarada, ou sem `commit_end`
//!                           carimbado. `done` sem evidência é mentira com data.
//!
//! POR QUE ELE PODE EXISTIR E O `Metrics.measure()` NÃO: as três perguntas são
//! sobre o AGORA, e o disco de agora responde as três. Medir duração, retomada e
//! quantas vezes a prova rodou precisaria do PASSADO, e o `output.md` guarda só o
//! último valor de cada campo — @packages/interfaces/tasks.ts diz o que faltaria.
//!
//! depends_on: src/tasks/model.ts · src/tasks/claim.ts
//! impacts:    —

import { Command } from 'commander'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fmtOf, out } from '../shared/gh.ts'
import { CRACHA, TRAVA, crachaDe } from './claim.ts'
import { RODANDO, lembra, ler, pastasDeTask, placeDe, projetoCorrente, projetos, rel, stateDe } from './model.ts'

/** O que este sistema achou de podre. A forma é a do contrato
 *  (@packages/interfaces/tasks.ts): `path` e `says`, e nada mais — o runner do
 *  `House.check()` lê pela FORMA, então campo a mais aqui é campo que só este
 *  arquivo entende. */
export type Finding = { path: string; says: string }

/** AS TRÊS PERGUNTAS, contra UMA pasta de task. Separada do laço porque é a
 *  única lógica não-trivial daqui, e é ela que o teste consegue exercitar contra
 *  uma árvore de mentira — varrer `01_projects/` inteiro num teste seria aferir o
 *  estado do dia em vez da regra. */
export function achadosDaTask(dir: string): Finding[] {
  const achados: Finding[] = []
  const t = ler(dir)
  const place = placeDe(dir)
  const state = stateDe(t)
  const path = rel(dir)

  // 1. `in_progress/` é a pasta de quem PUXOU a task, e o crachá é quem responde
  //    "quem". Sem ele a pasta diz que alguém está nisso e não há ninguém — o
  //    `ls` mentindo, que é o que estado-em-pasta veio impedir.
  if (place === RODANDO && !crachaDe(dir))
    achados.push({
      path,
      says:
        state === 'blocked' || state === 'dropped'
          ? `fechada como \`${state}\` e parada em ${RODANDO}/ — o desfecho soltou a trava e não devolveu a pasta`
          : existsSync(join(dir, TRAVA))
            ? `trava sem crachá: ${TRAVA}/ existe e ${CRACHA} não — ninguém sabe de quem ela é`
            : `em ${RODANDO}/ sem claim — se o dono morreu: my tasks claim ${t.nnn} --release --force`,
    })

  // 2. A worktree é onde o `done` vai commitar. Descobrir que ela sumiu só na
  //    hora de fechar é descobrir tarde, com o trabalho já feito.
  const worktree = String(t.saida.worktree || '')
  if (worktree && !existsSync(worktree))
    achados.push({ path, says: `worktree morta: ${worktree} não existe mais, e é onde o \`done\` ia commitar` })

  // 3. A prova é o que separa entrega de alegação. `commit_end` só é carimbado
  //    DEPOIS que ela passou (@src/tasks/done.ts), então a ausência dele num
  //    `done` é a prova que nunca rodou.
  if (state === 'done') {
    if (!String(t.pedido.proof ?? '').trim() || String(t.pedido.proof).includes('<'))
      achados.push({ path, says: 'done sem `proof:` no pedido — fechou sem ter o que provar (#proof_per_task)' })
    else if (!t.saida.commit_end) achados.push({ path, says: 'done sem `commit_end` — a prova nunca rodou por `my tasks done`' })
  }
  return achados
}

/** AS TRÊS PERGUNTAS, contra o disco. Sem projeto: todos.
 *
 *  Esta é a função; `main` abaixo é só a casca que traduz argv e imprime. */
export function check(projeto?: string): Finding[] {
  return (projeto ? [projeto] : projetos()).flatMap((slug) => pastasDeTask(slug).flatMap(achadosDaTask))
}

export function command(): Command {
  const cmd = new Command('check')
    .description('O que está torto na fila: in_progress sem claim, worktree morta, done sem prova.')
    .option('-P, --project <slug>', 'um projeto só. Omitido, TODOS — achado de fila não tem projeto corrente')
    .option('--json', 'os achados, pro jq')
    .option('--jsonl', 'um achado por linha')
    .option('--tsv', 'um achado por linha, pro awk')
  cmd.addHelpText('after', '\n  Sai 1 quando acha alguma coisa — é o que o deixa servir de portão.\n')
  return cmd
}

export async function main(argv: string[]): Promise<number> {
  const cmd = command().exitOverride()
  try {
    cmd.parse(argv, { from: 'user' })
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1
  }
  const opts = cmd.opts()
  // Sem `-P` ele varre TODOS, e não o corrente: uma fila torta em outro projeto
  // continua torta, e um check que só olha onde você está é um check que passa.
  const slug = opts.project ? (await projetoCorrente(opts.project)).slug : undefined
  if (opts.project && slug) await lembra(slug)

  const achados = check(slug)
  const fmt = fmtOf(argv)
  if (fmt !== 'human') {
    out(fmt, achados, (f) => [f.path, f.says], (f) => `${f.path}\t${f.says}`)
    return achados.length ? 1 : 0
  }
  for (const f of achados) console.log(`${f.path}\n  ${f.says}`)
  const onde = slug ?? `${projetos().length} projetos`
  console.log(achados.length ? `\n${achados.length} achado(s) em ${onde}` : `nada torto em ${onde}`)
  return achados.length ? 1 : 0
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)))
