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

import type { AgentSystem, Fail } from '@biliboss/interfaces/agents.ts'
import { startWhenReady } from "@biliboss/herdr/agents/start"
import { remember } from "@biliboss/herdr/agents/roster"
import { find } from './view.ts'

export async function start(
  name: string,
  where: AgentSystem.ValueObjects.Placement,
  launch: AgentSystem.ValueObjects.Launch = {},
): Promise<AgentSystem.Entities.Agent | Fail> {
  const cli = launch.engine?.cli ?? 'claude-code'
  if (cli !== 'claude-code') {
    return { ok: false, error: `\`${cli}\` ainda não tem os defaults de start medidos — só \`claude-code\` roda hoje`, reason: 'unsupported' }
  }

  const out = await startWhenReady(name, {
    workspace: where.workspace,
    pane: where.pane,
    tab: where.tab,
    cwd: where.cwd,
    prompt: where.prompt,
    model: launch.engine?.model,
    effort: launch.effort,
  })
  if (!out.ok) return { ok: false, error: out.error, reason: out.reason }

  remember(name, out.pane)

  const agent = await find(name)
  if (!agent) return { ok: false, error: `${name} subiu em ${out.pane}, mas não apareceu na frota logo em seguida`, reason: 'herdr' }
  return agent
}

if (import.meta.main) {
  const name = Bun.argv[2]
  const value = (n: string) => {
    const i = Bun.argv.indexOf(`--${n}`)
    return i === -1 ? undefined : Bun.argv[i + 1]
  }
  if (!name || !value('prompt')) {
    console.error('usage: start.ts <name> (--workspace <id|label> | --pane <id>) --prompt <text> [--model <m>] [--effort <e>]')
    process.exit(2)
  }
  start(
    name,
    { workspace: value('workspace'), pane: value('pane'), tab: value('tab'), cwd: value('cwd'), prompt: value('prompt')! },
    { engine: { cli: 'claude-code', model: value('model') }, effort: value('effort') },
  ).then((out) => {
    console.log(JSON.stringify(out, null, 2))
    process.exit('ok' in out && out.ok === false ? 1 : 0)
  })
}
