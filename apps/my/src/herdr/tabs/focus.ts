#!/usr/bin/env bun
//! Traz uma aba pra frente: `bun run src/herdr/tabs/focus.ts w3K:t2`.
//!
//! Cercado por herança: `w3K:t2` nomeia o workspace dele, então bloquear `w3K`
//! bloqueia isto sem uma segunda chamada e sem um segundo lugar pra esquecer.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts
//! impacts:    src/herdr/tabs/CONTEXT.md

import { focus } from "@my/herdr/tabs/focus";

if (import.meta.main) {
  const out = await focus(Bun.argv[2] ?? '')
  console.log(out.ok ? out.id : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
