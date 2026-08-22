//! A árvore de `02_areas/00_workflows/`, lida do DISCO — o substantivo desta
//! pasta, do qual os dois verbos ao lado saem.
//!
//! Nada aqui é lista escrita à mão: categoria é diretório, workflow é diretório
//! com `CONTEXT.md` dentro, e o corpo é o arquivo verbatim. Um índice à mão
//! seria a 15ª cópia da mesma tabela, e a primeira a apodrecer.
//!
//! POR QUE NÃO É `meta.ts`. `my meta` serve os quatro processos de PRODUTO, e
//! o nome de cada um vem do `# ` da primeira linha. Os steps de `01_engineering/`
//! e `02_system/` abrem com frontmatter e não têm esse heading — eles são
//! achados pelo MAPA, e estes verbos são o mapa executável. Um segundo leitor de
//! 40 linhas é mais barato que ensinar o de 1600 a falar de duas famílias com
//! regras diferentes.
//!
//! depends_on: 02_areas/00_workflows/CONTEXT.md
//! impacts:    src/workflows/list.ts · src/workflows/show.ts

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { home } from '../shared/file.ts'

const ROOT = home()
export const WORKFLOWS = join(ROOT, '03_resources/00_company')

/** As categorias: os diretórios de primeiro nível. `00_product`, `01_engineering`, … */
export function categories(dir = WORKFLOWS): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

/**
 *  Os workflows de uma categoria. Um Value Stream tem PROCESSES no meio
 *  (`02_deliver_what_sell/01_plan/request_to_issue`) e `shared_workflows/` não
 *  tem (`shared_workflows/research`) — os dois caem aqui, e o nome devolvido é
 *  o caminho relativo à categoria.
 *
 *  A regra é posicional e não adivinha: `NN_` com filho que tem `CONTEXT.md` é
 *  PROCESS, e desce um nível. Qualquer outro diretório com `CONTEXT.md` é o
 *  workflow, e o que estiver abaixo dele é STAGE — nunca listado aqui.
 */
export function workflows(category: string, dir = WORKFLOWS): string[] {
  const path = join(dir, category)
  if (!existsSync(path)) return []
  const dirs = (at: string) => readdirSync(at, { withFileTypes: true }).filter((e) => e.isDirectory())
  const out: string[] = []
  for (const e of dirs(path)) {
    const here = join(path, e.name)
    const filhos = dirs(here).filter((c) => existsSync(join(here, c.name, 'CONTEXT.md')))
    if (/^\d\d_/.test(e.name) && filhos.length) {
      for (const c of filhos) out.push(`${e.name}/${c.name}`)
      continue
    }
    if (existsSync(join(here, 'CONTEXT.md'))) out.push(e.name)
  }
  return out.sort()
}

/**
 *  Acha um workflow pelo nome, com ou sem o número: `generate_issues` e
 *  `04_generate_issues` chegam no mesmo lugar. O número é a ORDEM, e ordem
 *  muda — quem digita não deveria ter que saber a de hoje.
 */
export function find(name: string, dir = WORKFLOWS): { category: string; workflow: string } | undefined {
  const pairs = categories(dir).flatMap((category) => workflows(category, dir).map((workflow) => ({ category, workflow })))
  // Nome EXATO primeiro. Dois workflows podem carregar o mesmo nome depois do
  // número — `00_product/03_research` e `02_system/012_research` existem — e
  // sem esta passada o slug completo caía no relaxado e devolvia o outro,
  // calado. Medido em 17/08 pedindo `012_research` e recebendo o `03_research`.
  const exact = pairs.find((p) => p.workflow === name || p.workflow.split('/').pop() === name)
  if (exact) return exact
  const wanted = name.replace(/^\d+_/, '')
  const loose = pairs.filter((p) => (p.workflow.split('/').pop() ?? '').replace(/^\d+_/, '') === wanted)
  // Ambíguo é ERRO, não sorteio: devolver o primeiro é como se pede um e se
  // trabalha no outro por meia hora.
  if (loose.length > 1)
    throw new Error(`"${name}" matches ${loose.length}: ${loose.map((p) => `${p.category}/${p.workflow}`).join(', ')} — use the full slug`)
  return loose[0]
}

/** Resolve uma categoria com ou sem o número, do mesmo jeito e pelo mesmo motivo. */
export function category(name: string, dir = WORKFLOWS): string | undefined {
  const all = categories(dir)
  return all.includes(name) ? name : all.find((c) => c.replace(/^\d+_/, '') === name.replace(/^\d+_/, ''))
}

/** O `CONTEXT.md`, verbatim — contrato, nunca resumo. */
export function body(category: string, workflow: string, dir = WORKFLOWS): string {
  return readFileSync(join(dir, category, workflow, 'CONTEXT.md'), 'utf8').trimEnd()
}

/**
 *  A primeira linha de PROSA depois do frontmatter — a descrição de uma linha.
 *
 *  Ela pode estar dentro de um `<!-- -->`: é onde os steps de `02_system/`
 *  escrevem a deles. O que não vale é a linha do MEIO de um comentário ou de um
 *  bloco de código — foi o que a primeira versão imprimiu ("```mermaid", e meia
 *  frase de 001_user_prompt), porque só olhava o começo da linha.
 */
export function summary(category: string, workflow: string, dir = WORKFLOWS): string {
  const lines = body(category, workflow, dir).split('\n')
  const start = lines[0] === '---' ? lines.indexOf('---', 1) + 1 : 0

  let fence = false
  for (const raw of lines.slice(start)) {
    const line = raw.replace(/^<!--\s*/, '').trim()
    if (raw.trim().startsWith('```')) fence = !fence
    if (fence || !line || line.startsWith('#') || line.startsWith('|') || line.startsWith('```')) continue
    return line.replace(/^[-*>\s]+/, '').slice(0, 78)
  }
  return ''
}
