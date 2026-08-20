#!/usr/bin/env bun
//! `View` (@packages/interfaces/agents.ts): `find`, `health`, `screen`, `log`, `caps` —
//! everything that ANSWERS about the fleet without touching it. `all()` and the
//! entity mapper live in `list.ts` (it already owned the herdr↔name join); this
//! file is the rest of `View` plus the two verbs measured instead of declared.
//!
//!     bun run src/agents/view.ts find <name>
//!     bun run src/agents/view.ts health <name>
//!     bun run src/agents/view.ts screen <name>
//!     bun run src/agents/view.ts log <name>
//!     bun run src/agents/view.ts caps <cli>
//!
//! `log(name)` — FOUR VENDORS, FOUR LAYOUTS, measured on this disk 20/08 and not
//! assumed:
//!
//!   claude-code  `~/.claude/projects/<cwd-with-/-as-->/<session>.jsonl`
//!                verified: `agent_session.value` from `herdr agent list` IS the
//!                filename, byte for byte (checked against a live pane).
//!   pi           `~/.pi/agent/sessions/--<cwd-with-/-as-->--/<ISO>_<uuid>.jsonl`
//!                the session id is in the FILENAME, but herdr's `agent list` never
//!                fills `agent_session` for a `pi` pane (measured live: a `pi` entry
//!                carries no such field at all) — so which of N files in that
//!                folder is THIS pane is unknown, and picking one would be the
//!                guess the house rule forbids. Refuses with `unsupported`.
//!   codex        `~/.codex/sessions/YYYY/MM/DD/rollout-<ISO>-<uuid>.jsonl`, same
//!                gap: herdr does not expose codex's session id either. Refuses.
//!   gemini       `~/.gemini/tmp/<opaque>/logs.json` — ONE file per PROJECT, not
//!                per session, keyed by a `.project_root` file beside it that holds
//!                the real cwd. No session id needed at all, so this is the one
//!                vendor `log()` actually resolves today.
//!
//! `caps(cli)` — MEASURED by spawning `<bin> --help` and grepping the real flags,
//! against the four binaries installed on this machine 20/08:
//!   claude  `--fork-session`                          → native
//!   pi      `--fork <path|id>`                         → native
//!   codex   a `fork` subcommand                        → native
//!   gemini  `--session-file` + `--session-id`, no fork  → emulated
//! A binary missing from PATH answers `not_found`, never a guessed `false`.
//!
//! depends_on: src/interfaces/agents.ts · src/herdr/agents/list.ts ·
//!             src/herdr/agents/roster.ts · src/herdr/panes/read.ts · src/agents/list.ts
//! impacts:    src/agents/start.ts · src/agents/control.ts · src/agents/clone.ts

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentSystem, Fail } from '@biliboss/interfaces/agents.ts'
import { list as liveAgents, type Agent as HerdrAgent } from '../herdr/agents/list.ts'
import { roster } from '../herdr/agents/roster.ts'
import { read } from '../herdr/panes/read.ts'
import { all } from './list.ts'

const fail = (error: string, reason: Fail['reason'] = 'not_found'): Fail => ({ ok: false, error, reason })

/** THE ONE NAME→PANE RESOLUTION every verb below shares with `all()`/`find()`: a
 *  roster name when `Agents.start` remembered one, else the pane's own stripped
 *  title — the same fallback `my agents list` already displays as identity for
 *  every agent nobody named through the roster. Splitting this from `find()`
 *  saves every OTHER verb here from re-deriving it its own way, which is how
 *  `health`/`screen` first ended up seeing only rostered agents while `find` saw
 *  all of them — same name, two different answers. */
async function locate(name: string): Promise<HerdrAgent | undefined> {
  const live = await liveAgents()
  if (!live.ok) return undefined
  const rosterPane = (await roster()).find((a) => a.name === name)?.pane
  return live.agents.find((a) => a.pane === rosterPane || a.title === name)
}

/** The live entity for a roster NAME — `undefined` when that name resolves to
 *  nothing, per contract (`find` never fails, it just may find nothing). */
export async function find(name: string): Promise<AgentSystem.Entities.Agent | undefined> {
  return (await all()).find((a) => a.name === name)
}

/** herdr's own vocabulary (`idle · working · blocked · done · unknown`, measured
 *  via `herdr agent wait --help`) folded onto the four this house named in the
 *  contract. `done` and `idle` both mean "no work in flight right now", which is
 *  `waiting`. `stuck` is deliberately NEVER produced here: telling it apart from
 *  `working` needs two screen reads over time, not one — this is a single herdr
 *  call, and guessing `stuck` off one sample would be worse than not offering it. */
function toHealth(status: string): AgentSystem.ValueObjects.Health {
  if (status === 'working') return 'working'
  if (status === 'blocked') return 'blocked'
  if (status === 'idle' || status === 'done') return 'waiting'
  // `unknown` — herdr saw the pane but could not classify it. Closest honest
  // bucket: not confirmed working, not confirmed gone.
  return 'waiting'
}

export async function health(name: string): Promise<AgentSystem.ValueObjects.Health | Fail> {
  const rec = await locate(name)
  if (!rec) return fail(`não conheço agente \`${name}\` — \`my agents list\` mostra os vivos`)
  return toHealth(rec.status)
}

