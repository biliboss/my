#!/usr/bin/env bun
//! Closing a workspace — one, or every one that is not fenced.
//!
//!     bun run src/workspaces/close.ts cockpit
//!     bun run src/workspaces/close.ts --all
//!
//! This is the destructive verb of the house, and `block` is the ONLY thing
//! standing between a workspace and `--all`. That is the whole point of the
//! fence, and the reason it is worth putting up before a session that might
//! sweep.
//!
//! Hidden ones close too: hiding is a listing filter, not protection.
//!
//! The marks are dropped AFTER the close, or a recycled id would inherit a
//! fence set for a workspace that no longer exists.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts · src/herdr/workspaces/list.ts · src/shared/argv.ts
//! impacts:    src/herdr/workspaces/CONTEXT.md

import { close, closeAll } from "@my/herdr/workspaces/close";
import { has } from "@my/shared/argv";

if (import.meta.main) {
  const out = has('all') ? await closeAll() : await close(Bun.argv[2] ?? '')
  console.log(JSON.stringify(out, null, 2))
  process.exit(out.ok ? 0 : 1)
}
