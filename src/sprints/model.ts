//! A SPRINT em disco: uma PASTA, e as tasks dela são as pastas de dentro.
//!
//!     01_projects/<proj>/sprints/999_<slug>/CONTEXT.md      a sprint
//!     01_projects/<proj>/sprints/999_<slug>/tasks/001_<nome>/  a task dela
//!
//! Lib, não comando — sem `main`, então @src/cli/core/scan.ts não a expõe. Os
//! subverbos (`new`, `list`) e o `my projects check` compartilham daqui: a regra
//! de forma mora num lugar só e quem imprime CONSOME, igual a
//! @src/projects/model.ts.
//!
//! A SPRINT E A TASK CONTAM PRA CIMA DESDE 001, e as duas pela mesma razão: o
//! número É a ordem em que se fez. `sprints/001_x` é o primeiro pacote do
//! projeto e `tasks/001_y` é a primeira task do pacote, então um `ls` lê a
//! história na ordem em que ela aconteceu (#sprint_order_and_size). Até 20/08 a
//! sprint contava pra BAIXO desde 999, pra a mais nova ficar no topo da sidebar;
//! duas contagens opostas na mesma árvore custavam mais que o topo valia.
//!
//! A CONTENÇÃO É O PONTEIRO. A task não declara `sprint:`, e a sprint não lista
//! as tasks: a pasta já diz. Campo pra isso seria a segunda fonte, e é sempre
//! ela que envelhece.
//!
//! depends_on: src/runs.ts · src/tasks/model.ts · src/shared/resolve.ts
//! impacts:    src/sprints/new.ts · src/sprints/list.ts · src/tasks/new.ts · src/projects/model.ts · src/tasks/list.ts · src/sprints/move.ts · src/sprints/units.ts

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CEILING_MIN, readTasksDir, type Task } from '../runs.ts'
import { PROJETOS, TASKS } from '../tasks/model.ts'
import { resolvePorPrefixo } from '../shared/resolve.ts'

export { CEILING_MIN }

/** O primeiro número de sprint de um projeto. Conta pra CIMA daqui. */
export const PRIMEIRA = 1

export type Sprint = {
  nnn: string
  n: number
  /** O nome da pasta inteiro — `999_serve_images_locally`. É o ENDEREÇO. */
  pasta: string
  dir: string
  /** O `# ` do `CONTEXT.md`, ou o nome da pasta quando não há doc. */
  titulo: string
  /** O estado é a PASTA, nunca um campo — ver `sprints()`. */
  estado: Estado
  tasks: Task[]
}

export const sprintsDir = (slugProjeto: string) => join(PROJETOS, slugProjeto, 'sprints')
/** O `tasks/` do PROJETO: a task que ainda não tem sprint. Mesma palavra que a
 *  sprint usa — as duas raízes que recebem task falam `tasks/`. */
export const tasksDir = (slugProjeto: string) => join(PROJETOS, slugProjeto, TASKS)

/** As sprints de um projeto, na ordem da pasta — e ela já é a ordem do
 *  construção, porque o número conta pra cima. */
//  não fui eu que inventei: outra sessão criou a pasta com cinco sprints
// propostas enquanto isto era escrito, e o `okf` a descobriu. Está aqui porque estado
// que o disco tem e o verbo não conhece é estado que ninguém consegue mover.
export const ESTADOS = ['aberta', 'suggested', 'inprogress', 'done'] as const
export type Estado = (typeof ESTADOS)[number]

/** O ESTADO de uma sprint é a PASTA em que ela está, igual ao da task:
 *  `sprints/999_x/` está aberta, `sprints/inprogress/999_x/` está rodando,
 *  `sprints/done/999_x/` acabou.
 *
 *  Pasta e não campo, e a razão é a mesma que fez a task virar pasta: campo
 *  `estado:` num CONTEXT.md é a segunda fonte que ninguém atualiza — o `ls` mostra
 *  o campo velho e a pessoa acredita nele. Aqui `ls sprints/inprogress` É a
 *  pergunta "o que está rodando agora", sem parser nenhum. O `done/` já existia por
 *  convenção no `biliboss_corretor` antes de qualquer verbo escrever nele. */
