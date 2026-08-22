//! What THIS house thinks about herdr's workspaces — the two opinions herdr
//! does not have, and neither is ever sent to it.
//!
//!   block  a FENCE. Nothing here may act on that workspace until `unblock`,
//!          and `unblock` is the one call a blocked workspace still accepts.
//!   hide   a CURTAIN. Gone from the listing, otherwise untouched.
//!
//! The two are deliberately separate: hiding in order to stop touching something
//! would make the fence invisible, and the whole value of a fence is that it can
//! be SEEN. So the listing shows blocked workspaces, flagged.
//!
//! A blocked workspace goes on working perfectly from the terminal. It is only
//! this code that refuses to touch it.
//!
//! Written to disk, and that is not premature: a guard that evaporates on
//! restart is worse than no guard, because whoever set it has no reason to set
//! it again and the first call after a restart walks straight through the fence
//! they thought was up. One JSON file is the whole mechanism.
//!
//! O ESTADO DE MÁQUINA MUDOU DE CASA em 20/08: era `_data/` DENTRO do checkout, e
//! agora é `~/.me/` via `home.store()`. Enquanto código e casa eram a mesma pasta o
//! erro não aparecia; publicado o código, um roster de panes desta máquina viraria
//! arquivo de repositório — e sumiria no primeiro clone. `adopt()` muda o que já
//! existe, uma vez, sem apagar a origem.
//!
//! depends_on: —
//! impacts:    src/herdr/workspaces/CONTEXT.md · src/herdr/tabs/CONTEXT.md · src/herdr/panes/send.ts · src/herdr/agents/start.ts · src/herdr/tabs/focus.ts · src/herdr/tabs/rename.ts · src/herdr/tabs/create.ts · src/herdr/tabs/close.ts · src/herdr/workspaces/focus.ts · src/herdr/workspaces/block.ts · src/herdr/workspaces/close.ts · src/herdr/workspaces/list.ts · src/herdr/panes/split.ts

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { store } from "./paths.ts"

import type { Fail } from "@biliboss/shared/result"

const STORE = () => store("workspaces.json")

export type Mark = { at: string; reason?: string }
type Policy = { blocked: Record<string, Mark>; hidden: Record<string, Mark> }

function load(): Policy {
  try {
    const parsed = JSON.parse(readFileSync(STORE(), 'utf8'))
    return { blocked: parsed.blocked ?? {}, hidden: parsed.hidden ?? {} }
  } catch {
    // Missing file and corrupt file both mean "no policy yet". A corrupt file
    // must not take anything down — it fences nothing, which is the state the
    // system starts in anyway.
    return { blocked: {}, hidden: {} }
  }
}

const policy = load()

function save(): void {
  mkdirSync(dirname(STORE()), { recursive: true })
  writeFileSync(STORE(), JSON.stringify(policy, null, 2))
}

export const marks = () => policy

/** Why a call was refused, or `undefined` when it may proceed. */
export function blockedReason(id: string): string | undefined {
  const mark = policy.blocked[id]
  if (!mark) return undefined
  return `workspace ${id} is blocked since ${mark.at}${mark.reason ? `: ${mark.reason}` : ''}`
}

/**
 *  The fence, for a tab or pane id.
 *
 *  Inherited by PREFIX and with no extra call, because `w3K:t2` already names
 *  its workspace. Without this the fence would be one id away from meaningless:
 *  block the workspace, then close its tabs one by one.
 */
export function fence(id: string): Fail | undefined {
  const workspace = id.split(':')[0]
  const why = workspace ? blockedReason(workspace) : undefined
  return why ? { ok: false, error: why, reason: 'blocked' } : undefined
}

export function block(id: string, reason?: string): Mark {
  const mark: Mark = { at: new Date().toISOString(), reason }
  policy.blocked[id] = mark
  save()
  return mark
}

export function unblock(id: string): boolean {
  const had = id in policy.blocked
  delete policy.blocked[id]
  save()
  return had
}

export function hide(id: string): Mark {
  const mark: Mark = { at: new Date().toISOString() }
  policy.hidden[id] = mark
  save()
  return mark
}

export function unhide(id: string): boolean {
  const had = id in policy.hidden
  delete policy.hidden[id]
  save()
  return had
}

/** Drop every mark for an id — for AFTER the workspace itself is gone, or a
 *  recycled id inherits a fence set for a workspace that no longer exists. */
export function forget(id: string): void {
  delete policy.blocked[id]
  delete policy.hidden[id]
  save()
}
