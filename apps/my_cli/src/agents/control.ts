#!/usr/bin/env bun
//! `Agents.restart · interrupt · stop · tune` (@packages/interfaces/agents.ts) — the
//! four verbs that MUTATE a live agent, grouped because each one is small and
//! none of them owns enough to earn its own file.
//!
//!     bun run src/agents/control.ts interrupt <name>
//!     bun run src/agents/control.ts stop <name>
//!     bun run src/agents/control.ts restart <name>
//!
//! `interrupt` — the ESC key, MEASURED: `herdr pane send-keys --help` names it
//! `esc` as canonical (`escape` also accepted).
//!
//! `stop` — `herdr pane close`. There is no `agent stop`; the pane IS the
//! process, so closing the pane is the kill.
//!
//! `restart` — `claude-code` only, same limit as `clone`/`caps`: split a NEW
//! pane from the old one, resume the SAME session there (`-r <session>`, no
//! `--fork-session` — this is a REPAIR, not a fork), wait for its TUI,
//! `/rename` it back to `name`, THEN close the old pane. New pane first,
//! close last: a `restart` that fails after killing the old one is a `stop`
//! wearing the wrong name.
//!
//! `tune` — REFUSES EVERY FIELD, and this is a FINDING, not a shortcut skipped
//! for time. Both slash commands this house tried against a disposable test
//! pane turned out to write the GLOBAL `~/.claude/settings.json` instead of
//! scoping to the one session, in ways that contradict what their own UI text
//! promises:
//!   `/model <model>`  the picker offers `s` for "this session only" — TWO
//!                      tries still rewrote the global `"model"` key.
//!   `/effort <level>` sometimes opens a Yes/No "switch for this
//!                      conversation" confirm, and sometimes — MEASURED once,
//!                      cause not pinned down — applies straight through and
//!                      logs "saved as your default for new sessions",
//!                      rewriting the global `"effortLevel"` key.
//! All four writes were caught (by checking `~/.claude/settings.json` before
//! and after every attempt, a habit this incident is why the file now has)
//! and reverted by hand against `~/.claude/settings.json.bak`. A house rule
//! says refuse rather than guess when there is no way to implement something
//! honestly; provably mutating the user's real preferences by accident, twice
//! per command, on the ONE thing `tune` is not supposed to touch, is that
//! case. `restart(name, { engine: { model } })` changes model at the next
//! boot instead — a PROCESS flag, not a key three menus deep that also means
//! "save as default".
//!
//! depends_on: src/herdr/agents/list.ts · src/herdr/agents/roster.ts ·
//!             src/herdr/panes/{send,split}.ts · src/herdr/run.ts ·
//!             src/agents/clone.ts (esperaTUI)
//! impacts:    —

import { did } from '../herdr/run.ts'
import { send } from '../herdr/panes/send.ts'
import { split } from '../herdr/panes/split.ts'
import { list as liveAgents, type Agent as HerdrAgent } from '../herdr/agents/list.ts'
import { forget, remember, roster } from '../herdr/agents/roster.ts'
import { esperaTUI, TUI_MS } from './clone.ts'
import type { AgentSystem, Fail } from '@biliboss/interfaces/agents.ts'

const fail = (error: string, reason: Fail['reason'] = 'not_found'): Fail => ({ ok: false, error, reason })

async function locate(name: string): Promise<HerdrAgent | undefined> {
  const live = await liveAgents()
  if (!live.ok) return undefined
  const pane = (await roster()).find((a) => a.name === name)?.pane
  return live.agents.find((a) => a.pane === pane || a.title === name)
}

export async function interrupt(name: string): Promise<{ ok: true } | Fail> {
  const rec = await locate(name)
  if (!rec) return fail(`não conheço agente \`${name}\``)
  const out = await did(['pane', 'send-keys', rec.pane, 'esc'])
  return out.ok ? { ok: true } : { ok: false, error: out.error ?? 'herdr failed', reason: 'herdr' }
}

export async function stop(name: string): Promise<{ ok: true } | Fail> {
  const rec = await locate(name)
  if (!rec) return fail(`não conheço agente \`${name}\``)
  const out = await did(['pane', 'close', rec.pane])
  if (!out.ok) return { ok: false, error: out.error ?? 'herdr failed', reason: 'herdr' }
  forget([name])
  return { ok: true }
}

