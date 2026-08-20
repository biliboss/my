//! A TASK em disco: onde ela mora, como se acha, e como se escreve o estado dela.
//!
//! Lib, não comando — sem `main`, então @src/cli/core/scan.ts não a expõe. Os
//! quatro subverbos (`new`, `list`, `start`, `done`) compartilham daqui pra não
//! ter quatro leitores do mesmo front matter divergindo na primeira correção.
//!
//! DOIS ARQUIVOS, DOIS TEMPOS VERBAIS, e é o que decide onde cada campo mora:
//! `CONTEXT.md` é o PEDIDO (o que fazer, a prova, a duração) e não muda porque o
//! trabalho andou; `output.md` é o RESULTADO (state, sessão, os dois shas, a
//! worktree) e é o único que `start`/`done` reescrevem. Estado no pedido faria
//! todo `git diff` de progresso tocar o arquivo que o próximo agente lê como
//! contrato.
//!
//! depends_on: src/runs.ts · src/shared/resolve.ts
//! impacts:    src/tasks/new.ts · src/tasks/list.ts · src/tasks/start.ts · src/tasks/done.ts · src/sprints/model.ts

import { eq } from 'drizzle-orm'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { frontMatter } from '../runs.ts'
import { db } from '../shared/db.ts'
import { pref } from '../shared/schema.ts'
import { resolvePorPrefixo } from '../shared/resolve.ts'
import { root as home, store } from '../home/paths.ts'

export const RAIZ = home()
export const PROJETOS = join(RAIZ, '01_projects')

/** A subpasta onde a task ENTREGUE é arquivada, dentro da sprint dela.
 *
 *  Existe pra sprint com dez tasks feitas não afogar a que está aberta na sidebar. O
 *  nome é constante e não config: pasta de arquivo com nome variável é pasta que cada
 *  projeto escreve diferente, e aí a varredura tem que adivinhar. */
export const ARQUIVO = 'done'

/** A subpasta da task ESCRITA e não comprometida, dentro da sprint dela.
 *
 *  Ela não gasta o teto de 10 min — é o que faz escrever a task deixar de custar a
 *  sprint. Sem isto a única forma de manter o teto era não escrever, e ideia que
 *  não vira arquivo morre com a sessão. #sprint_order_and_size */
export const BACKLOG = 'backlog'

/** A subpasta da task PUXADA por um agente — o terceiro estado-pasta.
 *
 *  Os quatro estados de uma task são quatro LUGARES, e `ls` é a pergunta:
 *
 *      tasks/backlog/<task>      escrita, não comprometida
 *      tasks/<task>              pronta pra começar
 *      tasks/in_progress/<task>  puxada por um agente — o crachá diz qual
 *      tasks/done/<task>         entregue
 *
 *  Pasta e não campo pela razão de sempre nesta casa: `state:` num arquivo é a
 *  segunda fonte que ninguém atualiza. Aqui `ls tasks/in_progress` É a pergunta
 *  "o que está sendo feito agora", sem parser nenhum — e um worker morto deixa a
 *  pasta parada onde todo mundo vê, em vez de um campo mentindo no topo. */
export const RODANDO = 'in_progress'

/** O segmento que SEMPRE precede uma task, em qualquer raiz que a receba.
 *
 *  `01_projects/<proj>/tasks/NNN_<nome>/` é a task que ainda não tem sprint;
 *  `01_projects/<proj>/sprints/NNN_<slug>/tasks/NNN_<nome>/` é a da sprint. As duas
 *  raízes falam a mesma palavra, e é isso que faz uma task ser reconhecível pelo
 *  CAMINHO — sem ela, `sprints/999_x/tasks/001_y/` e `sprints/999_x/docs/` eram
 *  indistinguíveis para quem varre, e a varredura tinha que adivinhar pelo `NNN_`. */
export const TASKS = 'tasks'
export const TPL = join(RAIZ, '03_resources/templates/system/task')
const PREF = 'tasks.project'

