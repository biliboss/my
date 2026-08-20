//! As três perguntas do `check`, contra uma árvore de mentira.
//!
//! CONTROLE NEGATIVO INCLUSO: uma task inteira e limpa não pode gerar achado.
//! Sem ele, um `check` que devolve tudo passa nos três positivos e continua
//! inútil — e um check que grita sempre é um check que ninguém roda.
//!
//! A árvore é montada em `tmpdir()` porque a regra é sobre a FORMA da pasta, não
//! sobre o `01_projects/` de hoje: aferir contra o disco real faria o teste
//! quebrar no dia em que alguém fechar uma task.
//!
//! depends_on: src/tasks/check.ts
//! impacts:    —

import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { achadosDaTask } from './check.ts'

/** Uma pasta de task de mentira: `<raiz>/tasks/<place>/001_x`, com o pedido e o
 *  output que o caso pede. `place` vazio põe a task no topo de `tasks/`. */
function task(place: string, pedido: string, saida: string): string {
  const raiz = mkdtempSync(join(tmpdir(), 'my-tasks-check-'))
  const dir = join(raiz, 'tasks', place, '001_x')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'CONTEXT.md'), `---\n${pedido}\n---\n\n# uma task de mentira\n`)
  writeFileSync(join(dir, 'output.md'), `---\n${saida}\n---\n\n# Output\n`)
  return dir
}

const diz = (dir: string) => achadosDaTask(dir).map((f) => f.says)

test('task inteira não gera achado — o controle negativo', () => {
  expect(diz(task('', 'proof: test 1 = 1', 'state: doing'))).toEqual([])
  expect(diz(task('done', 'proof: test 1 = 1', 'state: done\ncommit_end: abc123'))).toEqual([])
})

test('in_progress sem claim é achado', () => {
  expect(diz(task('in_progress', 'proof: test 1 = 1', 'state: doing'))[0]).toContain('sem claim')
})

test('in_progress com o desfecho já fechado diz que a pasta ficou pra trás', () => {
  expect(diz(task('in_progress', 'proof: test 1 = 1', 'state: blocked'))[0]).toContain('parada em in_progress/')
})

test('worktree que não existe mais é achado', () => {
  expect(diz(task('', 'proof: test 1 = 1', 'state: doing\nworktree: /nao/existe/em/lugar/nenhum'))[0]).toContain('worktree morta')
})

test('done sem prova é achado — sem `proof:` no pedido, ou sem `commit_end`', () => {
  expect(diz(task('done', 'duration: 5 min', 'state: done\ncommit_end: abc123'))[0]).toContain('sem `proof:`')
  expect(diz(task('done', 'proof: test 1 = 1', 'state: done'))[0]).toContain('sem `commit_end`')
})
