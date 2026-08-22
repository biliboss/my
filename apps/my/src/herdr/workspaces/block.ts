#!/usr/bin/env bun
//! Putting the fence up and taking it down, and the curtain with it.
//!
//!     bun run src/workspaces/block.ts block cockpit "run em andamento"
//!     bun run src/workspaces/block.ts unblock cockpit
//!     bun run src/workspaces/block.ts hide w12
//!
//! None of these four reach herdr. They change what THIS code is willing to do,
//! and the workspace goes on working in the terminal either way.
//!
//! The three that a blocked workspace still accepts are `unblock`, `hide` and
//! `unhide` — `unblock` because it is the gate itself, and hiding because it is
//! a listing filter: refusing it meant a fence you could not tidy away.
//!
//! depends_on: src/herdr/policy.ts · src/herdr/workspaces/resolve.ts
//! impacts:    src/herdr/workspaces/CONTEXT.md

import { mark } from "@biliboss/herdr/workspaces/block";

if (import.meta.main) {
  const [verb, key, reason] = Bun.argv.slice(2)
  if (!verb || !key || !['block', 'unblock', 'hide', 'unhide'].includes(verb)) {
    console.error('usage: block.ts <block|unblock|hide|unhide> <id|label> [reason]')
    process.exit(2)
  }
  const out = await mark(verb as Verb, key, reason)
  console.log(out.ok ? `✓ ${out.verb} ${out.id}` : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