export const rel = (p: string) => p.slice(RAIZ.length).replace(/^\//, '')
export const projetos = () => readdirSync(PROJETOS).filter((d) => !d.endsWith('.md') && !d.startsWith('.'))
export const agora = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z')

/** O projeto corrente, em três degraus, e o primeiro que responde ganha. O
 *  `porque` existe pra o erro ENSINAR: "veio do cwd" e "veio do último usado"
 *  se consertam de formas diferentes. */
export function projetoCorrente(explicito?: string): { slug?: string; porque: string } {
  if (explicito) return { slug: explicito, porque: '--project' }
  // O `cwd` dentro de `01_projects/<slug>` é o caso em que perguntar seria pedir
  // ao humano o que o shell já respondeu.
  const m = process.cwd().match(/01_projects\/([a-z0-9][a-z0-9_-]*)/)
  if (m) return { slug: m[1], porque: 'cwd' }
  const guardado = db().select().from(pref).where(eq(pref.key, PREF)).all()[0]
  if (guardado) return { slug: guardado.value, porque: 'último usado' }
  return { porque: 'nada' }
}

export const lembra = (slug: string) =>
  db()
    .insert(pref)
    .values({ key: PREF, value: slug })
    .onConflictDoUpdate({ target: pref.key, set: { value: slug } })
    .run()

export type Task = {
  nnn: string
  slug: string
  dir: string
  /** O front matter do `CONTEXT.md` — o pedido: `sprint`, `duration`, `proof`. */
  pedido: Record<string, any>
  /** O front matter do `output.md` — o resultado: `state`, os dois shas, a worktree. */
  saida: Record<string, any>
  titulo: string
  corpo: string
}

/** Toda pasta de task de um projeto, nos TRÊS lugares: dentro da sprint
 *  (`sprints/NNN_<slug>/NNN_<nome>/`), ARQUIVADA nela
 *  (`sprints/NNN_<slug>/done/NNN_<nome>/`), e solta em `tasks/NNN_<nome>/`, que é a
 *  forma de antes da sprint-pasta e continua sendo LIDA enquanto existir. Quem
 *  acusa a forma velha é o `my projects check`; ler as três é o que faz a
 *  migração não quebrar nada no meio.
 *
 *  `done/` ENTRA na varredura, e não é detalhe: task arquivada que sai da lista faz
 *  o `proximoNNN` reusar um número já ocupado, e aí duas tasks diferentes passam a
 *  atender pela mesma citação — o NNN é ENDEREÇO. Arquivar muda onde a pasta MORA,
 *  nunca se ela existe. */
export function pastasDeTask(slugProjeto: string): string[] {
  const raiz = join(PROJETOS, slugProjeto)
  const tasksEm = (dir: string) =>
    existsSync(dir) ? readdirSync(dir).filter((d) => /^\d+_/.test(d)).sort().map((d) => join(dir, d)) : []
  const sprints = tasksEm(join(raiz, 'sprints'))
  return [
    ...sprints.flatMap((s) => [
      ...tasksEm(join(s, TASKS)),
      ...tasksEm(join(s, TASKS, BACKLOG)),
      ...tasksEm(join(s, TASKS, RODANDO)),
      ...tasksEm(join(s, TASKS, ARQUIVO)),
    ]),
    ...tasksEm(join(raiz, TASKS)),
    ...tasksEm(join(raiz, TASKS, BACKLOG)),
    ...tasksEm(join(raiz, TASKS, RODANDO)),
    ...tasksEm(join(raiz, TASKS, ARQUIVO)),
  ].filter((d) => existsSync(join(d, 'CONTEXT.md')))
}

/** A task pelo NNN, dentro de um projeto. Aceita `1`, `01`, `001`, o nome inteiro
 *  da pasta, e `999_slug/001` pra desempatar por sprint: quem digita não deveria
 *  contar zeros.
 *
 *  O NNN da task reinicia em cada sprint, então `3` pode casar duas vezes num
 *  projeto com duas sprints. Ambiguidade volta como ERRO com os candidatos, e
 *  nunca como "a primeira" — escolher calado é como se começa a task errada. */
export function acharTask(slugProjeto: string, alvo: string): Task | { erro: string } {
  const pastas = pastasDeTask(slugProjeto)
  if (!pastas.length)
    return { erro: `01_projects/${slugProjeto}/ não tem task — \`my sprints new "<título>"\` e depois \`my tasks new "<título>"\`` }
  const rotulo = (p: string) => p.slice(join(PROJETOS, slugProjeto).length + 1)
  // O rótulo da task é o caminho DENTRO do projeto (`sprints/999_x/tasks/001_y`),
  // e é por ele que se casa: a peneira de substring precisa enxergar a sprint,
  // senão `my tasks start 999_x` não acha nada.
  const achado = resolvePorPrefixo(pastas, alvo, rotulo, { dica: (h) => ` — passe o caminho, ex. \`${rotulo(h[0]!)}\`` })
  if (!achado) return { erro: `nenhuma task casa "${alvo}" em ${slugProjeto}: ${pastas.map(rotulo).join(', ')}` }
  if ('erro' in achado) return achado
  return ler(achado.hit)
}

export function ler(dir: string): Task {
  const nome = dir.split('/').pop()!
  const { fm, body } = frontMatter(readFileSync(join(dir, 'CONTEXT.md'), 'utf8'))
  const out = join(dir, 'output.md')
  return {
    nnn: nome.match(/^(\d+)_/)![1]!,
    slug: nome,
    dir,
    pedido: fm,
    saida: existsSync(out) ? frontMatter(readFileSync(out, 'utf8')).fm : {},
    titulo: body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? nome,
    corpo: body,
  }
}

/** Reescreve o front matter de um markdown preservando o corpo. Só ESTE caminho
 *  escreve estado: dois escritores no mesmo front matter é uma escrita apagando
 *  a outra, que é o bug que o `set`/`regen` da barra já pagou uma vez.
 *
 *  Serializa à mão porque `Bun.YAML` não tem stringify, e os valores aqui são
 *  escalares ou bloco `|` — dependência de YAML pra isso seria a única do
 *  arquivo. */
export function escreverFm(arquivo: string, patch: Record<string, any>): void {
  const bruto = readFileSync(arquivo, 'utf8')
  const { fm, body } = frontMatter(bruto)
  const merged: Record<string, any> = { ...fm, ...patch }
  const linhas: string[] = ['---']
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) {
      linhas.push(`${k}:`)
      for (const item of v) linhas.push(`  - ${item}`)
    } else if (typeof v === 'string' && (v.includes('\n') || v.includes(': '))) {
      linhas.push(`${k}: |`)
      for (const l of v.replace(/\n+$/, '').split('\n')) linhas.push(`  ${l}`)
    } else linhas.push(`${k}: ${v}`)
  }
  linhas.push('---', '')
  writeFileSync(arquivo, linhas.join('\n') + body.replace(/^\n+/, '\n'))
}

