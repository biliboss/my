//! The commits of a run, read in the registry checkout.
//!
//!   node --test disk/commits.test.mjs      (after `npm run compile`)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const runs = require('../out/disk/runs.js')
const commits = require('../out/disk/commits.js')

const HOUSE = join(homedir(), 'src', 'me')
const available = existsSync(join(HOUSE, '02_areas', '00_workflows', '00_main'))

test('commitsFor finds the commits that name a run, newest first', { skip: !available }, () => {
  const found = commits.commitsFor(HOUSE, '980_my_no_explorer')

  assert.ok(found.length > 0, 'os commits deste run existem — 980 é o run que os escreveu')
  for (const commit of found) {
    assert.match(commit.hash, /^[0-9a-f]{7,}$/)
    assert.ok(commit.at > Date.parse('2026-01-01'), 'a data vem em ms, não em segundos')
    assert.ok(commit.subject.length > 0)
    // The trailer is read when present and null otherwise — never guessed.
    assert.ok(commit.task === null || typeof commit.task === 'string')
  }

  const stamps = found.map((commit) => commit.at)
  assert.deepEqual(stamps, [...stamps].sort((a, b) => b - a), 'mais novo primeiro')

  // A run nobody committed against gets an empty list, not a throw.
  assert.deepEqual(commits.commitsFor(HOUSE, '111_isto_nunca_existiu'), [])
})

test('commitsFor survives a folder that is not a checkout', () => {
  assert.deepEqual(commits.commitsFor('/', '980_my_no_explorer'), [])
})
