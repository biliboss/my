#!/usr/bin/env bun
//! Renomeia uma aba: `bun run src/herdr/tabs/rename.ts w3K:t2 revisao`.
//!
//! Cercado por herança: `w3K:t2` nomeia o workspace dele, então bloquear `w3K`
//! bloqueia isto sem uma segunda chamada e sem um segundo lugar pra esquecer.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts
//! impacts:    src/herdr/tabs/CONTEXT.md

import { rename } from "@my/herdr/tabs/rename";

if (import.meta.main) {
  const [id, label] = Bun.argv.slice(2)
  if (!id || !label) {
    console.error('usage: rename.ts <tab-id> <label>')
    process.exit(2)
  }
  const out = await rename(id, label)
  console.log(out.ok ? `${out.id} → ${out.label}` : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
