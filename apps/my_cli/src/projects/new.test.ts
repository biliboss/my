//! A heurística de ESTRUTURA: `tasks/` direto ou `sprints/`, e quando ela cala.
//!
//! O que se afere é o que custa caro errar: projeto de investigação nascendo em
//! `sprints/` (e o teto de 10 min cobrando pacote de quem não tem pacote), e
//! projeto de entrega nascendo solto (e o `unsprinted_tasks` aberto por meses).
//! O terceiro caso — sinal fraco — não pode ser testado aqui: ele ABRE POPUP e
//! espera gente, então o teste afere só que `--estrutura` atalha o popup.
//!
//! O comando escreve em `01_projects/` por força do CLI (não tem `--dir`), então
//! vale a exceção do scratch: slug com prefixo `zz-teste-`, caminho LITERAL no
//! `rm`, e nada de glob.
//!
//! depends_on: src/projects/new.ts
//! impacts:    —

import { expect, test, afterAll } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { PROJETOS, RAIZ } from './model.ts'
import { code } from '../home/paths.ts'

const SLUGS = ['zz-teste-heuristica-a', 'zz-teste-heuristica-b', 'zz-teste-heuristica-c']
afterAll(() => {
  rmSync(join(PROJETOS, 'zz-teste-heuristica-a'), { recursive: true, force: true })
  rmSync(join(PROJETOS, 'zz-teste-heuristica-b'), { recursive: true, force: true })
  rmSync(join(PROJETOS, 'zz-teste-heuristica-c'), { recursive: true, force: true })
})

const cria = (slug: string, resultado: string, ...extra: string[]) => {
  const p = Bun.spawnSync(
    // O SCRIPT vem do CÓDIGO, o `cwd` é a CASA — e até 20/08 os dois eram
    // `RAIZ`, porque eram a mesma pasta. Separados, `join(RAIZ, 'src/cli/my.ts')`
    // aponta pro vazio e o `spawnSync` devolve stdout VAZIO: o teste falhava
    // dizendo "esperava .../sprints/, recebi ''", que não parece caminho errado.
    ['bun', 'run', join(code(), 'src/cli/my.ts'), 'projects', 'new', slug, '--resultado', resultado, '--area', '04-experimentos', ...extra],
    { cwd: RAIZ },
  )
  return new TextDecoder().decode(p.stdout)
}

test('resultado de ENTREGA com prazo longo nasce em sprints/', () => {
  const out = cria(SLUGS[0]!, 'a plataforma de cobrança integra com o Omie e entra em produção pro cliente', '--prazo', '2099-01-01')
  expect(out).toContain(`${SLUGS[0]}/sprints/`)
})

test('resultado de INVESTIGAÇÃO nasce em tasks/ direto', () => {
  const out = cria(SLUGS[1]!, 'medir se o viewer mostra o que o console não mostra', '--prazo', '2099-01-01')
  // Controle negativo junto: o prazo longo empurra pra sprints, e mesmo assim o
  // sinal de investigação ganha — senão a heurística seria só o calendário.
  expect(out).toContain(`${SLUGS[1]}/tasks/`)
})

test('`--estrutura` atalha o popup mesmo com sinal fraco', () => {
  // Sem prazo e sem palavra de nenhum dos dois lados, a confiança fica em 50 e o
  // comando PERGUNTARIA. Com a flag, ele não pergunta nada — e é isto que deixa
  // o comando rodável sem tela.
  const out = cria(SLUGS[2]!, 'o inbox responde por conta propria', '--estrutura', 'sprints')
  expect(out).toContain(`${SLUGS[2]}/sprints/`)
})
