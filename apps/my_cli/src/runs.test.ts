//! O dialeto `pasta`: a task lida da PASTA, com o front matter dos dois arquivos.
//!
//! Um teste, e ele cobre o que quebra calado: front matter que não parseia, task
//! sem `output.md`, e a ORDEM (a prioridade vem do NNN, não do que o `readdir`
//! devolveu). Os dois dialetos de yaml já eram cobertos pelo uso; este é novo.

import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { frontMatter, readTasksDir } from './runs.ts'

function fixture(): string {
  const raiz = mkdtempSync(join(tmpdir(), 'me-tasks-'))
  const task = (nome: string, ctx: string, out?: string) => {
    mkdirSync(join(raiz, nome), { recursive: true })
    writeFileSync(join(raiz, nome, 'CONTEXT.md'), ctx)
    if (out) writeFileSync(join(raiz, nome, 'output.md'), out)
  }
  // Fora de ordem no disco de propósito: se a ordenação vier do `readdir`, o teste
  // acusa.
  task('002_write_config', '---\nduration: 2 min\nproof: |\n  test -f x\n---\n\n# registry listens on 127.0.0.1:5000\n', '---\nstate: doing\n---\n')
  task('001_install_zot', '---\nduration: 3 min\nproof: |\n  zot --version\n---\n\n# zot binary lives in ~/.local/bin\n')
  task('003_broken_front_matter', '---\nduration: [1,\n---\n\n# título ainda sai\n')
  // Pasta que não casa `NNN_`: não é task, e não pode virar uma.
  mkdirSync(join(raiz, 'refs'), { recursive: true })
  return raiz
}

test('lê as tasks na ordem da prioridade, não na do readdir', () => {
  const tasks = readTasksDir(fixture())
  expect(tasks.map((t) => t.id)).toEqual(['001', '002', '003'])
  expect(tasks[0]!.title).toBe('zot binary lives in ~/.local/bin')
  expect(tasks[0]!.duration).toBe(3)
  expect(tasks[0]!.proof?.trim()).toBe('zot --version')
})

test('o state vem do output.md, e ausência dele é draft (undefined)', () => {
  const tasks = readTasksDir(fixture())
  expect(tasks.find((t) => t.id === '002')!.state).toBe('doing')
  expect(tasks.find((t) => t.id === '001')!.state).toBeUndefined()
})

test('front matter quebrado não engole a task — o título continua saindo', () => {
  const t = readTasksDir(fixture()).find((x) => x.id === '003')!
  expect(t.title).toBe('título ainda sai')
  expect(t.proof).toBeUndefined()
})

test('pasta sem NNN_ não é task', () => {
  expect(readTasksDir(fixture()).some((t) => t.dir?.endsWith('refs'))).toBe(false)
})

test('frontMatter só reconhece a PRIMEIRA cerca', () => {
  const { fm, body } = frontMatter('---\na: 1\n---\n\ntexto com --- no meio\n')
  expect(fm).toEqual({ a: 1 })
  expect(body).toContain('--- no meio')
})
