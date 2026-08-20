#!/usr/bin/env bun
//! QUEM está com a task, escrito por quem pegou — e verificável antes de agir.
//!
//!     my tasks claim 3                  pega a 003: trava atômica + identidade inteira
//!     my tasks claim 3 --check          exit 0 SÓ se a trava for minha
//!     my tasks claim 3 --release        solta (recusa se for de outro; `--force` passa por cima)
//!     my tasks claim 3 --meta lote=faxina --meta prioridade=alta
//!     my tasks claim 3 --json           a identidade gravada, pro jq
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
//! depends_on: src/tasks/model.ts
//! impacts:    src/tasks/start.ts

import { Command } from 'commander'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { join } from 'node:path'
import { type Task, acharTask, agora, devolver, lembra, projetoCorrente, projetos, puxar, rel } from './model.ts'

/** O nome da sentinela — a MESMA que `my tasks start` cria. */
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
        erro: `${t.slug} já é de ${dono?.claude_session ?? dono?.herdr_pane ?? 'outro agente'} desde ${dono?.at ?? '?'}\n  se ele morreu: my tasks claim ${t.nnn} --release --force`,
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

export function command(): Command {
  const cmd = new Command('claim')
    .description('Trava a task e grava QUEM pegou — sessão, pane, agente, host, e o que vier em --meta.')
    .argument('<nnn>', 'o número da task — `3`, `03` ou `003`')
    .option('-P, --project <slug>', 'o projeto. Passado uma vez, fica lembrado — senão vem do cwd')
    .option('--meta <k=v>', 'metadado extra no crachá; repita', (v: string, acc: string[]) => [...acc, v], [] as string[])
    .option('--check', 'não pega nada: sai 0 se a trava existente for minha, 1 se não')
    .option('--release', 'solta a trava — recusa se o crachá for de outro')
    .option('--force', 'com --release: solta mesmo sendo de outro')
    .option('--json', 'o crachá, pro jq')
  cmd.addHelpText('after', '\n  Depois de pegar: my tasks start <nnn> --here — ele reconhece o crachá e segue.\n')
  return cmd
}

export function main(argv: string[]): number {
  const cmd = command().exitOverride()
  try {
    cmd.parse(argv, { from: 'user' })
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1
  }
  const [alvo] = cmd.args
  const opts = cmd.opts()

  const { slug, porque } = projetoCorrente(opts.project)
  if (!slug) return console.error(`de que projeto? \`-P <slug>\`\n  existem: ${projetos().join(', ')}`), 1
  if (porque !== 'último usado') lembra(slug)

  const t = acharTask(slug, alvo!)
  if ('erro' in t) return console.error(t.erro), 1
  const trava = join(t.dir, TRAVA)
  const dono = crachaDe(t.dir)
  const mostra = (c: Cracha) => (opts.json ? console.log(JSON.stringify(c)) : console.log(Object.entries(c).map(([k, v]) => `  ${k}: ${v}`).join('\n')))

  if (opts.check) {
    if (!existsSync(trava)) return console.error(`${t.slug} está livre — ninguém pegou`), 1
    if (!ehMinha(dono)) return console.error(`${t.slug} é de outro: ${dono?.claude_session ?? dono?.herdr_pane ?? 'crachá ausente'}`), 1
    mostra(dono!)
    return 0
  }

  if (opts.release) {
    if (!existsSync(trava)) return console.log(`${t.slug} já estava livre`), 0
    const solta = release(t, opts.force)
    if ('erro' in solta) return console.error(solta.erro), 1
    // Soltar é DESFAZER o puxão: a pasta volta pro `tasks/` da sprint, senão ela
    // ficaria em `in_progress/` sem dono — um "rodando" que ninguém está rodando.
    console.log(`${t.slug} solta — de volta em ${rel(solta.dir)}`)
    return 0
  }

  const extra = Object.fromEntries(
    (opts.meta as string[]).map((m) => {
      const i = m.indexOf('=')
      return i < 0 ? [m, 'sim'] : [m.slice(0, i), m.slice(i + 1)]
    }),
  )
  const pego = claim(t, extra)
  if ('erro' in pego) return console.error(pego.erro), 1
  if (!opts.json) console.log(`${t.nnn} ${t.titulo} — em ${rel(pego.dir)}`)
  mostra(pego.cracha)
  return 0
}

if (import.meta.main) process.exit(main(process.argv.slice(2)))