/** O repo onde o CÓDIGO desta task é escrito. `repo:` no pedido quando a task
 *  mexe em outro checkout; sem ele, é esta casa — #work_repo_vs_record_repo. */
export const workRepo = (t: Task) => String(t.pedido.repo ?? RAIZ).replace(/^~/, process.env.HOME ?? '~')

/** PUXA a task pra `in_progress/` — o estado é o LUGAR, então mudar de estado é
 *  mover a pasta. Devolve o caminho novo (absoluto), ou o mesmo quando ela já
 *  estava lá.
 *
 *  `renameSync` no mesmo filesystem é atômico, e é a mesma propriedade que o
 *  `done` usa pra arquivar. A trava `.doing/` vai junto dentro da pasta — ela é
 *  estado da task, não do lugar. */
export function puxar(dirTask: string): string {
  const nome = dirTask.split('/').pop()!
  const base = dirname(dirTask)
  if (base.endsWith(`/${RODANDO}`)) return dirTask
  // `backlog/001_x` e `tasks/001_x` sobem/descem pro mesmo destino: o `tasks/` da
  // sprint (ou do projeto) é o pai, e `in_progress/` mora ao lado de `backlog/`.
  const tasksDir = base.endsWith(`/${BACKLOG}`) || base.endsWith(`/${ARQUIVO}`) ? dirname(base) : base
  const destino = join(tasksDir, RODANDO, nome)
  mkdirSync(join(tasksDir, RODANDO), { recursive: true })
  renameSync(dirTask, destino)
  return destino
}

/** DEVOLVE a task pra fila: de `in_progress/` de volta pro `tasks/` que a
 *  contém. É o inverso de `puxar`, e existe porque soltar a trava sem mover
 *  deixaria a pasta dizendo "rodando" com ninguém dentro — o `ls` mentiria, que é
 *  exatamente o que estado-em-pasta veio impedir. */
export function devolver(dirTask: string): string {
  const nome = dirTask.split('/').pop()!
  const base = dirname(dirTask)
  if (!base.endsWith(`/${RODANDO}`)) return dirTask
  const destino = join(dirname(base), nome)
  renameSync(dirTask, destino)
  return destino
}

/** ARQUIVA a task: o destino é `tasks/done/`, e o cálculo sobe as pastas de
 *  ESTADO antes de descer no `done/`.
 *
 *  Medido 20/08, fechando a 001 do study-bloom: `dirname(t.dir) + done/` de uma
 *  task que estava em `tasks/in_progress/` produz `tasks/in_progress/done/` — um
 *  `done` ANINHADO dentro do `in_progress`, que a varredura não lê e o `ls` não
 *  explica. O estado é o lugar, então mudar de estado é sempre sair do lugar
 *  anterior, nunca cavar dentro dele. */
export function arquivar(dirTask: string): string {
  const nome = dirTask.split('/').pop()!
  const base = dirname(dirTask)
  if (base.endsWith(`/${ARQUIVO}`)) return dirTask
  const tasksDir = base.endsWith(`/${RODANDO}`) || base.endsWith(`/${BACKLOG}`) ? dirname(base) : base
  return join(tasksDir, ARQUIVO, nome)
}

