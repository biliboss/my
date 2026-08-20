//! The issues a run published, and the URLs that lead to them.
//!
//!   node --test disk/issues.test.mjs      (after `npm run compile`)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const runs = require('../out/disk/runs.js')
const issues = require('../out/disk/issues.js')
const plans = require('../out/disk/plan.js')

const HOUSE = join(homedir(), 'src', 'me')
const available = existsSync(join(HOUSE, '02_areas', '00_workflows', '00_main'))

test('the pointer carries repo and label, and the URL is built from them', { skip: !available }, () => {
  const found = runs.scanRuns(HOUSE)

  const published = found.filter((run) => run.repo && run.label)
  assert.ok(published.length > 0, 'algum run declara repo e label no ponteiro')

  for (const run of published) {
    const url = issues.labelUrl(run)
    assert.match(url, /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\?q=/)
    assert.ok(url.includes(encodeURIComponent(run.label)), 'a label vai no filtro')
  }

  // `repo: null` written literally must never become github.com/null.
  const nulled = found.find((run) => !run.repo)
  if (nulled) assert.equal(issues.labelUrl(nulled), null)
})

test('issuesOf reads the numbers the publication wrote back', () => {
  const plan = [
    'label: run/999_x',
    'sprints:',
    '  - sprint: 1',
    '    titulo: o primeiro corte',
    '    issue: 284',
    '  - sprint: 2',
    '    titulo: o segundo',
    '    issue: 285',
    '',
  ].join('\n')

  // The plan arrives PARSED — `scanRuns` reads `sprints.yaml` once and everyone
  // downstream shares that one object.
  assert.deepEqual(issues.issuesOf(plans.readPlan(plan), ''), [
    { number: '284', titulo: 'o primeiro corte' },
    { number: '285', titulo: 'o segundo' },
  ])

  // A draft id with a leading zero is not a GitHub number — two runs keep
  // `issue: "01"` for issues that were never published.
  const drafts = ['agentes:', '  - issue: "01"', '  - issue: "02"', ''].join('\n')
  assert.deepEqual(issues.issuesOf(plans.readPlan(''), drafts), [])

  // No plan: the coding side keeps the same numbers under `unidades:`.
  const state = ['unidades:', '  - id: S1', '    issue: 284', '  - id: S2', '    issue: 285', ''].join('\n')
  assert.deepEqual(issues.issuesOf(plans.readPlan(''), state).map((issue) => issue.number), ['284', '285'])
})

test('a draft id never becomes a link — the guard is in the PARSER, so both readers agree', () => {
  // This is the divergence 018 was opened for: `issuesOf` refused `issue: "01"`
  // since 18/08, `readPlan` did not, and `sprint_card.ts` renders whatever the plan
  // hands it — so the same file produced a clickable `#01` pointing at issue #1 of
  // the wrong repo through one path and nothing through the other.
  const yaml = ['sprints:', '  - sprint: 1', '    titulo: rascunho', '    issue: "01"', ''].join('\n')

  const parsed = plans.readPlan(yaml)
  assert.equal(parsed.sprints[0].issue, null, 'readPlan drops the draft id')
  assert.deepEqual(issues.issuesOf(parsed, ''), [], 'and issuesOf agrees')

  // Control: a real number still survives both, or the guard would just be a mute.
  const real = plans.readPlan(yaml.replace('"01"', '284'))
  assert.equal(real.sprints[0].issue, '284')
  assert.deepEqual(issues.issuesOf(real, '').map((issue) => issue.number), ['284'])

  // `recusadas:`/`parqueadas:` is the other place draft ids live, and `run_coding.ts`
  // renders that field as a clickable `#…` too.
  const batch = plans.readBatch(
    ['recusadas:', '  - id: S5', '    issue: "01"', 'parqueadas:', '  - id: S6', '    issue: 291', ''].join('\n'),
  )
  assert.equal(batch.refused[0].issue, null)
  assert.equal(batch.parked[0].issue, '291')
})
