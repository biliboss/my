#!/usr/bin/env bun
//! Existe PR aberto pra este branch? — a pergunta que faz o ciclo ser idempotente.
//!
//!     my gh prs staging/U1 --repo viacorretor/viacorretor
//!     my gh prs --repo <slug>                 todos os abertos
//!     my gh prs staging/U1 staging/U2 --repo <slug> --tsv
//!
//! Duas abas do mesmo trabalho é o defeito clássico de retry de agente, e a
//! resposta custa UMA chamada — `my references gh_general`. O ciclo de código
//! pergunta isto duas vezes, de propósito: na LEITURA (a sprint já está em vôo?)
//! e no FECHO da unidade (abre, ou atualiza o que existe?).
//!
//! Branch sem PR não é erro: é `—`, e é a resposta que libera o corte da unidade.
//!
//! depends_on: 02_areas/00_workflows/00_main/00_shared/references/gh_general.md · src/gh/run.ts · src/shared/gh.ts
//! impacts:    src/sprints/run.ts

import { flag, fmtOf, out, type Fmt } from '../shared/gh.ts'
import { GH_RETRIES, ghJson } from './run.ts'

export type Pr = { branch: string; number?: number; state?: string; title?: string; url?: string; repo: string }

export async function open(repo: string, tentativas = GH_RETRIES): Promise<Map<string, Pr>> {
  // O retry de 5xx e o timeout moram no runner (@src/gh/run.ts). Este laço estava
  // copiado linha a linha em `gh/issues.ts`, diferindo só no argv — e o motivo dele
  // (a API do GitHub devolve `HTTP 503: No server is currently available` sozinha,
  // medido em 17/08) valia para os cinco sítios e estava escrito em dois.
  const r = await ghJson<{ number: number; state: string; title: string; url: string; headRefName: string }[]>(
    ['pr', 'list', '--repo', repo, '--state', 'open', '--limit', '200', '--json', 'number,state,title,url,headRefName'],
    { retries: tentativas },
  )
  if (!r.ok) throw new Error(`gh pr list ${repo}: ${r.error}`)
  const rows = r.data
  // UMA chamada pra N branches: perguntar por branch faria N chamadas pra
  // responder o que uma lista já responde.
  return new Map(rows.map((r) => [r.headRefName, { branch: r.headRefName, number: r.number, state: r.state, title: r.title, url: r.url, repo }]))
}

export async function main(argv: string[]): Promise<number> {
  const fmt: Fmt = fmtOf(argv)
  const repo = flag(argv, '--repo')
  const branches = argv.filter((a) => !a.startsWith('--') && a !== repo)

  if (!repo) {
    console.error('uso: my gh prs [<branch> ...] --repo <owner>/<repo> [--json|--jsonl|--tsv]')
    return 2
  }

  let abertos: Map<string, Pr>
  try {
    abertos = await open(repo)
  } catch (e) {
    console.error((e as Error).message)
    return 1
  }

  const rows: Pr[] = branches.length ? branches.map((b) => abertos.get(b) ?? { branch: b, repo }) : [...abertos.values()]
  // repo · branch · number · state · url
  out(
    fmt,
    rows,
    (r) => [r.repo, r.branch, r.number, r.state, r.url],
    (r) => (r.number ? `${r.branch.padEnd(28)} #${r.number} ${r.state}\n  ${r.url}` : `${r.branch.padEnd(28)} — nenhum PR aberto`),
  )
  return 0
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)))
