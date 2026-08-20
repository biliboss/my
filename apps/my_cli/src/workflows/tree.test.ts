//! O que pode apodrecer aqui: o disco mudar de forma e o leitor continuar
//! achando que sabe. Tudo é lido de `02_areas/00_workflows/` de verdade — um
//! fixture seria uma segunda opinião sobre o formato, que é justamente o que
//! não se quer testar.
//!
//! E foi o que aconteceu em 17/08: as famílias foram renumeradas
//! (`00_product`/`01_engineering` viraram `00_main`, `02_system` virou
//! `02_system`) e este arquivo continuou afirmando os nomes velhos — quatro
//! testes vermelhos apontando pro disco certo. Por isso os nomes de família
//! saem de `categories()` agora, e só o que é CONTRATO fica escrito à mão.

import { expect, test } from 'bun:test'

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { WORKFLOWS, body, categories, find, workflows } from './tree.ts'

test('as categorias saem do disco, e nenhuma é vazia de sentido', () => {
  const cats = categories()
  expect(cats.length).toBeGreaterThan(0) // controle negativo: lista vazia passaria em tudo abaixo
  // `00_main` é CONTRATO — é a família dos workflows que fazem o trabalho, e o
  // mapa da casa aponta pra ela pelo nome.
  expect(cats).toContain('00_main')

  // O invariante NÃO é "tem workflow dentro": `03_agents` nasceu em 17/08 sem
  // filho nenhum, porque ela É a folha — a frota não é uma coisa que se roda, é
  // o substrato em que as outras rodam, e o contrato dela é o próprio
  // `CONTEXT.md`. O que não pode existir é família que não diz nada: sem filho E
  // sem contrato, ninguém sabe o que aquela pasta faz ali.
  for (const c of cats)
    expect({ c, ok: workflows(c).length > 0 || existsSync(join(WORKFLOWS, c, 'CONTEXT.md')) }).toEqual({ c, ok: true })
})

test('acha o workflow com o número e sem ele', () => {
  expect(find('01_coding')).toEqual({ category: '00_main', workflow: '01_coding' })
  expect(find('coding')).toEqual({ category: '00_main', workflow: '01_coding' })
  expect(find('nao_existe')).toBeUndefined()
})

test('o corpo é o arquivo, não um resumo dele', () => {
  const md = body('00_main', '01_coding')
  expect(md).toContain('# 01_coding')
  expect(md).toContain('## Output')
})

test('um step de outra família também resolve — é o mapa inteiro, não só os mains', () => {
  const hit = find('do_a_drip')
  expect(hit).toEqual({ category: '02_system', workflow: '004_do_a_drip' })
})

test('nome ambíguo é ERRO, não sorteio', () => {
  // `research` existe em duas famílias; devolver a primeira é como pedir um e
  // trabalhar no outro por meia hora — medido em 17/08.
  const ambiguos = categories().flatMap((c) => workflows(c).map((w) => w.replace(/^\d+_/, '')))
  const repetido = ambiguos.find((n, i) => ambiguos.indexOf(n) !== i)
  if (repetido) expect(() => find(repetido)).toThrow(/matches/)
})
