//! O pedaço do `send` que dá pra testar sem um pane: qual trecho a confirmação
//! procura na tela.
//!
//!     bun test ./src/herdr/panes/send.test.ts
//!
//! O resto — chegou? saiu? — depende de um TUI vivo e está provado à mão no
//! RESULT.md da task 056.

import { expect, test } from 'bun:test'
import { tail } from './send.ts'

test('o trecho é o FIM da última linha — se o fim chegou, o começo chegou antes', () => {
  expect(tail('roda o check')).toBe('roda o check')

  // Longo: só o fim entra, porque um pane estreito quebra a linha e um match do
  // texto inteiro nunca casaria.
  const longo = 'x'.repeat(200) + 'ATERRISSOU'
  expect(tail(longo).endsWith('ATERRISSOU')).toBe(true)
  expect(tail(longo).length).toBeLessThanOrEqual(40)
})

test('multi-linha usa a ÚLTIMA linha com conteúdo, não a primeira', () => {
  // A primeira linha é a que o olho vê primeiro e a errada pra confirmar: ela
  // aparece na tela ANTES do resto do texto ter chegado.
  expect(tail('primeira\nsegunda\nterceira')).toBe('terceira')
  expect(tail('primeira\nultima\n\n  \n')).toBe('ultima')
})

test('espaço em volta não entra no match — a tela não o preserva de forma confiável', () => {
  expect(tail('   com espaco   ')).toBe('com espaco')
})

test('texto vazio devolve vazio em vez de estourar', () => {
  // Um match vazio casaria com QUALQUER tela, então quem chama não pode receber
  // um needle vazio achando que confirmou alguma coisa. `send` só chega aqui com
  // texto, mas o degrau fica explícito.
  expect(tail('')).toBe('')
  expect(tail('\n\n')).toBe('')
})
