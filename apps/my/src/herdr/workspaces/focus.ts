#!/usr/bin/env bun
//! Traz um workspace pra frente.
//!
//!     bun run src/herdr/workspaces/focus.ts cockpit
//!
//! CERCADO, apesar de não mudar nada em disco: `block` quer dizer deixa esse em
//! paz, e arrancar a tela de alguém pra um workspace que ele cercou É tocar nele.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts · src/herdr/workspaces/resolve.ts
//! impacts:    src/herdr/workspaces/CONTEXT.md

import { focus } from "@biliboss/herdr/workspaces/focus";

if (import.meta.main) {
  const out = await focus(Bun.argv[2] ?? '')
  console.log(out.ok ? out.id : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
