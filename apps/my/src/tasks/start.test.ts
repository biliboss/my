//! O que `src/tasks/` faz com o GIT — a pasta onde 4 de 4 arquivos tocam git e
//! não havia teste nenhum.
//!
//! Todo repo aqui é DESCARTÁVEL, cortado em `mktemp -d`. Nenhum comando roda
//! contra `~/src/me`: o assunto desta suíte é o stage largo, e a árvore tem
//! outras sessões escrevendo nela — o incidente de 16/08 (43 arquivos de outra
//! sessão num commit) é exatamente o que se afere aqui.
//!
//! POR QUE O GIT DAQUI É SPAWNADO COM ENV LIMPO, e não pelo `git()` de
//! `start.ts`: um hook de git exporta `GIT_DIR` e `GIT_INDEX_FILE` apontando pro
//! repo da casa, e eles têm precedência sobre o `-C`. Rodando dentro do
//! `pre-commit`, `git -C <tmp> commit` grava no índice do repo ERRADO. Medido: a
//! primeira versão deste arquivo passava sozinha e reprovava no hook.
//!
//! E não dá pra limpar de dentro: no Bun, `delete process.env.X` e
//! `process.env.X = ''` NÃO chegam ao filho — `Bun.spawnSync` congela o ambiente
//! na entrada do processo. A saída é passar `env` explícito no spawn, que é o que
//! `sh()` faz. O `git()` de produção é exercitado à parte, e o que isso revela
//! sobre ele está no RESULT.md.
//!
//! depends_on: src/tasks/start.ts
//! impacts:    —

import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { git } from './start.ts'

/** O ambiente sem nenhuma variável de git herdada — é o que torna estes testes
 *  iguais rodando à mão e rodando dentro do `pre-commit`. */
const LIMPO: Record<string, string> = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
) as Record<string, string>

/** `git` num repo, com env limpo. Mesma forma do `git()` de `start.ts` — stdout
 *  no sucesso, stderr na falha, nunca joga. */
function sh(repo: string, ...args: string[]): { ok: boolean; out: string } {
  const p = Bun.spawnSync(['git', '-C', repo, ...args], { env: LIMPO })
  return { ok: p.exitCode === 0, out: new TextDecoder().decode(p.exitCode === 0 ? p.stdout : p.stderr).trim() }
}

/** Um repo git de mentira, com um commit, fora da árvore da casa. */
function repoDescartavel(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tasks-test-'))
  expect(sh(dir, 'init', '-q', '-b', 'main').ok).toBe(true)
  sh(dir, 'config', 'user.email', 'test@test')
  sh(dir, 'config', 'user.name', 'test')
  writeFileSync(join(dir, 'README.md'), '# repo de teste\n')
  sh(dir, 'add', 'README.md')
  expect(sh(dir, 'commit', '-q', '-m', 'init').ok).toBe(true)
  return dir
}

const staged = (repo: string) => sh(repo, 'diff', '--cached', '--name-only').out.split('\n').filter(Boolean)

test('git() de start.ts: ok=false com o STDERR quando falha, ok=true com o stdout quando dá', () => {
  // O `git()` de PRODUÇÃO, exercitado de verdade — mas só quando o ambiente não
  // tem `GIT_DIR` herdado, porque ele não sanitiza env e apontaria pro repo
  // errado. Rodando dentro de um hook de git, este caso é pulado de propósito.
  if (process.env.GIT_DIR || process.env.GIT_INDEX_FILE) return

  const repo = repoDescartavel()
  const bom = git(repo, 'rev-parse', 'HEAD')
  expect(bom.ok).toBe(true)
  expect(bom.out).toMatch(/^[0-9a-f]{40}$/)

  // O contrato: nunca joga, e a falha volta com o texto que explica — é o
  // chamador que decide se aquilo é recusa ou informação.
  const ruim = git(repo, 'rev-parse', 'nao-existe-esta-ref')
  expect(ruim.ok).toBe(false)
  expect(ruim.out.length).toBeGreaterThan(0)

  const fora = git(mkdtempSync(join(tmpdir(), 'nao-repo-')), 'rev-parse', 'HEAD')
  expect(fora.ok).toBe(false)
})

