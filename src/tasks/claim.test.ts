//! `ehMinha` — a única regra do crachá que não é chamada de sistema.
//!
//! O que se afere é o que faria dois workers na mesma task: casar por camada
//! ausente (crachá sem sessão contra agente com sessão) ou casar `pid` de hosts
//! diferentes, que numa frota com máquina remota é colisão garantida.
//!
//! depends_on: src/tasks/claim.ts
//! impacts:    —

import { expect, test } from 'bun:test'
import { ehMinha } from './claim.ts'

const eu = { at: 'x', claude_session: 'S1', herdr_pane: 'w1:p1', pid: '10', host: 'h1' }

test('mesma sessão é minha; sessão diferente não é', () => {
  expect(ehMinha({ ...eu }, eu)).toBe(true)
  expect(ehMinha({ ...eu, claude_session: 'S2' }, eu)).toBe(false)
})

test('sem sessão dos dois lados, decide o pane', () => {
  const semSessao = { at: 'x', herdr_pane: 'w1:p1', pid: '10', host: 'h1' }
  expect(ehMinha(semSessao, semSessao)).toBe(true)
  expect(ehMinha({ ...semSessao, herdr_pane: 'w9:p9' }, semSessao)).toBe(false)
})

test('pid igual em host diferente NÃO é minha', () => {
  const soPid = { at: 'x', pid: '10', host: 'h1' }
  expect(ehMinha({ ...soPid, host: 'h2' }, soPid)).toBe(false)
  expect(ehMinha(soPid, soPid)).toBe(true)
})

test('sem crachá, e crachá sem nenhuma camada em comum, não é minha', () => {
  expect(ehMinha(undefined, eu)).toBe(false)
  expect(ehMinha({ at: 'x' }, eu)).toBe(false)
})
