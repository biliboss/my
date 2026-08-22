//! The one thing here that can be wrong without anyone noticing: the fence not
//! being INHERITED. Blocking `wTEST` has to refuse `wTEST:t1` and `wTEST:p2`, or
//! the fence is one id away from meaningless — block the workspace, then close
//! its tabs one by one.
//!
//! A fake id (`wTEST`) so the check never touches a real workspace, and
//! `forget()` at the end so `_data/workspaces.json` goes back as it was.

import { afterAll, expect, test } from 'bun:test'

import { block, blockedReason, fence, forget, unblock } from './policy.ts'

const WS = 'wTEST'

afterAll(() => forget(WS))

test('the fence is inherited by tab and pane ids, and lifted by unblock', () => {
  // negative control: nothing is fenced before the block, so a passing
  // assertion below means the block did it and not that `fence` always refuses.
  expect(fence(`${WS}:t1`)).toBeUndefined()

  block(WS, 'checando')
  expect(blockedReason(WS)).toContain('checando')
  expect(fence(`${WS}:t1`)?.reason).toBe('blocked')
  expect(fence(`${WS}:p2`)?.reason).toBe('blocked')
  // A different workspace whose id merely starts with the same letters must NOT
  // inherit it — the split is on `:`, not on prefix matching.
  expect(fence(`${WS}2:t1`)).toBeUndefined()

  expect(unblock(WS)).toBe(true)
  expect(fence(`${WS}:t1`)).toBeUndefined()
})
