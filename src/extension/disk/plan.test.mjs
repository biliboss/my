//! The check for the plan reader, against the REAL plans in the house.
//!
//!   node --test disk/plan.test.mjs      (after `npm run compile`)
//!
//! Reads run 980's `sprints.yaml` and run 979's `state.yaml`, because a hand-written
//! fixture would only prove the parser handles what I imagined. Assertions are on SHAPE
//! and on the two facts that motivated the file: every task has a `proof`, and a refusal
//! carries its reason.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const plan = require('../out/disk/plan.js')

const HOUSE = join(homedir(), 'src', 'me')
const PLAN_980 = join(HOUSE, '02_areas/00_workflows/00_main/02_product/output/980_my_no_explorer/sprints.yaml')
const STATE_979 = join(HOUSE, '02_areas/00_workflows/00_main/01_coding/output/979_via_share_external/state.yaml')

test('readPlan reads run 980 whole: sprints, tasks, proofs', { skip: !existsSync(PLAN_980) }, () => {
  const read = plan.readPlan(readFileSync(PLAN_980, 'utf8'))

  assert.equal(read.label, 'run/980_my_no_explorer')
  assert.equal(read.sprints.length, 3)

  const tasks = read.sprints.flatMap((sprint) => sprint.tasks)
  assert.equal(tasks.length, 9)
  // The fact that motivated this file: every task carries the command that proves it.
  for (const task of tasks) {
    assert.ok(task.title.length > 3, `task sem título: ${JSON.stringify(task)}`)
    assert.ok(task.proof && task.proof.length > 3, `task sem proof: ${task.title}`)
    assert.ok(task.minutes && task.minutes > 0, `task sem duration legível: ${task.title}`)
  }

  // Sprint titles and their own duration survive the read.
  assert.match(read.sprints[0].titulo, /a árvore lê a pasta do run/)
  assert.equal(read.sprints[0].minutes, 9)
  assert.match(read.sprints[1].unidade, /my_eta\.ts/)
})

test('readPlan reads coverage and out_of_scope — the half nobody sees', { skip: !existsSync(PLAN_980) }, () => {
  const read = plan.readPlan(readFileSync(PLAN_980, 'utf8'))

  assert.ok(read.coverage.length >= 6, `coverage curto: ${read.coverage.length}`)
  assert.ok(read.coverage.every((entry) => entry.id && entry.where))

  assert.ok(read.outOfScope.length >= 3)
  // An out-of-scope item with no reason is the thing this house refuses to write.
  for (const item of read.outOfScope) {
    assert.ok(item.item && item.item.length > 3, JSON.stringify(item))
    assert.ok(item.porQue && item.porQue.length > 10, `sem por_que: ${item.item}`)
  }

  // A declared deviation is read too: skipping a step silently is the failure mode.
  assert.ok(read.declaredDeviation.length >= 1)
})

test('readBatch reads what run 979 refused and parked, with the reason', { skip: !existsSync(STATE_979) }, () => {
  const batch = plan.readBatch(readFileSync(STATE_979, 'utf8'))

  assert.equal(batch.refused.length, 1)
  assert.equal(batch.refused[0].id, 'S5')
  assert.equal(batch.refused[0].issue, '288')
  // The reason is the payload: S5 was refused because its proof pointed at nothing.
  assert.match(batch.refused[0].porQue, /broker-web/)

  assert.equal(batch.parked.length, 1)
  assert.equal(batch.parked[0].id, 'S6')
  assert.match(batch.parked[0].porQue, /decis/)
})

test('a plan with nothing in it reads as empty, never as a throw', () => {
  const empty = plan.readPlan('run: x\n')
  assert.deepEqual(empty.sprints, [])
  assert.deepEqual(empty.coverage, [])
  assert.equal(empty.label, null)
  assert.equal(empty.repo, null)

  const nothing = plan.readBatch('run: x\nat: do-sprints\n')
  assert.deepEqual(nothing, { refused: [], parked: [] })
})

test('`repo: null` written literally is no repo at all', () => {
  assert.equal(plan.readPlan('repo: null\n').repo, null)
  assert.equal(plan.readPlan('repo: a/b\n').repo, 'a/b')
})

test('a key with a DIGIT survives both readers — the two charsets used to disagree', () => {
  // The divergence 020 was opened for: `eta.ts` matched `[a-z_][a-z0-9_]*` and
  // `plan.ts` matched `[a-z_]+`, so `s1_note:` was read by one reader and dropped in
  // SILENCE by the other. Same file, two answers, no error anywhere.
  const eta = require('../out/disk/eta.js')

  const yaml = ['s1_note: primeiro', 'label: run/999_x', ''].join('\n')
  assert.equal(eta.topLevel(yaml).s1_note, 'primeiro', 'topLevel always accepted it')

  // Now the plan side accepts it too. `readPlan` keeps only the keys it models, so the
  // proof that the KEY matched is that `label` — read in the same pass, after it —
  // still arrives: a key the regex rejects does not `continue`, it falls through and
  // desynchronises the scan.
  assert.equal(plan.readPlan(yaml).label, 'run/999_x')

  // The field-level scan, where it actually bit: `s1_note` sits between the task's
  // `title` and its `proof`, and used to make the whole line unmatched.
  const withDigit = [
    'sprints:',
    '  - sprint: 1',
    '    tasks:',
    '      - title: a task',
    '        s1_note: uma nota com digito na chave',
    '        proof: bun test',
    '',
  ].join('\n')
  const task = plan.readPlan(withDigit).sprints[0].tasks[0]
  assert.equal(task.title, 'a task')
  assert.equal(task.proof, 'bun test', 'the proof after the digit key still lands')

  // And in a list of maps, the other reader of the same shape.
  const units = ['unidades:', '  - id: S1', '    s1_note: nota', ''].join('\n')
  assert.equal(eta.listOfMaps(units, 'unidades')[0].s1_note, 'nota')
})

test('a folded reason is not an empty reason — readBatch used to test the CLEANED value', () => {
  // `cleanScalar('>-')` is the empty string, so a reader that decides on the cleaned
  // text cannot tell a folded block from a blank. `readPlan` documented that since the
  // first `out_of_scope` came out blank; `readBatch` did the opposite until now.
  const folded = [
    'recusadas:',
    '  - id: S5',
    '    por_que: >-',
    '      a prova apontava',
    '      pra lugar nenhum',
    '',
  ].join('\n')
  assert.equal(plan.readBatch(folded).refused[0].porQue, 'a prova apontava pra lugar nenhum')

  // Control: an inline reason still reads inline, or the folding branch would be
  // swallowing everything.
  const inline = ['recusadas:', '  - id: S5', '    por_que: a prova nao existe', ''].join('\n')
  assert.equal(plan.readBatch(inline).refused[0].porQue, 'a prova nao existe')

  // Control: a reason that is genuinely absent stays null, not ''.
  const bare = ['recusadas:', '  - id: S5', '    issue: 288', ''].join('\n')
  assert.equal(plan.readBatch(bare).refused[0].porQue, null)
})