test('a worktree sai com `add -b`, e o RETRY sem `-b` retoma o branch que já existe', () => {
  // É a sequência de `start.ts:88-95`, comando a comando: primeiro `add -b`, e se
  // falhar, `add` sem `-b`. O caso normal do retry é a task RETOMADA depois de um
  // `done` incompleto — o branch sobreviveu, a worktree não.
  const repo = repoDescartavel()
  const base = mkdtempSync(join(tmpdir(), 'wt-'))
  const wt1 = join(base, 'primeira')
  const branch = 'task/001_exemplo'

  expect(sh(repo, 'worktree', 'add', wt1, '-b', branch).ok).toBe(true)

  // Com o branch já existindo, `add -b` REPROVA — é a condição que dispara o retry.
  const wt2 = join(base, 'segunda')
  expect(sh(repo, 'worktree', 'add', wt2, '-b', branch).ok).toBe(false)

  // E o retry sem `-b` TAMBÉM reprova enquanto a worktree anterior ocupa o
  // branch: git não deixa o mesmo branch em duas worktrees. Ou seja, o fallback
  // do `start.ts` só salva quando a worktree velha já não existe.
  expect(sh(repo, 'worktree', 'add', wt2, branch).ok).toBe(false)

  // Solta a primeira, e aí o retry faz o que promete: retoma o branch existente.
  expect(sh(repo, 'worktree', 'remove', '--force', wt1).ok).toBe(true)
  expect(sh(repo, 'worktree', 'add', wt2, branch).ok).toBe(true)
  expect(sh(wt2, 'rev-parse', '--abbrev-ref', 'HEAD').out).toBe(branch)
})

test('DENTRO da worktree, o stage largo só alcança a worktree — é o que torna o isolamento seguro', () => {
  // A promessa do header do `done.ts`: "a worktree é da task, então tudo que está
  // sujo nela é da task". Aqui ela é aferida, e não assumida.
  const repo = repoDescartavel()
  const wt = join(mkdtempSync(join(tmpdir(), 'wt-')), 'task')
  expect(sh(repo, 'worktree', 'add', wt, '-b', 'task/002').ok).toBe(true)

  // Sujeira de OUTRA sessão no checkout principal, ao mesmo tempo.
  writeFileSync(join(repo, 'de_outra_sessao.txt'), 'trabalho alheio\n')
  // E o arquivo da task, dentro da worktree.
  writeFileSync(join(wt, 'da_task.txt'), 'meu trabalho\n')

  expect(sh(wt, 'add', '-A').ok).toBe(true)

  expect(staged(wt)).toEqual(['da_task.txt'])
  expect(staged(wt)).not.toContain('de_outra_sessao.txt')
})

test('ACHADO — sem worktree, o mesmo stage largo varre o trabalho de quem está do lado', () => {
  // Este teste NÃO afere um conserto: ele CONGELA o comportamento de hoje, porque
  // o escopo da task 051 proíbe mudar a semântica de git desta casa no mesmo
  // commit. Ver o RESULT.md.
  //
  // O caminho: `--here` faz o `start` gravar `worktree: ''` (`start.ts:117`), e o
  // `done` resolve `onde = String(t.saida.worktree || '') || process.cwd()`
  // (`done.ts:75`) — ou seja, o checkout COMPARTILHADO. O stage largo de
  // `done.ts:90` roda ali.
  const repo = repoDescartavel()

  // O que a task mexeu…
  writeFileSync(join(repo, 'da_task.txt'), 'meu trabalho\n')
  // …e o que outra sessão estava escrevendo no mesmo segundo.
  mkdirSync(join(repo, 'outra_pasta'), { recursive: true })
  writeFileSync(join(repo, 'outra_pasta', 'refactor_alheio.ts'), 'export const x = 1\n')

  expect(sh(repo, 'add', '-A').ok).toBe(true)

  // O arquivo alheio ENTRA. É o incidente de 16/08 reproduzido em miniatura.
  expect(staged(repo)).toContain('da_task.txt')
  expect(staged(repo)).toContain('outra_pasta/refactor_alheio.ts')
  expect(staged(repo).length).toBe(2)
})
