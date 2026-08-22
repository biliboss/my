#!/usr/bin/env bun
//! Abre uma aba.
//!
//!     bun run src/herdr/tabs/create.ts --workspace cockpit --label revisao
//!
//! O workspace é resolvido por id OU label antes de qualquer coisa, então a
//! cerca é checada contra o id real e não contra o que foi digitado.
//!
//! Sem `--workspace` o herdr usa a que está em foco. Certo pra um humano no
//! terminal, errado pra script: passe explícito quando for código.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts · src/herdr/workspaces/resolve.ts · src/shared/argv.ts
//! impacts:    src/herdr/agents/start.ts

import { create } from "@biliboss/herdr/tabs/create";
import { value } from "@biliboss/shared/argv";

if (import.meta.main) {
  const out = await create({ workspace: value('workspace'), label: value('label'), cwd: value('cwd') })
  console.log(out.ok ? `${out.id} ${out.pane}` : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
