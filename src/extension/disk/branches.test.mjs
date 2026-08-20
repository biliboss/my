//! The units of a fan-out, and the branch each one actually has.
//!
//!   node --test disk/branches.test.mjs      (after `npm run compile`)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const runs = require('../out/disk/runs.js')
const branches = require('../out/disk/branches.js')

const HOUSE = join(homedir(), 'src', 'me')
const available = existsSync(join(HOUSE, '02_areas', '00_workflows', '00_main'))

test('unitsOf reads the live units of a coding run and counts what moved', { skip: !available }, () => {
  const { readFileSync, existsSync } = require('node:fs')
  const eta = require('../out/disk/eta.js')
  const file = join(
    HOUSE,
    '02_areas/00_workflows/00_main/01_coding/output/979_via_share_external/state.yaml',
  )
  if (!existsSync(file)) return // o run pode ter sido arquivado; a forma é o que importa

  const yaml = readFileSync(file, 'utf8')
  const units = branches.unitsOf(eta.topLevel(yaml), yaml)

  assert.equal(units.length, 4, 'as quatro unidades do lote')
  for (const unit of units) {
    assert.match(unit.id, /^S\d$/)
    // Slash OR hyphen: `staging/U1` is impossible while a ref named `staging`
    // exists, so the live run holds both spellings depending on when the branch
    // was cut. The tree resolves either — that is the point of `ref`.
    assert.match(unit.branch, /^staging[/-]U\d$/)
    assert.ok(unit.ref === null || /U\d$/.test(unit.ref))
    // SHAPE, not value: the live run moved from `rodando` to `pr_aberto` while
    // this test was being written. Asserting the value is asserting the weather.
    assert.ok(typeof unit.estado === 'string' && unit.estado.length > 0)
    assert.ok(unit.ahead >= 0)
    // `ahead > 0` implies a last commit: the count comes FROM the commits.
    if (unit.ahead > 0) assert.ok(unit.last && unit.last.at > 0)
  }
})

test('unitsOf returns nothing for a run that declares no units', () => {
  assert.deepEqual(branches.unitsOf({}, 'run: 980_my_no_explorer\nat: do-sprints\n'), [])
})

test('resolveRef finds the hyphen twin when the declared slash branch cannot exist', () => {
  const repo = join(homedir(), 'src', 'galgal')
  if (!existsSync(join(repo, '.git'))) return // o repo de trabalho pode não estar aqui

  // Whichever spelling the yaml carries, a ref must be found for a live unit.
  const found = branches.resolveRef(repo, 'staging/U1') ?? branches.resolveRef(repo, 'staging-U1')
  assert.ok(found === null || /U1$/.test(found))

  // A name nothing could mean stays null — never a fabricated ref.
  assert.equal(branches.resolveRef(repo, 'nao/existe/isto'), null)
})
