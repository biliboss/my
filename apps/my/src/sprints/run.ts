#!/usr/bin/env bun
//! As sprints de um CICLO (o `sprints.yaml` do run), cruzadas com o GitHub.
//!
//!     my sprints run 999_via               as sprints, com a URL de cada uma
//!     my sprints run 999_via --gh          cruza com o GitHub e ESCREVE sprints_gh.yaml
//!     my sprints run 999_via --tsv         uma linha por task
//!
//! Era `my sprints <run>` — o verbo virou PASTA em 18/08, quando a sprint passou
//! a existir também em DISCO como pasta de projeto. Duas fontes, dois subverbos:
//! `run` lê o yaml de um ciclo, `list` lê as pastas de um projeto. Uma flag pra
//! escolher entre as duas seria um verbo escondido dentro de outro.
//!
//! A unidade de trabalho é a SPRINT — é o que o produto escreve, o que vira
//! issue, o que vira PR, e o que um agente pega. Por isso ela tem verbo próprio;
//! `my runs` só diz quais ciclos existem.
//!
//! DUAS FONTES, e uma sozinha mente: o disco diz o que foi PLANEJADO, o GitHub
//! diz o que já ACONTECEU. O `sprints.yaml` não sabe que a issue fechou, e a
//! issue não sabe qual é a prova da task.
//!
//! O JOIN DEIXA ARQUIVO — `sprints_gh.yaml`, ao lado do plano, com o estado de
//! cada sprint do lado dela. O portão seguinte lê disco em vez de API, e o board
//! também. O `sprints.yaml` NUNCA é reescrito: ele é o plano, decidido pelo
//! produto, e plano não muda porque o trabalho andou.
//!
//! O desenho inteiro em
//! @01_projects/_parked/acme/features/share_external/callstack_do_sprint.md.
//!
//! depends_on: src/runs.ts · src/gh/issues.ts · src/gh/prs.ts · src/shared/resolve.ts
//! impacts:    02_areas/00_workflows/00_main/01_coding/CONTEXT.md

import { writeFileSync } from 'node:fs'
// `join` do path fica com o nome dele; o nosso join é de DOMÍNIO
// (`coding:joinSprintState` no desenho) e sombrear o import custou um erro
// ilegível — `path must be a string` vindo de dentro do writeJoin.
import { join } from 'node:path'
import { list as listIssues, type Issue } from '../gh/issues.ts'
import { open as openPrs } from '../gh/prs.ts'
import { acharRun, buracos, CEILING_MIN, issueUrl, minutes, type Run, type Sprint } from '../runs.ts'
import { fmtOf, out } from "@my/shared/gh"
import { home } from '../shared/file.ts'

const ROOT = home()

/** O estado de uma sprint vem do GitHub, não do yaml. Os três desfechos são o
 *  que impede o lote de refazer o que já entrou (`delivered`) e de abrir o
 *  segundo PR do mesmo branch (`in_flight`). */
export type Estado = 'delivered' | 'in_flight' | 'pending' | 'unknown'
export type SprintState = { sprint: string; title: string; issue?: number; issue_url?: string; issue_state?: string; branch: string; pr?: number; pr_url?: string; estado: Estado; tasks: number; minutes: number }

/** O branch de uma unidade é convenção do CICLO, não do plano: `<base>/U<n>`.
 *  Sem base declarada não existe branch pra perguntar, e o estado fica `unknown`
 *  em vez de virar chute. */
export const unitBranch = (base: string | undefined, sprint: Sprint) => (base ? `${base}/U${sprint.id.replace(/^S/, '')}` : '')

export async function joinSprintState(run: Run): Promise<SprintState[]> {
  const temSlug = !!run.repo && /^[\w.-]+\/[\w.-]+$/.test(run.repo)
  // DUAS chamadas pro GitHub, não duas por sprint: a lista de issues e a de PRs
  // abertos respondem o lote inteiro, e não ficam sujeitas a um 5xx por sprint.
  const prs = temSlug ? await openPrs(run.repo!) : new Map()
  let issues = new Map<number, Issue>()
  if (temSlug) {
    try {
      issues = await listIssues(run.repo!)
    } catch {
      // GitHub fora do ar é informação, não parada: tudo fica `unknown`, e o
      // portão trata como buraco em vez de assumir que está pendente.
    }
  }
  const estados: SprintState[] = []

  for (const s of run.sprints) {
    const branch = unitBranch(run.base, s)
    const pr = branch ? prs.get(branch) : undefined
    const issue_state = s.issue ? issues.get(s.issue)?.state : undefined
    const estado: Estado =
      issue_state === 'CLOSED' ? 'delivered' : pr ? 'in_flight' : issue_state === 'OPEN' ? 'pending' : 'unknown'
    estados.push({
      sprint: s.id,
      title: s.title,
      issue: s.issue,
      issue_url: issueUrl(run, s.issue),
      issue_state,
      branch,
      pr: pr?.number,
      pr_url: pr?.url,
      estado,
      tasks: s.tasks.length,
      minutes: minutes(s),
    })
  }
  return estados
}