export async function screen(name: string): Promise<{ ok: true; text: string } | Fail> {
  const rec = await locate(name)
  if (!rec) return fail(`não conheço agente \`${name}\``)
  const out = await read(rec.pane)
  return out.ok ? out : { ok: false, error: out.error, reason: 'herdr' }
}

/** `/Users/x/src/me` → `-Users-x-src-me`, the slug every one of the three
 *  filesystem vendors below builds their own project folder from. */
const slug = (cwd: string) => cwd.replace(/\//g, '-')

/** gemini keys its project folder by an OPAQUE name, never the path itself — so
 *  resolving it means reading every `.project_root` file and matching by VALUE,
 *  not guessing the folder name from the cwd. */
function geminiProjectDir(cwd: string): string | undefined {
  const root = join(homedir(), '.gemini', 'tmp')
  if (!existsSync(root)) return undefined
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const marker = join(root, entry.name, '.project_root')
    if (existsSync(marker) && readFileSync(marker, 'utf8').trim() === cwd) return join(root, entry.name)
  }
  return undefined
}

export async function log(name: string): Promise<{ ok: true; path: string } | Fail> {
  const entry = await locate(name)
  if (!entry) return fail(`não conheço agente \`${name}\` — \`my agents list\` mostra os vivos`)

  const cli = entry.agent

  if (cli === 'claude') {
    if (!entry.session) return fail(`herdr não relatou a sessão do claude para \`${name}\` (agent_session ausente)`, 'unsupported')
    const path = join(homedir(), '.claude', 'projects', slug(entry.launchCwd), `${entry.session}.jsonl`)
    return existsSync(path) ? { ok: true, path } : fail(`esperava o transcript em ${path}, e não está lá`)
  }

  if (cli === 'gemini') {
    const dir = geminiProjectDir(entry.launchCwd)
    if (!dir) return fail(`gemini nunca rodou em ${entry.launchCwd} (nenhum \`.project_root\` bate)`)
    const path = join(dir, 'logs.json')
    return existsSync(path) ? { ok: true, path } : fail(`${dir} existe, mas sem logs.json`)
  }

  if (cli === 'pi' || cli === 'codex') {
    // O id da sessão mora no NOME do arquivo (pi: `<ISO>_<uuid>.jsonl`; codex:
    // `rollout-<ISO>-<uuid>.jsonl`), e o herdr não relata esse id pra nenhum dos
    // dois hoje (medido: `agent_session` só aparece pra `claude` em `agent list`).
    // Escolher um arquivo entre vários seria chutar — a casa proíbe.
    return fail(`\`${cli}\` não expõe sessão pelo herdr hoje — sem ela não dá pra escolher o arquivo certo em \`~/.${cli === 'pi' ? 'pi/agent/sessions' : 'codex/sessions'}\` sem chutar`, 'unsupported')
  }

  return fail(`\`${cli}\` é um CLI que esta casa ainda não mapeou transcript nenhum`, 'unsupported')
}

const BIN: Record<string, string> = { 'claude-code': 'claude', pi: 'pi', codex: 'codex', gemini: 'gemini' }
const HELP_TIMEOUT_MS = 5000

export async function caps(
  cli: string,
): Promise<{ ok: true; fork: AgentSystem.ValueObjects.ForkSupport } | (Fail & { reason: 'not_found' | 'unsupported' })> {
  const bin = BIN[cli] ?? cli
  let out: string
  try {
    const child = Bun.spawn([bin, '--help'], { stdout: 'pipe', stderr: 'pipe', timeout: HELP_TIMEOUT_MS })
    const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()])
    await child.exited
    if (child.exitedDueToTimeout) return { ok: false, error: `\`${bin} --help\` travou depois de ${HELP_TIMEOUT_MS}ms`, reason: 'unsupported' }
    out = stdout + stderr
  } catch (err) {
    // Binário ausente do PATH cai aqui — "não sei porque não tenho", não `false`.
    return { ok: false, error: `não tenho \`${bin}\` instalado — ${err instanceof Error ? err.message : String(err)}`, reason: 'not_found' }
  }

  const native = /--fork-session\b/.test(out) || /^\s*fork\s/m.test(out) || /--fork\s*</.test(out)
  if (native) return { ok: true, fork: 'native' }

  const emulated = /--session-file\b/.test(out) && /--session-id\b/.test(out)
  if (emulated) return { ok: true, fork: 'emulated' }

  return { ok: true, fork: 'none' }
}

if (import.meta.main) {
  const [verb, arg] = Bun.argv.slice(2)
  const out =
    verb === 'find' ? await find(arg ?? '') :
    verb === 'health' ? await health(arg ?? '') :
    verb === 'screen' ? await screen(arg ?? '') :
    verb === 'log' ? await log(arg ?? '') :
    verb === 'caps' ? await caps(arg ?? '') :
    undefined
  if (out === undefined) {
    console.error('usage: view.ts <find|health|screen|log|caps> <name-or-cli>')
    process.exit(2)
  }
  console.log(JSON.stringify(out, null, 2))
  process.exit(typeof out === 'object' && out !== null && 'ok' in out && (out as { ok: boolean }).ok === false ? 1 : 0)
}
