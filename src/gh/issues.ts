#!/usr/bin/env bun
//! O estado de uma issue no GitHub — aberta, fechada, e o que ela virou.
//!
//!     my gh issues 284 --repo acme/acme
//!     my gh issues https://github.com/acme/acme/issues/284
//!     my gh issues 284 285 286 --repo <slug> --tsv
//!
//! O ciclo de código lê o PLANO do disco e o ESTADO daqui. Uma fonte sozinha
//! mente: o `sprints.yaml` não sabe que a 284 fechou, e a issue não sabe qual é a
//! prova da task — @01_projects/_parked/acme/features/share_external/callstack_do_sprint.md.
//!
//! `--repo` É EXPLÍCITO, sempre. `gh` sem `--repo` resolve pelo `origin` do
//! diretório atual, e agente roda de worktree, de `~/src/me`, de onde o harness
//! deixou — `my references gh_general`. A URL já carrega o repo; o número não, e
//! aí o flag é obrigatório.
//!
//! depends_on: 02_areas/00_workflows/00_main/00_shared/references/gh_general.md · src/gh/run.ts · src/shared/gh.ts
//! impacts:    src/sprints/run.ts

import { flag, fmtOf, out, type Fmt } from '../shared/gh.ts'
import { GH_RETRIES, ghJson } from './run.ts'

export type Issue = { number: number; state: 'OPEN' | 'CLOSED'; title: string; url: string; repo: string }

/** `284` ou a URL inteira. A URL ganha do `--repo`: ela é mais específica, e
 *  copiar link do navegador é o caminho mais curto que existe. */
export function parse(alvo: string, repoFlag?: string): { repo: string; number: number } {
  const url = alvo.match(/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/(\d+)/)
  if (url) return { repo: url[1]!, number: Number(url[2]) }
  if (!/^\d+$/.test(alvo)) throw new Error(`"${alvo}" não é número de issue nem URL de issue`)
  if (!repoFlag) throw new Error(`issue ${alvo} sem repo: passe --repo <owner>/<repo>, ou a URL inteira`)
  return { repo: repoFlag, number: Number(alvo) }
}

export async function read(repo: string, number: number): Promise<Issue> {
  // Passa pelo runner (@src/gh/run.ts) e por isso GANHOU timeout e retry de 5xx —
  // este sítio não tinha nenhum dos dois, e é o mesmo 503 que fez duas sprints
  // saírem `unknown` na função abaixo.
  const r = await ghJson<Omit<Issue, 'repo'>>(['issue', 'view', String(number), '--repo', repo, '--json', 'number,state,title,url'])
  if (!r.ok) throw new Error(`gh issue view ${repo}#${number}: ${r.error}`)
  return { ...r.data, repo }
}

/** TODAS as issues do repo, numa chamada. Seis `issue view` são seis chances de
 *  a API devolver 5xx — medido em 17/08: duas sprints saíram `unknown` em rodadas
 *  diferentes, cada vez uma outra. Uma lista responde o que N chamadas
 *  respondiam, e responde igual toda vez. */
export async function list(repo: string, tentativas = GH_RETRIES): Promise<Map<number, Issue>> {
  const r = await ghJson<Omit<Issue, 'repo'>[]>(
    ['issue', 'list', '--repo', repo, '--state', 'all', '--limit', '400', '--json', 'number,state,title,url'],
    { retries: tentativas },
  )
  if (!r.ok) throw new Error(`gh issue list ${repo}: ${r.error}`)
  return new Map(r.data.map((row) => [row.number, { ...row, repo }]))
}

export async function main(argv: string[]): Promise<number> {
  const fmt: Fmt = fmtOf(argv)
  const repoFlag = flag(argv, '--repo')
  const alvos = argv.filter((a) => !a.startsWith('--') && a !== repoFlag)

  if (!alvos.length) {
    console.error('uso: my gh issues <número|url> [...] [--repo <owner>/<repo>] [--json|--jsonl|--tsv]')
    return 2
  }

  const issues: Issue[] = []
  for (const alvo of alvos) {
    try {
      const { repo, number } = parse(alvo, repoFlag)
      issues.push(await read(repo, number))
    } catch (e) {
      console.error((e as Error).message)
      return 1
    }
  }
  // repo · number · state · title · url
  out(fmt, issues, (i) => [i.repo, i.number, i.state, i.title, i.url], (i) => `${i.repo}#${i.number} ${i.state.padEnd(6)} ${i.title}\n  ${i.url}`)
  return 0
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)))