/** O artefato do join. YAML à mão de propósito: são 5 campos por sprint, e uma
 *  dependência de serialização pra isso seria a única do arquivo. */
export function writeJoin(run: Run, estados: SprintState[]): string {
  const path = join(ROOT, run.path, 'sprints_gh.yaml')
  const linhas = [
    `# O RETRATO de fora, não o plano. O plano é o sprints.yaml ao lado, e ele não`,
    `# é reescrito quando o trabalho anda. Apagar este arquivo e rodar`,
    `# \`my sprints run ${run.run} --gh\` de novo é como se atualiza.`,
    `run: ${run.run}`,
    `repo: ${run.repo ?? ''}`,
    `base: ${run.base ?? ''}`,
    `sprints:`,
  ]
  for (const e of estados) {
    linhas.push(`  - sprint: ${e.sprint}`)
    linhas.push(`    estado: ${e.estado}`)
    if (e.issue) linhas.push(`    issue: ${e.issue}`, `    issue_state: ${e.issue_state ?? 'unknown'}`, `    issue_url: ${e.issue_url ?? ''}`)
    if (e.branch) linhas.push(`    branch: ${e.branch}`)
    if (e.pr) linhas.push(`    pr: ${e.pr}`, `    pr_url: ${e.pr_url}`)
    linhas.push(`    tasks: ${e.tasks}`, `    minutes: ${e.minutes}`)
  }
  writeFileSync(path, linhas.join('\n') + '\n')
  return path
}

export async function main(argv: string[]): Promise<number> {
  const fmt = fmtOf(argv)
  const comGh = argv.includes('--gh')
  const [alvo] = argv.filter((a) => !a.startsWith('--'))

  if (!alvo) {
    console.error('uso: my sprints run <run> [--gh] [--json|--jsonl|--tsv]')
    return 2
  }

  const achado = acharRun(alvo)
  if ('erro' in achado) return console.error(achado.erro), 1
  const run = achado
  if (!run.sprints.length) return console.error(`${run.run} não tem sprints em nenhum dos dois dialetos`), 1

  if (!comGh) {
    // sprint · issue url · task · proof
    const rows = run.sprints.flatMap((s) => s.tasks.map((t) => ({ sprint: s.id, sprint_title: s.title, issue: s.issue, issue_url: issueUrl(run, s.issue), task: t.id, title: t.title, proof: t.proof })))
    if (fmt === 'human') {
      console.log(`${run.run} · ${run.sprints.length} sprints · ${rows.length} tasks`)
      for (const s of run.sprints) {
        console.log(`\n  ${s.id} · ${s.title}${issueUrl(run, s.issue) ? `\n     ${issueUrl(run, s.issue)}` : ''}`)
        for (const t of s.tasks) console.log(`     ${t.id} ${t.title}\n        proof: ${t.proof ?? 'FALTA'}`)
      }
    } else out(fmt, rows, (r) => [run.run, r.sprint, r.issue_url, r.task, r.title, r.proof], (r) => `${r.sprint} ${r.task} ${r.title}`)
    return 0
  }

  const estados = await joinSprintState(run)
  const path = writeJoin(run, estados)
  const gaps = buracos(run)

  if (fmt === 'human') {
    console.log(`${run.run} · ${estados.length} sprints · repo ${run.repo ?? '—'} · base ${run.base ?? '—'}`)
    for (const e of estados)
      console.log(`  ${e.sprint.padEnd(4)} ${e.estado.padEnd(10)} ${e.tasks} tasks · ${e.minutes || '?'} min${e.minutes > CEILING_MIN ? ' ACIMA DO TETO' : ''} · issue ${e.issue ?? '—'} ${e.issue_state ?? ''} · pr ${e.pr ?? '—'}\n       ${e.title}`)
    console.log(`\n  join escrito: ${path.slice(ROOT.length)}`)
    if (gaps.length) {
      console.log(`\n  RunNotReady — ${gaps.length} buraco(s) pro 01_coding:`)
      for (const g of gaps) console.log(`   - ${g}`)
    } else console.log('\n  RunReady: repo, base e proof por task')
  } else out(fmt, estados, (e) => [run.run, e.sprint, e.estado, e.issue, e.pr, e.tasks], (e) => e.sprint)
  return gaps.length ? 1 : 0
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)))