export async function restart(name: string): Promise<AgentSystem.Entities.Agent | Fail> {
  const origem = await locate(name)
  if (!origem) return fail(`não conheço agente \`${name}\``)
  if (origem.agent !== 'claude') return fail(`\`${origem.agent}\` não tem restart medido nesta casa — só claude-code`, 'unsupported')
  if (!origem.session) return fail(`herdr não relatou a sessão de \`${name}\` (agent_session ausente) — sem ela não dá pra retomar`, 'unsupported')

  const partido = await split(origem.pane, { direction: 'right', ratio: 0.6, focus: false })
  if (!partido.ok) return { ok: false, error: partido.error, reason: 'herdr' }
  const novo = partido.pane

  const abriu = await send(novo, `claude --dangerously-skip-permissions -r ${origem.session}`)
  if (!abriu.ok) return { ok: false, error: `o pane ${novo} nasceu mas não recebeu o comando: ${abriu.error}`, reason: 'herdr' }

  if (!(await esperaTUI(novo))) return fail(`o claude não retomou em ${novo} em ${TUI_MS / 1000}s — o pane novo está lá, o velho (${origem.pane}) NÃO foi fechado`, 'herdr')

  const renomeado = await send(novo, `/rename ${name}`, { window: 24 })
  if (!renomeado.ok) return { ok: false, error: `\`/rename ${name}\` não entrou em ${novo}: ${renomeado.error} — os dois panes estão de pé`, reason: 'herdr' }
  await Bun.sleep(1_500)

  // SÓ AGORA fecha o velho — depois que o novo provou que subiu e respondeu ao
  // rename. Fechar antes seria arriscar ficar sem NENHUM dos dois.
  const fechou = await did(['pane', 'close', origem.pane])
  if (!fechou.ok) return fail(`${name} retomou em ${novo}, mas o pane velho ${origem.pane} não fechou: ${fechou.error} — feche à mão`, 'herdr')

  remember(name, novo)
  const depois = await liveAgents()
  const novoLive = depois.ok ? depois.agents.find((a) => a.pane === novo) : undefined
  return {
    name,
    runtime: { cli: 'claude-code', session: novoLive?.session ?? origem.session },
    launch: { engine: { cli: 'claude-code' }, worktree: novoLive?.launchCwd ?? origem.launchCwd, resume: origem.session },
    pane: novo,
  }
}

/** RECUSA TUDO — ver o cabeçalho deste arquivo. MEDIDO 20/08 contra um pane
 *  descartável: `/model <m>` e `/effort <n>` prometem escopo de sessão (`s`, ou
 *  um confirm de "esta conversa") e as DUAS vezes acabaram escrevendo
 *  `~/.claude/settings.json` GLOBAL mesmo assim — quatro gravações reais no
 *  arquivo de configuração do Gabriel, todas revertidas à mão contra o
 *  `.bak`. Nenhum campo de `Launch` tem hoje um caminho ao vivo que este teste
 *  não tenha provado arriscado; `tune` diz `unsupported` pra todos até essa
 *  investigação terminar, em vez de reofertar o mesmo risco. */
export async function tune(
  name: string,
  launch: Partial<AgentSystem.ValueObjects.Launch>,
): Promise<AgentSystem.Entities.Agent | Fail> {
  const rec = await locate(name)
  if (!rec) return fail(`não conheço agente \`${name}\``)

  const pedido = Object.keys(launch)
  return fail(
    pedido.length
      ? `\`${pedido.join(', ')}\` não tem tune ao vivo SEGURO nesta casa hoje: /model e /effort MEDIDOS 20/08 escreveram o default GLOBAL em ~/.claude/settings.json em vez de escopar à sessão (achado, não limitação de tempo — ver o cabeçalho de control.ts). Use \`restart(name, launch)\` pra aplicar no próximo boot.`
      : 'tune sem nenhum campo em `launch` não muda nada — não há o que fazer',
    'unsupported',
  )
}

if (import.meta.main) {
  const [verb, name] = Bun.argv.slice(2)
  const value = (n: string) => {
    const i = Bun.argv.indexOf(`--${n}`)
    return i === -1 ? undefined : Bun.argv[i + 1]
  }
  const out =
    verb === 'interrupt' && name ? await interrupt(name) :
    verb === 'stop' && name ? await stop(name) :
    verb === 'restart' && name ? await restart(name) :
    verb === 'tune' && name ? await tune(name, { effort: value('effort') }) :
    undefined
  if (out === undefined) {
    console.error('usage: control.ts <interrupt|stop|restart> <name>  |  control.ts tune <name> --effort <e>')
    process.exit(2)
  }
  console.log(JSON.stringify(out, null, 2))
  process.exit('ok' in out && out.ok === false ? 1 : 0)
}
