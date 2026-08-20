//! `whyFailed` — the four shapes a dead subprocess arrives in.
//!
//!   node --test log.test.mjs      (after `npm run compile`)
//!
//! Every case here was OBSERVED while closing task 043, never invented: the
//! ENOENT and the two exit codes came from forcing the failures against the real
//! `gh` and `git`, and the signal case came from a `git log` killed as a dangling
//! process during `bun test ./src/` — which printed `Command failed: git log …`
//! and read like git had rejected the revision.
//!
//! This file also proves the LAZY `vscode`: it requires `out/log.js` outside the
//! extension host, which a static `import * as vscode` made impossible.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { whyFailed } = require('./out/log.js')

test('a missing binary is named as such, never as an exit code', () => {
  assert.equal(whyFailed(Object.assign(new Error('spawnSync gh ENOENT'), { code: 'ENOENT' })), 'not on the PATH')
})

test('an exit code carries the process own stderr — that is the diagnosis', () => {
  const failure = Object.assign(new Error('Command failed'), {
    status: 1,
    stderr: "GraphQL: Could not resolve to a Repository with the name 'x/y'. (repository)\n",
  })
  assert.equal(whyFailed(failure), "exit 1: GraphQL: Could not resolve to a Repository with the name 'x/y'. (repository)")
})

test('stderr is capped at three lines: a git usage screen is not a log entry', () => {
  const failure = Object.assign(new Error('Command failed'), {
    status: 128,
    stderr: 'fatal: ambiguous argument\nline two\nline three\nline four\nline five',
  })
  assert.equal(whyFailed(failure), 'exit 128: fatal: ambiguous argument · line two · line three')
})

test('a signal is not an exit code — `status` is null when one arrives', () => {
  const failure = Object.assign(new Error('Command failed: git log …'), { status: null, signal: 'SIGTERM' })
  assert.equal(whyFailed(failure), 'killed by SIGTERM')
})

test('anything else still says something, never the empty string', () => {
  assert.equal(whyFailed(new Error('boom')), 'boom')
  assert.equal(whyFailed('boom'), 'boom')
})
