#!/usr/bin/env bun
//! As sprints de um projeto, com a SOMA dos minutos e quem passou do teto.
//!
//!     my sprints list                  o projeto corrente
//!     my sprints list -P local-registry troca o corrente, e LEMBRA
//!     my sprints list --tsv            uma linha por sprint, pro awk
//!
//! Uma linha por sprint: número, minutos somados, tasks, e a crítica do teto
//! quando existe. O teto de 10 min é a SOMA das `duration` das tasks de dentro
//! (um agente roda as tasks em ordem) — e quem não declarou `duration` aparece
//! também, porque sem ela a soma existe mas o teto não é verificável.
//!
//! exit 1 quando alguma sprint tem crítica — é o que faz isto servir de gate.
//!
//! depends_on: src/sprints/model.ts · src/sprints/move.ts
//! impacts:    src/projects/model.ts

import { Command } from 'commander'
import { fmtOf, out } from "@my/shared/gh"
import { lembra, projetoCorrente } from '../shared/work/model.ts'
import { CEILING_MIN, criticaDoTeto, minutos, semDuration, sprints, tasksSoltas } from './model.ts'

export function command(): Command {
  return new Command('list')
    .description('As sprints do projeto, com a soma dos minutos e quem passou do teto de 10.')
    .option('-P, --project <slug>', 'o projeto. Passado uma vez, fica lembrado — senão vem do cwd')
    .option('--json', 'a lista inteira, pro jq')
    .option('--jsonl', 'uma sprint por linha')
    .option('--tsv', 'uma sprint por linha, pro awk')
}

export async function main(argv: string[]): Promise<number> {
  const cmd = command().exitOverride()
  try {
    cmd.parse(argv, { from: 'user' })
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1
  }
  const opts = cmd.opts()
  const { slug, porque } = await projetoCorrente(opts.project)
  if (!slug) return console.error('sem projeto corrente: passe `-P <slug>` uma vez e ele fica lembrado'), 1
  if (opts.project) await lembra(slug)

  const todas = sprints(slug)
  const rows = todas.map((s) => ({
    projeto: slug,
    sprint: s.nnn,
    pasta: s.pasta,
    titulo: s.titulo,
    tasks: s.tasks.length,
    estado: s.estado,
    minutes: minutos(s),
    sem_duration: semDuration(s),
    critica: criticaDoTeto(s),
  }))

  const fmt = fmtOf(argv)
  if (fmt !== 'human') {
    out(fmt, rows, (r) => [r.projeto, r.sprint, r.estado, r.minutes, r.tasks, r.critica], (r) => `${r.sprint} ${r.titulo}`)
    return rows.some((r) => r.critica) ? 1 : 0
  }

  const soltas = tasksSoltas(slug)
  console.log(`${slug} (${porque}) · ${rows.length} sprints · teto ${CEILING_MIN} min por sprint`)
  for (const r of rows) {
    console.log(`\n  ${r.pasta}  ${r.minutes || '?'} min · ${r.tasks} tasks${r.estado === 'aberta' ? '' : `  [${r.estado}]`}`)
    console.log(`     ${r.titulo}`)
    if (r.critica) console.log(`     ⚠ ${r.critica}`)
  }
  if (!rows.length) console.log('  nenhuma sprint ainda — `my sprints new "<título>"` cria a 999')
  // A forma velha continua sendo LIDA, e aparece aqui: migração que não é
  // acusada é migração lembrada, e ninguém lembra.
  if (soltas.length)
    console.log(`\n  ⚠ ${soltas.length} task(s) soltas em tasks/ (${soltas.map((t) => t.id).join(', ')}) — a task virou pasta DENTRO da sprint`)
  return rows.some((r) => r.critica) ? 1 : 0
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)))