/** O LUGAR da task na fila — o eixo que a PASTA carrega, e o único que o `ls`
 *  responde sem parser. `tasks` é a task no topo, prometida e ainda não puxada.
 *
 *  É EIXO SEPARADO do `state:` do `output.md`: o lugar diz onde ela está na fila,
 *  o state diz como ela terminou (`blocked`, `dropped`). Colapsar os dois num
 *  campo só perde o desfecho — foi o que o contrato fazia até 20/08. */
export type Place = typeof BACKLOG | typeof RODANDO | typeof ARQUIVO | typeof TASKS

/** O DESFECHO — o `state:` do `output.md`, o eixo que a pasta NÃO carrega.
 *
 *  `draft` nasce com a task (@src/tasks/new.ts), `doing` é do `start`, e os três
 *  finais são do `done`: `done` entregou, `blocked` travou, `dropped` não vai
 *  acontecer. Os dois últimos só existem AQUI — não há pasta `blocked/`, e é por
 *  isso que o eixo do lugar não pode ser o único. */
export type State = 'draft' | 'doing' | 'done' | 'blocked' | 'dropped'

/** O desfecho de uma task, com o default explícito: task sem `output.md` (ou com
 *  ele em branco) é `draft`, e não "sem estado". */
export const stateDe = (t: Task): State => (t.saida.state ?? 'draft') as State

export function placeDe(dirTask: string): Place {
  const pai = dirname(dirTask).split('/').pop()
  return pai === BACKLOG || pai === RODANDO || pai === ARQUIVO ? pai : TASKS
}

/** O PROJETO que contém a task, lido do CAMINHO — mesmo motivo do `sprintDe`
 *  logo abaixo: a contenção é o ponteiro, e campo pra isso é a segunda fonte. */
export function projetoDe(dirTask: string): string {
  return dirTask.slice(PROJETOS.length + 1).split('/')[0]!
}

/** A SPRINT que contém a task — `999_<slug>` —, lida do CAMINHO. A contenção é o
 *  ponteiro: a task não declara `sprint:`, porque campo pra isso seria a segunda
 *  fonte e é sempre ela que envelhece. `undefined` na forma velha
 *  (`tasks/NNN_*`), que continua sendo lida.
 *
 *  O `done/` é PULADO: arquivar não troca a sprint da task. Sem este salto, a task
 *  arquivada perderia a sprint e o `rotuloDe` devolveria `001_<nome>` sem prefixo —
 *  o mesmo rótulo que a `001` de outra sprint, disputando worktree e branch. */
export function sprintDe(t: Task): string | undefined {
  const partes = t.dir.split('/').filter((p) => p !== ARQUIVO && p !== BACKLOG && p !== RODANDO && p !== TASKS)
  return partes[partes.length - 3] === 'sprints' ? partes[partes.length - 2] : undefined
}

/** O rótulo ÚNICO de uma task dentro do projeto. O NNN da task reinicia em cada
 *  sprint, então `001_<nome>` não distingue duas sprints — o número da sprint na
 *  frente distingue, e é o que impede duas tasks de disputarem a mesma worktree
 *  e o mesmo branch (#task_identifier: o identificador carrega a sprint). */
export const rotuloDe = (t: Task) => {
  const s = sprintDe(t)
  return s ? `${s.match(/^(\d+)/)![1]}_${t.slug}` : t.slug
}

/** O branch de uma task: `task/<sprint>_<NNN>_<slug>`. Nome derivado da PASTA,
 *  então ele é reconstruível a partir do disco — branch guardado só no front
 *  matter se perde quando alguém apaga a linha. */
export const branchDe = (t: Task) => `task/${rotuloDe(t)}`

/** Onde as worktreES desta casa moram: `~/.me/worktrees/<projeto>__<NNN>_<nome>`.
 *
 *  FORA do repo, e num lugar só: dentro do repo, a varredura de arquivo do
 *  próprio `my` enxergaria a mesma task duas vezes; em `/tmp`, ela desaparece no
 *  reboot com trabalho não commitado dentro. `~/.me` já é a casa do estado de
 *  máquina (o `me.db` mora lá), então worktree acompanha.
 *
 *  O caminho é DERIVADO do projeto e da pasta, então ele é reconstruível — e é
 *  por isso que ele também aparece no `CONTEXT.md`: quem lê a task sabe onde o
 *  trabalho vai acontecer antes de rodar qualquer comando. */
export const WORKTREES = store('worktrees')
export const worktreeDe = (projeto: string, pasta: string) => join(WORKTREES, `${projeto}__${pasta}`)
