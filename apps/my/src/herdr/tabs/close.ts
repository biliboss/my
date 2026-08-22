#!/usr/bin/env bun
//! Fecha uma aba: `bun run src/herdr/tabs/close.ts w3K:t2`. É a chamada que faz a herança da cerca valer a pena — sem ela, um workspace bloqueado se esvazia uma aba por vez.
//!
//! Cercado por herança: `w3K:t2` nomeia o workspace dele, então bloquear `w3K`
//! bloqueia isto sem uma segunda chamada e sem um segundo lugar pra esquecer.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts
//! impacts:    src/herdr/tabs/CONTEXT.md

import { close } from "@biliboss/herdr/tabs/close";

if (import.meta.main) {
  const out = await close(Bun.argv[2] ?? '')
  console.log(out.ok ? out.closed : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
