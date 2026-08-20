//! The check for the API shape: everything optional in, everything defaulted out.
//!
//!   node --test gh/api.test.mjs      (after `npm run compile`)
//!
//! An issue with no body, no labels and no assignees is a REAL issue — a fresh one —
//! and a pane that throws on it fails exactly when someone is opening one.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const api = require('../out/gh/api.js')

test('toIssueDetail keeps what GitHub sent', () => {
  const detail = api.toIssueDetail(
    'mktvirtual/mukutu-mono',
    {
      number: 178,
      title: 'fix(funnel-dashboard): Meta Ads não retorna dados no painel',
      state: 'open',
      body_html: '<p>não puxa</p>',
      html_url: 'https://github.com/mktvirtual/mukutu-mono/issues/178',
      created_at: '2026-08-17T18:00:00Z',
      user: { login: 'biliboss', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
      labels: [{ name: 'bug', color: 'd73a4a' }, { name: 'funnel', color: '0E8A16' }],
      assignees: [{ login: 'biliboss' }],
    },
    [{ user: { login: 'kevin' }, created_at: '2026-08-17T19:00:00Z', body_html: '<p>obrigado</p>' }],
  )

  assert.equal(detail.number, 178)
  assert.equal(detail.bodyHtml, '<p>não puxa</p>')
  // The label colour comes from the API and nowhere else: a label recoloured by the
  // theme is a label that lost its meaning.
  assert.deepEqual(detail.labels, [
    { name: 'bug', color: 'd73a4a' },
    { name: 'funnel', color: '0E8A16' },
  ])
  assert.deepEqual(detail.assignees, ['biliboss'])
  assert.equal(detail.comments.length, 1)
  assert.equal(detail.comments[0].author, 'kevin')
})

test('an empty issue is a real issue, not an exception', () => {
  const detail = api.toIssueDetail('a/b', {})

  assert.equal(detail.number, 0)
  assert.equal(detail.title, '(sem título)')
  assert.equal(detail.state, 'unknown')
  assert.equal(detail.author, 'alguém')
  assert.equal(detail.avatar, null)
  assert.deepEqual(detail.labels, [])
  assert.deepEqual(detail.assignees, [])
  assert.deepEqual(detail.comments, [])
  // No `html_url` from the API still gives a link, built from what we do know.
  assert.match(detail.url, /^https:\/\/github\.com\/a\/b\/issues\//)
})

test('a label with no colour, and an assignee with no login, do not break the shape', () => {
  const detail = api.toIssueDetail('a/b', {
    labels: [{ name: 'sem-cor' }, { color: 'ffffff' }],
    assignees: [{}, { login: 'quem' }],
  })

  // A label with no name is not a label; one with no colour gets a neutral grey.
  assert.deepEqual(detail.labels, [{ name: 'sem-cor', color: '888888' }])
  assert.deepEqual(detail.assignees, ['quem'])
})
