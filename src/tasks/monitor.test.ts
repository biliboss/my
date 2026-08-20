//! O `diff` do monitor: um evento por mudança, nenhum por repetição.
//!
//! É a única lógica não-trivial do verbo — o resto é leitura de disco que o
//! `list` já exercita. O que se afere aqui é o que quebraria um worker: emitir
//! duas vezes a mesma coisa (ele pega a task duas vezes) ou não emitir a
//! transição pra `doing` (dois workers na mesma task).
//!
//! depends_on: src/tasks/monitor.ts
//! impacts:    —

import { expect, test } from 'bun:test'
import { diff } from './monitor.ts'
import type { Place, State } from './model.ts'

const snap = (state: string, place: Place = 'tasks') =>
  new Map([['999_s/001', { key: '999_s/001', sprint: '999_s', id: '001', title: 't', place, state: state as State }]])

test('disco parado não emite nada', () => {
  expect(diff(snap('draft'), snap('draft'))).toEqual([])
})

test('mudança de estado sai com o de onde veio', () => {
  const [e] = diff(snap('draft'), snap('doing'))
  expect([e?.event, e?.from, e?.state]).toEqual(['state', 'tasks/draft', 'doing'])
})

test('promoção de pasta é evento, mesmo com o desfecho parado', () => {
  const [e] = diff(snap('draft', 'backlog'), snap('draft', 'tasks'))
  expect([e?.event, e?.from, e?.place]).toEqual(['state', 'backlog/draft', 'tasks'])
})

test('task nova é `appeared`, task sumida é `gone`', () => {
  expect(diff(new Map(), snap('draft'))[0]?.event).toBe('appeared')
  expect(diff(snap('draft'), new Map())[0]?.event).toBe('gone')
})
