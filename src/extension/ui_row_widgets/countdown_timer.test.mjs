//! The check for the clock widget: three styles, and the words for "not started".
//!
//!   node --test ui_row_widgets/countdown_timer.test.mjs   (after `npm run compile`)
//!
//! Reaches the compiled widget, which imports no `vscode` — the arithmetic and the
//! formatting are ours, and the editor only receives the string.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const clock = require('../out/ui_row_widgets/countdown_timer.js')
const bar = require('../out/ui_row_widgets/progress_bar.js')
const step = require('../out/ui_row_widgets/step_name.js')
const count = require('../out/ui_row_widgets/commit_count.js')

const run = (over = {}) => ({
  main: '02_product',
  id: '980_um_run',
  dir: '/x',
  state: {},
  hasState: true,
  taskMinutes: [4, 3, 2],
  t0: { at: Date.now() - 60_000, source: 'state.yaml' },
  commits: [],
  units: [],
  planFrom: null,
  repo: null,
  label: null,
  issues: [],
  ...over,
})

test('no t0 means the cycle never started, and the row says the word', () => {
  assert.equal(clock.countdownTimer(run({ t0: null }), 'cronometro'), 'draft')
  // Every style agrees: a missing clock is not a formatting choice.
  for (const style of clock.STYLES) assert.equal(clock.countdownTimer(run({ t0: null }), style), 'draft')
})

test('a clock with no plan counts UP, and the row says which way', () => {
  // Words, not arrows: a bare number cannot say whether it rises or falls, and `↑33m`
  // was unreadable on the screen it was designed for.
  assert.match(clock.countdownTimer(run({ taskMinutes: [] }), 'cronometro'), /^rodando (agora|há \d+ (min|h|dias?))$/)
})

test('the three styles of the same run, each saying what its number means', () => {
  assert.match(clock.countdownTimer(run(), 'cronometro'), /^falta \d+:\d{2}$/)
  assert.match(clock.countdownTimer(run(), 'faixa'), /^falta \d+–\d+ min$/)
  assert.match(clock.countdownTimer(run(), 'progresso'), /^[▓░]{5} \d\/3$/)
})

test('past the estimate the row says it blew, never a zeroed countdown', () => {
  // `0:00` reads as broken; `estourou` reads as late, which is the truth.
  const late = run({ t0: { at: Date.now() - 600 * 60_000, source: 'state.yaml' } })
  assert.equal(clock.countdownTimer(late, 'cronometro'), 'estourou')
})

test('the same run renders the same number twice — a jittering countdown is noise', () => {
  const a = clock.etaOf(run())
  const b = clock.etaOf(run())
  assert.equal(Math.round(a.p50 * 100), Math.round(b.p50 * 100))
  assert.ok(a.p50 <= a.p90)
})

test('the small widgets say nothing when they have nothing to say', () => {
  assert.equal(count.commitCount(0), undefined)
  assert.equal(count.commitCount(6), '6 commits')
  assert.equal(count.commitCount(1), '1 commit')
  assert.equal(step.stepName(undefined), '?')
  assert.equal(step.stepName('coding:BatchSettled'), 'batchSettled')
  assert.equal(step.stepName('generate-sprints'), 'gen-sprints')
  assert.match(bar.progressBar({ p50: 1, p90: 2, declared: 9, elapsed: 4.5 }, 9), /^▓▓▓░░ 5\/9$/)
})

test('timer counts in seconds, and drops them past an hour', () => {
  assert.equal(clock.timer(11.7), '11:42')
  assert.equal(clock.timer(0.633), '0:38')
  assert.equal(clock.timer(0), '0:00')
  // Negative would mean "late", and late is 0 — a minus sign in a countdown reads
  // as a bug before it reads as overrun.
  assert.equal(clock.timer(-5), '0:00')
  assert.equal(clock.timer(64), '1h04')
  assert.equal(clock.timer(60), '1h00')
})

test('the check phrase answers with the worst thing that happened', () => {
  const status = require('../out/ui_row_widgets/check_status.js')
  const pull = (over) => ({ number: '1', ref: 'x', state: 'OPEN', draft: false, review: '', checks: { ok: 0, failed: 0, pending: 0 }, url: '', ...over })

  // A failure is the answer even when nine jobs passed.
  assert.equal(status.checkStatus(pull({ checks: { ok: 9, failed: 1, pending: 0 } })), '✗ 1 falhou')
  // Pending beats a green tick: a run still going has not answered yet.
  assert.equal(status.checkStatus(pull({ checks: { ok: 9, failed: 0, pending: 1 } })), '… rodando')
  assert.equal(status.checkStatus(pull({ checks: { ok: 2, failed: 0, pending: 0 } })), '✓ checks')
  assert.equal(status.checkStatus(pull({})), 'sem checks')

  // "Nobody looked" is the most common state of an open PR and the one worth naming.
  assert.equal(status.reviewStatus(pull({})), 'aguarda review')
  assert.equal(status.reviewStatus(pull({ draft: true })), 'rascunho')
  assert.equal(status.reviewStatus(pull({ review: 'APPROVED' })), 'aprovado')
  assert.equal(status.reviewStatus(pull({ review: 'CHANGES_REQUESTED' })), 'pediu mudança')
  assert.equal(status.reviewStatus(pull({ state: 'MERGED' })), 'mergeado')
})

test('the task mark in a commit subject is what closes a task', () => {
  const commits = require('../out/disk/commits.js')
  const branches = require('../out/disk/branches.js')
  const count = require('../out/ui_row_widgets/task_count.js')

  // Measured in ~/src/galgal on 17/08: the mark sits at the END of the subject, not in a
  // trailer, which is why reading only `Task:` found nothing.
  assert.equal(commits.taskMark('fix(listing): cluster galleries by directory [S2/T2]'), 'S2/T2')
  assert.equal(commits.taskMark('test(share): prove it settles as failed [s3/t1]'), 'S3/T1')
  assert.equal(commits.taskMark('chore: sem marca nenhuma'), null)
  // Not a mark in the middle of a sentence: the position is the contract.
  assert.equal(commits.taskMark('fix: [S1/T1] no começo'), null)

  const unit = (id, subjects) => ({
    id,
    branch: `staging/${id}`,
    ref: `staging-${id}`,
    issue: null,
    estado: 'rodando',
    ahead: subjects.length,
    last: null,
    commits: subjects.map((subject, index) => ({ hash: `h${index}`, at: index, subject, task: null })),
  })

  const done = branches.doneTasks([
    unit('U1', ['fix: um [S1/T1]', 'fix: dois [S1/T2]', 'chore: sem marca']),
    unit('U2', ['feat: tres [S2/T1]']),
  ])
  assert.deepEqual([...done.keys()].sort(), ['S1/T1', 'S1/T2', 'S2/T1'])
  assert.equal(done.get('S1/T2').hash, 'h1')

  // The denominator comes from the plan; with no mark the widget says nothing rather than
  // inventing one.
  assert.equal(count.taskCount(3, 9), '3 de 9 tasks')
  assert.equal(count.taskCount(0, 9), undefined)
  assert.equal(count.taskCount(3, 0), undefined)
})
