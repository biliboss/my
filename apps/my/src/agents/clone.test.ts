//! O NOME do clone: a única lógica de `clone.ts` que não é chamada ao herdr.
//!
//! Errar aqui dá dois panes com o mesmo nome — e o nome é como um humano
//! endereça o clone, então dois `worker-1` é trabalho indo pro pane errado.
//!
//! depends_on: src/agents/clone.ts
//! impacts:    —

import { expect, test } from 'bun:test'
import { baseCurta, nomeDoClone, proximoN } from './clone.ts'

test('o sufixo `-N` sai do nome, e quem não tem é o original', () => {
  expect(nomeDoClone('worker')).toEqual({ base: 'worker', n: 0 })
  expect(nomeDoClone('worker-2')).toEqual({ base: 'worker', n: 2 })
  // Hífen no meio não é sufixo: `worker-fila` é nome, não clone número `fila`.
  expect(nomeDoClone('worker-fila')).toEqual({ base: 'worker-fila', n: 0 })
})

test('o próximo N olha os IRMÃOS, não conta na mão', () => {
  expect(proximoN('worker', ['worker'])).toBe(1)
  expect(proximoN('worker', ['worker', 'worker-1', 'worker-2'])).toBe(3)
  // Buraco não é preenchido: o número é endereço, e reusar faria dois panes
  // atenderem pelo mesmo nome em dois momentos.
  expect(proximoN('worker', ['worker-1', 'worker-3'])).toBe(4)
  // Clone de OUTRO agente na mesma aba não empurra a numeração deste.
  expect(proximoN('worker', ['outro-1', 'outro-2'])).toBe(1)
})

test('o nome curto tira o número ANTES de encurtar', () => {
  // `…standalone-1` encurtado primeiro perderia o `-1`, e o segundo clone
  // renasceria `-1` por cima do primeiro.
  const x = nomeDoClone('Setup study_bloom project with bloom standalone-1')
  expect(x.n).toBe(1)
  expect(baseCurta(x.base)).toBe('Setup-study_bloom-projec')
  expect(baseCurta('worker fila')).toBe('worker-fila')
})
