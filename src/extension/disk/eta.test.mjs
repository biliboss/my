//! The check for the countdown: the arithmetic behind the `my` tree.
//!
//!   node --test src/my_eta.test.mjs      (after `npm run compile`)
//!
//! Reads the COMPILED module by `require`, not the TypeScript source — same
//! reason `hook.test.mjs` does: `out/` is what the extension host loads, so a
//! test against the source can pass while the shipped file is stale.
//!
//! Nothing here touches `vscode`: this file is the arithmetic — parse, sample,
//! quantile. How a number becomes a row is `ui_row_widgets/`, tested next door.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const eta = require('../out/disk/eta.js')

test('parseDurationMinutes reads all three shapes on disk, and refuses the rest', () => {
  assert.equal(eta.parseDurationMinutes('5 min'), 5)
  assert.equal(eta.parseDurationMinutes('"10 min"'), 10)
  assert.equal(eta.parseDurationMinutes('12 minutos'), 12)
  // Measured durations, minutes glued to seconds.
  assert.equal(eta.parseDurationMinutes('9min52s').toFixed(2), '9.87')
  assert.equal(eta.parseDurationMinutes('7min30s'), 7.5)
  // Absence, never zero: 0 would read as "instant", which is a claim.
  assert.equal(eta.parseDurationMinutes('logo'), null)
  assert.equal(eta.parseDurationMinutes(''), null)
})

test('declaredDurations sums a plan and ignores trailing comments', () => {
  const yaml = [
    'sprints:',
    '  - sprint: 1',
    '    tasks:',
    '      - duration: "4 min"',
    '      - duration: "3 min"   # o comentário não entra na conta',
    '      - duration: "2 min"',
    '  - sprint: 2',
    '    tasks:',
    '      - duration: "9min52s"',
    '      - duration: nada',
    '',
  ].join('\n')

  const found = eta.declaredDurations(yaml)
  assert.equal(found.length, 4, 'a duração ilegível não vira 0, ela não entra')
  assert.equal(found.slice(0, 3).reduce((a, b) => a + b, 0), 9)
})

test('topLevel reads the state.yaml fields the tree needs, and only the top level', () => {
  const yaml = [
    'run: 980_my_no_explorer',
    'at: generate-sprints',
    'started_at: 2026-08-17T18:25:49Z   # o recibo do inbox capture',
    'repo: null',
    'files:',
    '  - F1_superficie_da_view.md',
    '',
  ].join('\n')

  const fields = eta.topLevel(yaml)
  assert.equal(fields.at, 'generate-sprints')
  assert.equal(fields.started_at, '2026-08-17T18:25:49Z')
  // The nested list item is not a top-level key, and must not become one.
  assert.equal(fields['- F1_superficie_da_view.md'], undefined)
})

test('estimate: p50 <= p90, and the same seed gives the same number twice', () => {
  const plan = [4, 3, 2, 3, 5, 2, 4, 2, 3]

  const a = eta.estimate(plan, 0, 42)
  const b = eta.estimate(plan, 0, 42)
  assert.deepEqual(a, b, 'cronômetro que muda sozinho a cada refresh é ruído')
  assert.ok(a.p50 <= a.p90)
  assert.equal(a.declared, 28)

  // The prior has a median under 1 (all four measured pairs came in under the
  // ceiling), so the median sample must land below the declared sum.
  assert.ok(a.p50 < a.declared, `p50 ${a.p50} deveria ser menor que ${a.declared}`)

  // Elapsed time is subtracted, and a run past its estimate reads 0 — never
  // negative, which would render as "-4 min" and read as a bug.
  assert.equal(eta.estimate(plan, 10_000, 42).p50, 0)
  assert.ok(eta.estimate(plan, 5, 42).p50 < a.p50)

  // No t0 on disk: nothing to subtract, and the field says so.
  assert.equal(eta.estimate(plan, null, 42).elapsed, null)
})

test('estimate: the memo keys on the PLAN, not just the seed', () => {
  // The 2000 draws only depend on `(seed, taskMinutes)`, so they are computed
  // once and reused every beat. Two ways that cache can lie, and both are here:
  const seed = 42

  // 1. KEY COLLISION. Keying on the seed alone would serve one plan's samples to
  //    a different plan — same countdown on two unrelated rows, and nothing on
  //    screen would look broken.
  const short = eta.estimate([2, 2], null, seed)
  const long = eta.estimate([40, 40, 40], null, seed)
  assert.equal(short.declared, 4)
  assert.equal(long.declared, 120)
  assert.ok(long.p50 > short.p50, 'plano maior tem que devolver número maior')

  // 2. `elapsed` LEAKING INTO THE CACHE. It is the one term that changes between
  //    beats — it must be subtracted OUTSIDE the memo, or the countdown freezes
  //    at whatever the first frame happened to see.
  const cold = eta.estimate([10, 10], null, seed)
  const burned = eta.estimate([10, 10], 5, seed)
  assert.equal(burned.p50, Math.max(0, cold.p50 - 5))
  assert.equal(burned.elapsed, 5)
  assert.equal(cold.elapsed, null)

  // And the cached path still equals the cold one, field for field.
  assert.deepEqual(eta.estimate([10, 10], null, seed), cold)
})
