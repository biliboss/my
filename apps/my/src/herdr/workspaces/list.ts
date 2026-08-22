#!/usr/bin/env bun
//! Os workspaces do herdr, achatados e vestindo as marcas desta casa.
//!
//!     my herdr workspaces list                   os visíveis
//!     my herdr workspaces list --hidden          com os que a cortina esconde
//!     my herdr workspaces list --agents          com quantos agentes cada um tem
//!     my herdr workspaces list --empty           só os que não têm agente nenhum
//!     my herdr workspaces list --staffed         só os que têm
//!     my herdr workspaces list --empty --remote fonseca-vps
//!
//! `--agents` custa uma segunda chamada ao herdr, então é opt-in. O `status` do
//! workspace NÃO responde isto: ele fica `unknown` num workspace sem agente
//! nenhum, que é a mesma coisa que um agente que ninguém conseguiu classificar.
//!
//! O envelope cru é `{id, result: {type, workspaces: [...]}}` com snake_case e um
//! `worktree` aninhado. Achatar AQUI, e não em quem chama, mantém a forma nossa:
//! um upgrade do herdr que renomeia campo é uma edição.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts · src/shared/argv.ts
//! impacts:    src/herdr/workspaces/resolve.ts · src/herdr/workspaces/close.ts

import { list } from "@my/herdr/workspaces/list";
import { has } from "@my/shared/argv";

if (import.meta.main) {
  const empty = has('empty')
  const staffed = has('staffed')
  if (empty && staffed) {
    console.error('--empty e --staffed pedem coisas opostas: escolha uma')
    process.exit(2)
  }

  const out = await list({ includeHidden: has('hidden'), withAgents: empty || staffed || has('agents') })
  if (!out.ok) {
    console.error(`✗ ${out.error}`)
    process.exit(1)
  }

  let rows = out.workspaces
  if (empty) rows = rows.filter((w) => w.agents === 0)
  if (staffed) rows = rows.filter((w) => (w.agents ?? 0) > 0)

  for (const w of rows) {
    const mark = w.blocked ? '⊘' : w.hidden ? '·' : ' '
    // `—` and not `0` when the count is missing: the fleet could not be read, and
    // printing zero would state something nobody measured.
    const crew = w.agents === undefined ? '' : ` ${w.agents === 0 ? '—' : `${w.agents}a`}`
    console.log(`${mark} ${w.id.padEnd(6)} ${w.label.padEnd(24)} ${w.status.padEnd(8)} ${w.tabs}t ${w.panes}p${crew}`)
  }

  if (empty || staffed) console.log(`\n${rows.length} de ${out.workspaces.length} ${empty ? 'sem agente' : 'com agente'}`)
}
