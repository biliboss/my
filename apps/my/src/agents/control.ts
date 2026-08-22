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
//! case. `agents.control.restart(name, { engine: { model } })` changes model at the next
//! boot instead — a PROCESS flag, not a key three menus deep that also means
//! "save as default".
//!
//! depends_on: src/herdr/agents/list.ts · src/herdr/agents/roster.ts ·
//!             src/herdr/panes/{send,split}.ts · src/herdr/run.ts ·
//!             src/agents/clone.ts (esperaTUI)
//! impacts:    —
//!
//! O domínio mora em `@my/agents`; aqui fica só o que a CLI imprime.

import { Command } from "commander";

import { agents } from "@my/agents";

export async function main(argv: string[]): Promise<number> {
  const [verb, name] = argv
  const value = (n: string) => {
    const i = argv.indexOf(`--${n}`)
    return i === -1 ? undefined : argv[i + 1]
  }
  const out =
    verb === 'interrupt' && name ? await agents.control.interrupt(name) :
    verb === 'stop' && name ? await agents.control.stop(name) :
    verb === 'restart' && name ? await agents.control.restart(name) :
    verb === 'tune' && name ? await agents.control.tune(name, { effort: value('effort') }) :
    undefined
  if (out === undefined) {
    console.error('usage: my agents control <interrupt|stop|restart> <name>  |  tune <name> --effort <e>')
    return 2
  }
  console.log(JSON.stringify(out, null, 2))
  return 'ok' in out && out.ok === false ? 1 : 0
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
