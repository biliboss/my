#!/usr/bin/env bun
//! `Agents.start` (@packages/interfaces/agents.ts) — start one, named, and REMEMBER it.
//!
//!     bun run src/agents/start.ts alice --workspace cockpit --prompt "afira a #178"
//!     bun run src/agents/start.ts qa --pane w3K:p4 --prompt "roda os testes"
//!
//! `src/herdr/agents/start.ts` already does the hard part — verified boot, the
//! `MY_AGENT` env, the `--prompt`/`--system` `@file` convention — and this house
//! rule says NOT to rewrite it. What it does not do is the ROSTER: it hands back
//! a pane and forgets the name the moment the process returns. `remember()`
//! (`src/herdr/agents/roster.ts`) is the missing half, and `toEntity` (`list.ts`)
//! is what turns the pair into the contract's `Agent`.
//!
//! ONLY `claude-code` today. `herdr/agents/start.ts`'s `--kind` defaults to
//! `claude` and every other DEFAULT in that file (`--model opus`, `--effort
//! medium`, `--dangerously-skip-permissions`) is written for it; wiring `pi` or
//! `codex` through the same argv shape without measuring their own flags would be
//! the guess this house's rule against `unsupported` exists to name instead of
//! hide.
//!
//! depends_on: src/herdr/agents/start.ts · src/herdr/agents/roster.ts · src/agents/list.ts
//! impacts:    —
//!
//! O domínio mora em `@my/agents`; aqui fica só o que a CLI imprime.

import { Command } from "commander";

import { agents } from "@my/agents";

export async function main(argv: string[]): Promise<number> {
  const name = argv[0]
  const value = (n: string) => {
    const i = argv.indexOf(`--${n}`)
    return i === -1 ? undefined : argv[i + 1]
  }
  if (!name || !value('prompt')) {
    console.error('usage: my agents start <name> (--workspace <id|label> | --pane <id>) --prompt <text> [--model <m>] [--effort <e>]')
    return 2
  }
  const out = await agents.control.start(
    name,
    { workspace: value('workspace'), pane: value('pane'), tab: value('tab'), cwd: value('cwd'), prompt: value('prompt')! },
    { engine: { cli: 'claude-code', model: value('model') }, effort: value('effort') },
  )
  console.log(JSON.stringify(out, null, 2))
  return 'ok' in out && out.ok === false ? 1 : 0
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