export function sprints(slugProjeto: string): Sprint[] {
  const raiz = sprintsDir(slugProjeto)
  if (!existsSync(raiz)) return []
  const daPasta = (base: string, estado: Estado): { pasta: string; dir: string; estado: Estado }[] =>
    existsSync(base)
      ? readdirSync(base)
          .filter((d) => /^\d+_/.test(d))
          .map((pasta) => ({ pasta, dir: join(base, pasta), estado }))
      : []
  return [
    ...daPasta(raiz, 'aberta'),
    // Deriva da LISTA, e não uma linha por estado: `suggested/` apareceu no disco
    // criado por outra sessão e o `list` não a via — três linhas escritas à mão são
    // três lugares pra esquecer o quarto estado.
    ...ESTADOS.filter((e) => e !== 'aberta').flatMap((e) => daPasta(join(raiz, e), e)),
  ]
    .sort((a, b) => a.pasta.localeCompare(b.pasta))
    .map(({ pasta, dir, estado }) => {
      const ctx = join(dir, 'CONTEXT.md')
      const titulo = existsSync(ctx) ? (readFileSync(ctx, 'utf8').match(/^#\s+(.+)$/m)?.[1]?.trim() ?? pasta) : pasta
      return { nnn: pasta.match(/^(\d+)_/)![1]!, n: Number(pasta.match(/^(\d+)_/)![1]), pasta, dir, titulo, estado, tasks: readTasksDir(join(dir, TASKS)) }
    })
}

/** O próximo número: o MAIOR que existe, mais um. Buraco não é preenchido — o
 *  NNN é endereço, e reusar faria duas sprints atenderem pela mesma citação.
 *
 *  Contava pra BAIXO desde 999 até 20/08, pra a mais nova aparecer no topo do
 *  `ls`. Trocou por decisão do dono: a sprint é a ORDEM em que o projeto foi
 *  construído, e ordem se lê de cima pra baixo — `001` é a primeira coisa que se
 *  fez, e é ela que explica as outras pra quem chega. */
export function proximoNNN(slugProjeto: string): number {
  const existentes = sprints(slugProjeto).map((s) => s.n)
  return existentes.length ? Math.max(...existentes) + 1 : PRIMEIRA
}

/** As tasks COMPROMETIDAS: o que a sprint ainda deve entregar. `backlog/` está
 *  escrita mas não prometida, `done/` já saiu — nenhuma das duas é trabalho pela
 *  frente, e o teto é um orçamento do que vem, não um histórico do que houve. */
export const comprometidas = (s: Sprint) => s.tasks.filter((t) => t.state !== 'backlog' && t.state !== 'done')

/** Minutos declarados na sprint — a SOMA, porque um agente roda as tasks em
 *  ORDEM. Task sem `duration` não entra na soma; quem acusa é `criticaDoTeto`.
 *
 *  Só as comprometidas. Medido em 19/08: a `991_share_external_v1` tinha ZERO
 *  tasks abertas, seis em `done/` somando 26 min, e era a ÚNICA sprint que o
 *  `projects check` reprovava — a que entregou tudo. A mensagem mandava "PARTIR
 *  em outra sprint", e não havia o que partir. */
export const minutos = (s: Sprint) => comprometidas(s).reduce((n, t) => n + (t.duration ?? 0), 0)

/** As tasks da sprint que não declaram `duration`. Sem elas a soma existe mas
 *  não vale: o teto de 10 min deixa de ser verificável, e "não verificável" é
 *  achado, não silêncio. */
export const semDuration = (s: Sprint) => comprometidas(s).filter((t) => t.duration === undefined).map((t) => t.id)

/** O que o teto tem de errado nesta sprint, ou nada. Um lugar só: o `list`
 *  imprime, o `projects check` vira `Finding`, e ninguém recalcula. */
export function criticaDoTeto(s: Sprint): string {
  const faltam = semDuration(s)
  const m = minutos(s)
  if (m > CEILING_MIN)
    return `soma ${m} min, acima do teto de ${CEILING_MIN} — a alavanca é PARTIR em outra sprint (#sprint_order_and_size)`
  if (faltam.length)
    return `${faltam.length} task(s) sem \`duration\` (${faltam.join(', ')}) — sem ela a soma é ${m} min e o teto de ${CEILING_MIN} não é verificável`
  return ''
}

/** A sprint CORRENTE: a mais nova (número menor) que ainda tem trabalho aberto.
 *  Sprint vazia conta como aberta — ela acabou de nascer e é justamente onde a
 *  próxima task vai. Sem nenhuma aberta, devolve `undefined`, e quem chama
 *  RECUSA em vez de escolher: enfiar task numa sprint fechada é o jeito de
 *  estourar o teto de uma sprint que já entregou. */
export const corrente = (slugProjeto: string): Sprint | undefined =>
  sprints(slugProjeto).find((s) => !s.tasks.length || s.tasks.some((t) => t.state !== 'done'))

/** A sprint por `999`, `999_slug` ou um pedaço do slug. Ambiguidade volta como
 *  erro com os candidatos — quem digitou escolhe. */
export function acharSprint(slugProjeto: string, alvo: string): Sprint | { erro: string } {
  const todas = sprints(slugProjeto)
  if (!todas.length)
    return { erro: `01_projects/${slugProjeto}/sprints/ não tem sprint — \`my sprints new "<título>" -P ${slugProjeto}\` cria a ${PRIMEIRA}` }
  const achado = resolvePorPrefixo(todas, alvo, (s) => s.pasta)
  if (!achado) return { erro: `nenhuma sprint casa "${alvo}" em ${slugProjeto}: ${todas.map((s) => s.pasta).join(', ')}` }
  if ('erro' in achado) return achado
  return achado.hit
}

/** As tasks SOLTAS — `tasks/NNN_*`, a forma de antes da sprint-pasta. Continuam
 *  sendo lidas enquanto existirem, e aparecem como achado no
 *  `my projects check`: é o que faz a migração ser verificável em vez de
 *  lembrada. */
export function tasksSoltas(slugProjeto: string): Task[] {
  const dir = tasksDir(slugProjeto)
  return existsSync(dir) ? readTasksDir(dir) : []
}
