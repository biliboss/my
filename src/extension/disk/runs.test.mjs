//! The check for the disk half: does the scanner find the real runs of the real
//! house, including the ones with no receipt?
//!
//!   node --test src/my_runs.test.mjs      (after `npm run compile`)
//!
//! Asserts SHAPE against the live `~/src/me`, never exact counts: the house
//! opens runs every day, so `=== 23` would go red on the next cycle and teach
//! everyone to ignore this file. What must hold is structural — every run has a
//! main and a numbered id, `01_coding` is on the list even though it writes no
//! `state.yaml`, and mtime never sneaks in as a clock.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const runs = require('../out/disk/runs.js')

const HOUSE = join(homedir(), 'src', 'me')
const available = existsSync(join(HOUSE, '02_areas', '00_workflows', '00_main'))

test('houseRoot falls back to ~/src/me and refuses a folder without the mains', () => {
  assert.equal(runs.houseRoot(['/definitely/not/here']), available ? HOUSE : null)
})

test('scanRuns finds the runs of every main, receipt or not', { skip: !available }, () => {
  const found = runs.scanRuns(HOUSE)

  assert.ok(found.length > 0, 'a casa tem runs; achar zero é o scanner quebrado')
  for (const run of found) {
    assert.match(run.id, /^\d+_/, 'o id do run começa com o número que conta pra baixo')
    assert.ok(run.main.length > 0)
    assert.ok(existsSync(run.dir))
  }

  // The whole reason the folder is the source: `01_coding` writes no state.yaml,
  // and it must still be on the list.
  const coding = found.filter((run) => run.main === '01_coding')
  if (coding.length) {
    assert.ok(
      coding.some((run) => !run.hasState),
      'o run sem recibo do 01_coding é justamente o que não pode desaparecer',
    )
  }

  // At least one run carries a plan, or the countdown has nothing to count.
  assert.ok(
    found.some((run) => run.taskMinutes.length > 0),
    'nenhum sprints.yaml lido — o parse de duration regrediu',
  )
})

test('resolveT0 prefers started_at, then the receipt, and never invents one', { skip: !available }, () => {
  const declared = runs.resolveT0(HOUSE, {
    id: '980_my_no_explorer',
    dir: join(HOUSE, 'x'),
    state: { started_at: '2026-08-17T18:25:49Z' },
  })
  assert.equal(declared.source, 'state.yaml')
  assert.equal(new Date(declared.at).toISOString(), '2026-08-17T18:25:49.000Z')

  // No `started_at` and no receipt carrying the slug: null, not a made-up clock.
  const nothing = runs.resolveT0(HOUSE, {
    id: '999_slug_que_nao_existe_em_lugar_nenhum',
    dir: join(HOUSE, 'x'),
    state: {},
  })
  assert.equal(nothing, null)
})

test('scanRuns orders the mains by the pipeline, not by folder name', { skip: !available }, () => {
  const seen = []
  for (const run of runs.scanRuns(HOUSE)) if (!seen.includes(run.main)) seen.push(run.main)

  const known = seen.filter((main) => runs.MAIN_ORDER.includes(main))
  assert.deepEqual(
    known,
    runs.MAIN_ORDER.filter((main) => known.includes(main)),
    'product decide, coding escreve, qa aprova — nessa ordem',
  )
  // A main outside the list sorts after the known ones instead of vanishing.
  const unknownFirst = seen.findIndex((main) => !runs.MAIN_ORDER.includes(main))
  if (unknownFirst !== -1) assert.ok(unknownFirst >= known.length)
})

test('ordered puts the moving runs first, then the most recently touched', { skip: !available }, () => {
  const list = runs.ordered(runs.scanRuns(HOUSE))

  const moving = list.map((run) => Number(runs.isMoving(run)))
  assert.deepEqual(moving, [...moving].sort((a, b) => b - a), 'o que está rodando vem primeiro')

  const still = list.filter((run) => !runs.isMoving(run)).map((run) => runs.activityOf(run))
  assert.deepEqual(still, [...still].sort((a, b) => b - a))

  // Ordering never drops or duplicates a run.
  assert.equal(list.length, runs.scanRuns(HOUSE).length)
  assert.equal(new Set(list.map((run) => `${run.main}/${run.id}`)).size, list.length)
})

test('slugKey strips the position number and the main-specific suffix', () => {
  assert.equal(runs.slugKey('999_via_share_external_sprints'), 'via_share_external')
  assert.equal(runs.slugKey('979_via_share_external'), 'via_share_external')
  assert.equal(runs.slugKey('999_via_share_external_qa'), 'via_share_external')
  assert.equal(runs.slugKey('980_my_no_explorer'), 'my_no_explorer')
})

