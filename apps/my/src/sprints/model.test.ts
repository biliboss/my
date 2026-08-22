import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { criticaDoTeto, minutos, proximoNNN, sprints, PRIMEIRA } from './model'
import { PROJETOS } from '../tasks/model'

/** Um projeto de mentira DENTRO de `01_projects/`, com prefixo `.` pra ficar fora
 *  de `slugs()` e da varredura da casa. É o único jeito honesto de testar isto:
 *  as funções leem do disco por caminho derivado da raiz, e mockar o `fs` testaria
 *  o mock. */
function projetoFake(): { slug: string; limpa: () => void } {
  const dir = mkdtempSync(join(PROJETOS, '.test_sprints_'))
  return { slug: dir.split('/').pop()!, limpa: () => rmSync(dir, { recursive: true, force: true }) }
}

const sprint = (slug: string, pasta: string) => mkdirSync(join(PROJETOS, slug, 'sprints', pasta), { recursive: true })

/** A task mora SEMPRE sob um `tasks/`, na raiz do projeto ou na da sprint — o
 *  helper escreve o segmento porque o invariante o exige, e um teste que monta o
 *  layout à mão sem ele provaria uma forma que o verbo não cria mais. */
const task = (slug: string, sprintPasta: string, pasta: string, duration?: number) => {
  const dir = join(PROJETOS, slug, 'sprints', sprintPasta, 'tasks', pasta)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'CONTEXT.md'), `---\n${duration === undefined ? '' : `duration: ${duration} min\n`}proof: |\n  true\n---\n\n# ${pasta}\n`)
}

test('a sprint conta pra CIMA desde 001, e o ls já sai na ordem em que se fez', () => {
  const { slug, limpa } = projetoFake()
  try {
    expect(proximoNNN(slug)).toBe(PRIMEIRA)
    sprint(slug, '001_serve_images_locally')
    expect(proximoNNN(slug)).toBe(2)
    sprint(slug, '002_keep_registry_named')
    expect(proximoNNN(slug)).toBe(3)
    // A ORDEM em que se fez é a ordem do `ls`: 001 é o primeiro pacote, e é ele
    // que explica os outros pra quem chega no projeto.
    expect(sprints(slug).map((s) => s.nnn)).toEqual(['001', '002'])
  } finally {
    limpa()
  }
})

test('o teto de 10 min é a SOMA das tasks da pasta, e a soma acusa', () => {
  const { slug, limpa } = projetoFake()
  try {
    sprint(slug, '001_serve_images_locally')
    task(slug, '001_serve_images_locally', '001_push_a_blob', 4)
    task(slug, '001_serve_images_locally', '002_pull_it_back', 5)
    const [s] = sprints(slug)
    expect(minutos(s!)).toBe(9)
    expect(criticaDoTeto(s!)).toBe('') // controle negativo: dentro do teto, nada a dizer

    task(slug, '001_serve_images_locally', '003_name_the_host', 3)
    expect(criticaDoTeto(sprints(slug)[0]!)).toMatch(/soma 12 min, acima do teto de 10/)
  } finally {
    limpa()
  }
})

test('task sem duration derruba a verificabilidade do teto, e isso é achado', () => {
  const { slug, limpa } = projetoFake()
  try {
    sprint(slug, '001_serve_images_locally')
    task(slug, '001_serve_images_locally', '001_push_a_blob', 4)
    task(slug, '001_serve_images_locally', '002_pull_it_back') // sem duration
    expect(criticaDoTeto(sprints(slug)[0]!)).toMatch(/1 task\(s\) sem `duration` \(002\)/)
  } finally {
    limpa()
  }
})

test('backlog e done não gastam o teto — o orçamento é do que vem, não do que houve', () => {
  const { slug, limpa } = projetoFake()
  try {
    sprint(slug, '999_share_external_v1')
    // O caso medido em 19/08: seis tasks entregues, nenhuma aberta, e a sprint que
    // entregou TUDO era a única que o `projects check` reprovava.
    for (const [i, min] of [4, 5, 4, 5, 4, 4].entries()) task(slug, '999_share_external_v1', `done/00${i + 1}_entregue`, min)
    const [entregue] = sprints(slug)
    expect(entregue!.tasks.length).toBe(6)   // some do topo, nunca da lista
    expect(minutos(entregue!)).toBe(0)       // e não gasta um minuto do teto
    expect(criticaDoTeto(entregue!)).toBe('')

    // Escrever a task no backlog não compromete a sprint: sem isto, escrever já
    // gastava o teto, e a alternativa era não escrever.
    sprint(slug, '998_next_one')
    task(slug, '998_next_one', '001_comprometida', 8)
    task(slug, '998_next_one', 'backlog/002_so_escrita', 30)
    const proxima = sprints(slug).find((s) => s.pasta === '998_next_one')!
    expect(proxima.tasks.length).toBe(2)
    expect(minutos(proxima)).toBe(8)
    expect(criticaDoTeto(proxima)).toBe('')

    // CONTROLE NEGATIVO: o teto continua reprovando o que ESTÁ comprometido.
    task(slug, '998_next_one', '003_estoura', 9)
    expect(criticaDoTeto(sprints(slug).find((s) => s.pasta === '998_next_one')!)).toContain('acima do teto')
  } finally {
    limpa()
  }
})
