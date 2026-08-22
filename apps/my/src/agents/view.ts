#!/usr/bin/env bun
//! `View` (@packages/interfaces/agents.ts): `find`, `health`, `screen`, `log`, `caps` —
//! everything that ANSWERS about the fleet without touching it. `agents.list.all()` and the
//! entity mapper live in `list.ts` (it already owned the herdr↔name join); this
//! file is the rest of `View` plus the two verbs measured instead of declared.
//!
//!     bun run src/agents/view.ts find <name>
//!     bun run src/agents/view.ts health <name>
//!     bun run src/agents/view.ts screen <name>
//!     bun run src/agents/view.ts log <name>
//!     bun run src/agents/view.ts caps <cli>
//!
//! `agents.view.log(name)` — FOUR VENDORS, FOUR LAYOUTS, measured on this disk 20/08 and not
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
//!                vendor `agents.view.log()` actually resolves today.
//!
//! `agents.view.caps(cli)` — MEASURED by spawning `<bin> --help` and grepping the real flags,
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
//!
//! O domínio mora em `@my/agents`; aqui fica só o que a CLI imprime.

import { Command } from "commander";

import { agents } from "@my/agents";

export async function main(argv: string[]): Promise<number> {
  const [verb, arg] = argv
  const out =
    verb === 'find' ? await agents.list.find(arg ?? '') :
    verb === 'health' ? await agents.view.health(arg ?? '') :
    verb === 'screen' ? await agents.view.screen(arg ?? '') :
    verb === 'log' ? await agents.view.log(arg ?? '') :
    verb === 'caps' ? await agents.view.caps(arg ?? '') :
    undefined
  if (out === undefined) {
    console.error('usage: my agents view <find|health|screen|log|caps> <name-or-cli>')
    return 2
  }
  console.log(JSON.stringify(out, null, 2))
  return typeof out === 'object' && out !== null && 'ok' in out && (out as { ok: boolean }).ok === false ? 1 : 0
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
