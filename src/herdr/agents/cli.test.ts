//! O que quebra na DSL sem ninguém notar: o sigil no lugar errado.
//!
//! `a +b /c` tem que deixar `c` EMBAIXO de `b`, não embaixo de `a` — o relativo é o
//! último pane, e é isso que faz a expressão ler da esquerda pra direita como a
//! tela se monta. Se o parser ancorar no primeiro, o layout sai certo pra dois
//! agentes e errado pra três, que é o pior tipo de bug: passa no caso que se testa
//! à mão.

import { expect, test } from 'bun:test'

import { parseLayout } from './cli.ts'

test('o sigil posiciona relativo ao anterior, e o primeiro não leva sigil', () => {
  expect(parseLayout(['alice'])).toEqual({ ok: true, spots: [{ name: 'alice', where: 'root' }] })

  expect(parseLayout(['a', '+b', '/c', '+d'])).toEqual({
    ok: true,
    spots: [
      { name: 'a', where: 'root' },
      { name: 'b', where: 'right' },
      { name: 'c', where: 'down' },
      { name: 'd', where: 'right' },
    ],
  })
})

test('recusa antes de abrir workspace: sigil no primeiro, nome repetido, nome inválido', () => {
  // Controle negativo: a expressão boa acima passa, então um `ok: false` aqui é a
  // recusa funcionando e não o parser recusando tudo.
  expect(parseLayout(['+a']).ok).toBe(false)
  expect(parseLayout(['a', '+a']).ok).toBe(false)
  expect(parseLayout(['A']).ok).toBe(false)          // maiúscula: o herdr recusa
  expect(parseLayout(['1a']).ok).toBe(false)         // começa por dígito
  expect(parseLayout(['+']).ok).toBe(false)          // sigil sem nome
  expect(parseLayout([]).ok).toBe(false)
})
