#!/usr/bin/env bun
//! QUEM está com a task, escrito por quem pegou — e verificável antes de agir.
//!
//!     `my teams claim` 3                  pega a 003: trava atômica + identidade inteira
//!     `my teams claim` 3 --check          exit 0 SÓ se a trava for minha
//!     `my teams claim` 3 --release        solta (recusa se for de outro; `--force` passa por cima)
//!     `my teams claim` 3 --meta lote=faxina --meta prioridade=alta
//!     `my teams claim` 3 --json           a identidade gravada, pro jq
//!
//! A TRAVA É A MESMA DO `start` — `<task>/.doing/`, criada com `mkdirSync` sem
//! `recursive`, que falha com EEXIST e é atômica no filesystem. O que este verbo
//! acrescenta é o CRACHÁ dentro dela (`.doing/claim.json`): sessão do Claude,
//! pane/aba/workspace do herdr, agente, host, pid, cwd e o que vier em `--meta`.
//! Duas sentinelas (`.doing` e um `.claim` ao lado) seriam duas verdades sobre a
//! mesma pergunta, e a segunda é sempre a que fica velha.
//!
//! POR QUE O CRACHÁ IMPORTA: sem ele, `.doing/` só diz "alguém pegou". Um worker
//! que morreu no meio e um worker que está trabalhando produzem a MESMA pasta
//! vazia, e o próximo agente não tem como saber se a task é dele. Com o crachá,
//! `--check` responde "é minha" com o mesmo critério em todo lugar, e o `start`
//! deixa de recusar a própria continuação.
//!
//! A IDENTIDADE CASA POR CAMADAS, e a primeira que os dois lados têm decide:
//! `claude_session` (o executor), depois `herdr_pane` (o lugar), depois
//! `host+pid`. Comparar tudo faria um `cd` invalidar o crachá; comparar só o host
//! faria duas sessões da mesma máquina se confundirem.
//!
//! depends_on: src/shared/work/model.ts
//! impacts:    src/shared/work/start.ts

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { join } from 'node:path'
import { type Task, acharTask, agora, devolver, lembra, projetoCorrente, projetos, puxar, rel } from './model.ts'

/** O nome da sentinela — a MESMA que `my kanban move` cria. */
export const TRAVA = '.doing'
export const CRACHA = 'claim.json'

export type Cracha = Record<string, string> & { at: string }

/** Quem sou eu, agora, com tudo que o ambiente publica sobre isso. Campo vazio
 *  não entra: crachá com dez chaves em branco esconde as três que valem. */
export function identidade(extra: Record<string, string> = {}): Cracha {
  const campos: Record<string, string | undefined> = {
    claude_session: process.env.CLAUDE_CODE_SESSION_ID,
    herdr_pane: process.env.HERDR_PANE_ID,
    herdr_tab: process.env.HERDR_TAB_ID,
    herdr_workspace: process.env.HERDR_WORKSPACE_ID,
    agent: process.env.MY_AGENT ?? process.env.AI_AGENT,
    host: hostname(),
    pid: String(process.env.CLAUDE_PID ?? process.pid),
    cwd: process.cwd(),
    ...extra,
  }
  const c: Cracha = { at: agora() }
  for (const [k, v] of Object.entries(campos)) if (v) c[k] = v
  return c
}

/** As camadas de identidade, da mais específica pra menos. A primeira que os
 *  DOIS lados declaram é a que decide — e se nenhuma casar, a resposta é não. */
const CAMADAS = ['claude_session', 'herdr_pane', 'pid'] as const

export function ehMinha(c: Cracha | undefined, eu = identidade()): boolean {
  if (!c) return false
  for (const k of CAMADAS) if (c[k] && eu[k]) return c[k] === eu[k] && (k !== 'pid' || c.host === eu.host)
  return false
}

export const crachaDe = (dirTask: string): Cracha | undefined => {
  const f = join(dirTask, TRAVA, CRACHA)
  if (!existsSync(f)) return undefined
  try {
    return JSON.parse(readFileSync(f, 'utf8'))
  } catch {
    // Crachá ilegível é crachá de outro: o dono escreveu e morreu, ou alguém
    // editou à mão. Tratar como MEU seria roubar a task na primeira corrupção.
    return { at: '?', corrompido: 'sim' }
  }
}

/** PEGA a task: trava, PUXA pra `in_progress/` e grava o crachá. Devolve o
 *  crachá e a pasta NOVA — a pasta muda, e quem chamou precisa saber pra onde.
 *
 *  A ORDEM É TRAVA → MOVE, e não o contrário. A trava mora DENTRO da pasta, e é
 *  ela que decide quem ganhou a corrida; mover antes deixaria dois agentes
 *  chamando `renameSync` no mesmo caminho, e o segundo estoura com ENOENT em vez
 *  de receber uma recusa legível. Travado, o `mv` é do vencedor e leva a trava
 *  junto — por isso o crachá só é escrito no caminho NOVO.
 *
 *  Esta é a função; `main` abaixo é só a casca que traduz argv e imprime. */
export function claim(t: Task, extra: Record<string, string> = {}): { cracha: Cracha; dir: string } | { erro: string } {
  const eu = identidade(extra)
  const dono = crachaDe(t.dir)
  try {
    mkdirSync(join(t.dir, TRAVA))
  } catch {
    // Já travada: se for MINHA, isto é continuação e não colisão — o crachá é
    // reescrito com o `at` de agora, e quem chamou segue.
    if (!ehMinha(dono, eu))
      return {
        erro: `${t.slug} já é de ${dono?.claude_session ?? dono?.herdr_pane ?? 'outro agente'} desde ${dono?.at ?? '?'}\n  se ele morreu: \`my teams claim ${t.nnn} --release --force\``,
      }
  }
  const dir = puxar(t.dir)
  writeFileSync(join(dir, TRAVA, CRACHA), `${JSON.stringify(eu, null, 2)}\n`)
  return { cracha: eu, dir }
}

/** SOLTA a trava e DEVOLVE a task pra fila — soltar sem mover deixaria a pasta
 *  dizendo "rodando" com ninguém dentro, que é o que estado-em-pasta veio
 *  impedir. Devolve a pasta nova. */
export function release(t: Task, force = false): { dir: string } | { erro: string } {
  const trava = join(t.dir, TRAVA)
  if (!existsSync(trava)) return { dir: t.dir }
  const dono = crachaDe(t.dir)
  if (!ehMinha(dono) && !force)
    return { erro: `${t.slug} é de outro (${dono?.claude_session ?? dono?.herdr_pane ?? '?'}) — só solte com --force se SOUBER que ele morreu` }
  rmSync(trava, { recursive: true })
  return { dir: devolver(t.dir) }
}

