#!/usr/bin/env bun
//! O run de um main, lido do disco — o INPUT do ciclo de código.
//!
//!     my runs                              todos, o mais novo primeiro
//!     my runs 999_via_share_external       um, com a issue de cada sprint
//!     my runs 999_via --tsv                uma linha por task, pra `awk`
//!     my runs 999_via --jsonl              uma task por linha, pra `while read`
//!     my runs 999_via --json               o run inteiro, pra `jq`
//!
//! QUATRO FORMATOS, e o grão muda com o formato. `--tsv` e `--jsonl` saem por
//! TASK, porque a task é a linha que alguém filtra; `--json` sai inteiro, porque
//! aí quem lê é `jq` e a hierarquia É o valor. Comando que só fala com humano
//! obriga o próximo a reparsear texto alinhado — e alinhamento muda.
//!
//! O ciclo de código começa CONSULTANDO O OUTPUT do produto: o plano, o repo, a
//! base, e o link da issue de cada sprint. Era esse passo que existia só na
//! cabeça de quem rodava — @01_projects/_parked/viacorretor/features/share_external/callstack_do_sprint.md.
//!
//! FALA OS DOIS DIALETOS, e isso não é gentileza: o leitor antigo (`meta.ts
//! plan`) só entende `sprint_001:` como CHAVE DE TOPO e `command:` por task, e
//! devolveu `sprints: []` calado pro plano de 17/08, que escreve `sprints:` como
//! LISTA e `proof:` por task. Zero sprint vira "toda task já tem commit", e o
//! ciclo reporta sucesso sem subir um agente. Enum aberto pra dado de fora:
//! entende as duas formas, e diz qual leu.
//!
//! DIZ O QUE FALTA PRA RODAR, e não adivinha. `repo:` na forma `<owner>/<repo>`
//! é slug de GitHub, não caminho de disco — o ciclo precisa dos dois, e o que
//! não vem declarado sai como buraco em vez de virar default silencioso.
//!
//! depends_on: 02_areas/00_workflows/00_main/
//! impacts:    02_areas/00_workflows/00_main/01_coding/CONTEXT.md

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { resolvePorPrefixo } from './shared/resolve.ts'
import { home } from './shared/file.ts'

const ROOT = home()
const WORKFLOWS = join(ROOT, '02_areas/00_workflows')

export type Task = {
  id: string
  title: string
  proof?: string
  duration?: number
  references?: string[]
  /** A PASTA da task, relativa à raiz do repo — só o dialeto `pasta` a tem. É o
   *  endereço que o agente abre, e o que faz `refs/` existir. */
  dir?: string
  /** O que mora na pasta da task além do `CONTEXT.md`: `refs/`, uma nota, um
   *  symlink pro arquivo real. Listado e não lido — quem decide o que importa é
   *  o agente que abre a task, e ler tudo aqui carregaria o repo inteiro. */
  refs?: string[]
  /** O `state:` do `output.md` da task — `draft` até quem executou preencher. É
   *  o único campo de progresso que NÃO vem do git, e por isso mora no output e
   *  não no CONTEXT: o CONTEXT é o pedido, e pedido não muda porque o trabalho
   *  andou. */
  state?: string
  /** O que a task pede em prosa, quando o plano escreveu além do título. Lido
   *  porque o prompt do agente é montado a partir dele — `my meta plan`. */
  description?: string
  /** Minutos MEDIDOS depois de rodar, contra os `duration` declarados. Só o
   *  dialeto antigo escreve, e é ele que sustenta #estimate_becomes_measurement. */
  actual?: string
}
export type Sprint = {
  id: string
  title: string
  issue?: number
  tasks: Task[]
  /** Declarado antes de rodar; `actual` é o que se mediu depois. Strings porque
   *  o disco traz `8 min`, `00:08` e `8` — normalizar aqui apagaria a forma que
   *  o humano escreveu, e quem soma usa `minutes()` sobre as tasks. */
  estimated?: string
  actual?: string
  /** As reclamações/itens que esta sprint cobre. */
  covers?: string[]
  /** LEQUE É O PADRÃO — #sprint_package. Uma sprint que precisa esperar diz de
   *  QUEM; lista vazia é "roda em paralelo", que é o default da casa. */
  waits_for?: string[]
}

/** Minutos declarados na sprint — a SOMA, porque um agente roda as tasks em
 *  ORDEM. O teto é 10, e acima dele a alavanca é PARTIR — #sprint_order_and_size.
 *
 *  Só o que está COMPROMETIDO: `backlog/` está escrita e não prometida, `done/` já
 *  saiu, e o teto é orçamento do que vem. A mesma conta vive em
 *  `sprints/model.ts#minutos` para a sprint-pasta; as duas concordam de propósito,
 *  porque duas somas discordando é como o teto passa a dizer coisas diferentes
 *  dependendo de qual comando você rodou. */
export const CEILING_MIN = 10
export const minutes = (s: Sprint) =>
  s.tasks.filter((t) => t.state !== 'backlog' && t.state !== 'done').reduce((n, t) => n + (t.duration ?? 0), 0)

/** `10 min`, `9 minutos`, `00:08`, `8` — dado que vem de fora vem em N formas, e
 *  o que não casa nenhuma volta como `undefined` em vez de virar zero calado. */
export function parseMin(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return undefined
  const mm = v.match(/^(\d+):(\d+)$/)
  if (mm) return Number(mm[1]) + Number(mm[2]) / 60
  const n = v.match(/(\d+(?:[.,]\d+)?)/)
  return n ? Number(n[1]!.replace(',', '.')) : undefined
}
export type Run = {
  run: string
  main: string
  path: string
  files: string[]
  /** Os yamls que não parseiam. Lista vazia é diferente de ausência: ausência é
   *  "não olhei", vazia é "olhei e estão todos bons". */
  broken: string[]
  /** A fase em que o ciclo está, escrita pelo main que o roda. Ausente = o run
   *  não declara estado, e "não declara" é diferente de "está aberto". */
  at?: string
  dialeto?: 'pasta' | 'lista' | 'chave_de_topo'
  /** `01_projects/<proj>/tasks` — a pasta onde as tasks deste run moram. Quando
   *  presente, ela É o plano e os dois dialetos de yaml não são lidos. */
  tasksDir?: string
  repo?: string
  workRepo?: string
  base?: string
  label?: string
  serve?: string
  sprints: Sprint[]
}

/** Todo `output/NNN_<slug>/` de todo workflow, achado no disco. */
export function index(dir = WORKFLOWS): Run[] {
  const out: Run[] = []
  for (const family of dirs(dir))
    for (const wf of dirs(join(dir, family)))
      for (const run of dirs(join(dir, family, wf, 'output')))
        out.push(read(join(dir, family, wf, 'output', run), wf))
  // O número conta pra BAIXO desde 999 — o mais novo tem o MENOR número.
  return out.sort((a, b) => a.run.localeCompare(b.run))
}

const dirs = (p: string) =>
  existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []

/** Os campos da sprint que só o board e o `plan` leem. Os dois nomes, PT e EN:
 *  os campos foram traduzidos no meio do caminho, e as runs velhas são história,
 *  não dívida. */
const sprintExtras = (s: any) => ({
  estimated: s?.estimated_duration ?? s?.duracao_estimada ?? undefined,
  actual: s?.actual_duration ?? undefined,
  covers: s?.covers ?? s?.cobre ?? [],
  waits_for: s?.waits_for ?? s?.espera_por ?? [],
})

/** Idem, na task. `description` é o que vira prompt do agente em `my meta plan`. */
const taskExtras = (t: any) => ({
  description: (t?.description ?? t?.descricao ?? '').toString().trim() || undefined,
  actual: t?.actual_duration ?? undefined,
})

/** Os yamls do run, fundidos. Um run escreve N arquivos e cada etapa acrescenta
 *  o dela — ler um só é como perguntar do plano pro registro da entrevista. */
export function read(path: string, main: string): Run {
  const files = readdirSync(path).sort()
  const docs = files
    // `*_gh.yaml` é ARTEFATO DERIVADO, não plano: `sprints_gh.yaml` traz
    // `sprints:` com `tasks` como CONTAGEM, e ao ser fundido aqui ele sobrescreveu
    // o plano e quebrou o `.map` na segunda rodada — medido em 17/08. O que este
    // leitor funde é o que o HUMANO (ou o produto) escreveu; o que a máquina
    // derivou tem sufixo e fica de fora.
    .filter((f) => f.endsWith('.yaml') && !f.endsWith('_gh.yaml'))
    .map((f) => {
      try {
        return (Bun.YAML.parse(readFileSync(join(path, f), 'utf8')) ?? {}) as Record<string, any>
      } catch (e) {
        // NÃO engole. Um yaml quebrado fazia o run aparecer VAZIO, e vazio é uma
        // resposta ("nada foi planejado") — quebrado é outra. Medido em 17/08: um
        // `state.yaml` com `:` solto num valor multi-linha derrubou o `serve:` do
        // run e a sidebar mandou ele pra sistema, calada. Vai pra stderr porque
        // stdout é dado (`--tsv`, `--jsonl`), e o `broken` sai no `--json`.
        console.error(`[runs] ${basename(path)}/${f}: ${(e as Error).message.split('\n')[0]}`)
        return { __broken: [f] } as Record<string, any>
      }
    })
  const y: Record<string, any> = docs.reduce((acc: Record<string, any>, d) => {
    const quebrados = [...(acc.__broken ?? []), ...(d.__broken ?? [])]
    return Object.assign(acc, d, quebrados.length ? { __broken: quebrados } : {})
  }, {})

  const run: Run = {
    run: basename(path),
    main,
    // Relativo à raiz do REPO, e derivado do caminho recebido: fixar em `ROOT`
    // (a raiz do módulo) fazia o teste da sidebar montar caminho da árvore real
    // dentro de uma fixture temporária.
    path: path.replace(/^.*?(?=02_areas\/)/, ''),
    files,
    broken: y.__broken ?? [],
    at: y.at,
    repo: y.repo ?? y.repo_do_trabalho,
    // `work_repo` é o CAMINHO no disco; `repo` é o slug do GitHub. Os dois
    // existem porque o ciclo escreve num e publica no outro — e foi a falta
    // desta distinção que fez um plano apontar pro repo do registro.
    workRepo: y.work_repo ?? y.repo_de_trabalho,
    base: y.base ?? y.branch ?? y.branch_alvo,
    label: y.label,
    serve: y.serve,
    tasksDir: y.tasks_dir ?? y.tasks,
    sprints: [],
  }

  // Dialeto NOVO: a task é uma PASTA — `<projeto>/tasks/NNN_<slug>/CONTEXT.md`.
  // Vem primeiro porque é cutover, não terceira opção: run que declara
  // `tasks_dir:` tem o plano em disco, e ler yaml junto seria dual-write.
  if (run.tasksDir) {
    run.dialeto = 'pasta'
    // UM pacote, e ele é do CICLO: a task não declara a que sprint pertence, então
    // quem lê a pasta lê a lista inteira, na ordem da prioridade.
    run.sprints = [{ id: 'tasks', title: `${run.tasksDir}`, tasks: readTasksDir(join(ROOT, run.tasksDir)) }]
    return run
  }

  // Dialeto NOVO: `sprints:` como lista, `n:`/`titulo:`, task com `proof:`.
  // `Array.isArray(tasks)` e não só `sprints`: dado de fora pode trazer a chave
  // com outra forma, e enum aberto vale pra estrutura também — o que não casa a
  // forma não é lido, em vez de estourar no `.map`.
  if (Array.isArray(y.sprints) && y.sprints.some((s: any) => Array.isArray(s?.tasks ?? s?.tarefas))) {
    run.dialeto = 'lista'
    run.sprints = y.sprints.map((s: any, i: number) => ({
      id: `S${s.n ?? i + 1}`,
      title: s.titulo ?? s.title ?? '',
      issue: s.issue,
      ...sprintExtras(s),
      tasks: (s.tasks ?? s.tarefas ?? []).map((t: any, k: number) => ({
        id: t.id ?? `T${k + 1}`,
        title: t.title ?? t.titulo ?? t.tarefa ?? '',
        proof: t.proof ?? t.command ?? t.prova,
        duration: parseMin(t.duration ?? t.duracao ?? t.estimated_duration),
        references: t.references ?? t.referencias,
        ...taskExtras(t),
      })),
    }))
    return run
  }

  // Dialeto ANTIGO: `sprint_001:` como chave de topo, task com `command:`.
  const keys = Object.keys(y).filter((k) => /^sprint_\d+$/.test(k)).sort()
  if (keys.length) {
    run.dialeto = 'chave_de_topo'
    run.sprints = keys.map((k) => ({
      id: k.replace('sprint_', 'S'),
      title: y[k]?.title ?? y[k]?.titulo ?? '',
      issue: y[k]?.issue,
      ...sprintExtras(y[k]),
      tasks: (y[k]?.tasks ?? []).map((t: any, i: number) => ({
        id: t.id ?? `T${i + 1}`,
        title: t.title ?? t.titulo ?? '',
        proof: t.command ?? t.proof,
        duration: parseMin(t.duration ?? t.duracao),
        references: t.references,
        ...taskExtras(t),
      })),
    }))
  }
  return run
}

/** O front matter de um markdown, e o corpo depois dele. Só a primeira cerca
 *  conta: `---` no meio de um parágrafo é texto, não delimitador. */
export function frontMatter(md: string): { fm: Record<string, any>; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { fm: {}, body: md }
  try {
    return { fm: (Bun.YAML.parse(m[1]!) ?? {}) as Record<string, any>, body: md.slice(m[0].length) }
  } catch {
    // Front matter torto é o pedido ilegível, e o buraco aparece como task sem
    // `proof:` — que é exatamente o que ela é enquanto ninguém conserta o yaml.
    return { fm: {}, body: md.slice(m[0].length) }
  }
}

/** As tasks de um projeto, lidas da PASTA. `NNN_<slug>/` ordenado pelo nome, e o
 *  NNN É A PRIORIDADE: 001 vem antes de 002 porque alguém decidiu isso ao criar,
 *  não porque o `ls` devolveu nessa ordem.
 *
 *  A TASK NÃO CONHECE QUEM ESTÁ FORA — não tem `sprint:`, não tem `run:`, não tem
 *  `issue:`. Ela é uma unidade fechada: título, porquê, prova, worktree. Quem
 *  agrupa em pacote é o ciclo que as pega, e é de lá que o teto de 10 minutos
 *  fala. Front matter com ponteiro pra fora é o campo que envelhece primeiro:
 *  o pacote muda de composição toda semana, e a task não deveria ser reescrita
 *  por causa disso. */
export function readTasksDir(dir: string): Task[] {
  const tasks: Task[] = []
  // A task ENTREGUE é arquivada em `<sprint>/done/`, e ela continua sendo task: some
  // do topo da pasta, nunca da lista. Ler só o nível de cima fazia a sprint com as
  // seis tasks feitas aparecer como `? min · 0 tasks` (medido em 18/08) — o `list`
  // dizia que nada foi feito no dia em que tudo foi.
  //
  // Ordena pelo NNN e não pelo caminho, senão `done/001` cai depois de `007`: o
  // número É a ordem de execução, e arquivar não reordena nada.
  //
  // `backlog/` é o terceiro: task ESCRITA e não comprometida. Sem ela, escrever a
  // task já gastava o teto de 10 min da sprint, então a alternativa era não
  // escrever — e ideia que não vira arquivo morre na sessão (#write_as_it_happens).
  //
  // Ordena pelo NNN e não pelo caminho, senão `done/001` cai depois de `007`: o
  // número É a ordem de execução, e arquivar não reordena nada.
  const daPasta = (base: string, estadoDaPasta?: Task['state']) =>
    dirs(base).filter((d) => /^\d+_/.test(d)).map((d) => ({ pasta: join(base, d), estadoDaPasta }))
  const achadas = [
    ...daPasta(dir),
    ...daPasta(join(dir, 'backlog'), 'backlog'),
    // `in_progress/` é o terceiro estado-pasta: a task PUXADA por um agente. A
    // pasta ganha do `state:` do `output.md` pela mesma razão que `done/` ganha —
    // um worker que morreu deixa a pasta parada onde o `ls` mostra, e um campo
    // que ninguém reescreveu mente em silêncio.
    ...daPasta(join(dir, 'in_progress'), 'doing'),
    ...daPasta(join(dir, 'done'), 'done'),
  ].sort((a, b) => a.pasta.split('/').pop()!.localeCompare(b.pasta.split('/').pop()!))
  for (const { pasta, estadoDaPasta } of achadas) {
    const nome = pasta.split('/').pop()!
    const ctx = join(pasta, 'CONTEXT.md')
    if (!existsSync(ctx)) continue
    const { fm, body } = frontMatter(readFileSync(ctx, 'utf8'))
    // O título é o `# ` do corpo, e não um campo: título em duas fontes é a
    // primeira coisa que diverge — e o `#` é o que o humano lê ao abrir.
    const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim()
    const out = join(pasta, 'output.md')
    tasks.push({
      id: nome.match(/^(\d+)_/)![1]!,
      title: h1 ?? fm.title ?? nome,
      proof: fm.proof,
      duration: parseMin(fm.duration),
      references: fm.references,
      dir: pasta.replace(/^.*?(?=01_projects\/|02_areas\/)/, ''),
      refs: readdirSync(pasta).filter((f) => f !== 'CONTEXT.md' && f !== 'output.md'),
      // A PASTA ganha do campo, e é a mesma razão que fez a sprint guardar estado
      // em pasta: `state:` num arquivo é a segunda fonte que ninguém atualiza, e o
      // `ls` mostra o campo velho enquanto a pessoa acredita nele. O campo do
      // `output.md` continua valendo para a task do topo, que não tem pasta a
      // consultar.
      state: estadoDaPasta ?? (existsSync(out) ? frontMatter(readFileSync(out, 'utf8')).fm.state : undefined),
    })
  }
  return tasks
}

/** A URL da issue. Só existe quando o run declara o repo COMO SLUG — e é o mesmo
 *  campo que o ciclo de código precisa como CAMINHO. Ver `buracos()`. */
export function issueUrl(run: Run, issue?: number): string | undefined {
  if (!issue || !run.repo || !/^[\w.-]+\/[\w.-]+$/.test(run.repo)) return undefined
  return `https://github.com/${run.repo}/issues/${issue}`
}

/** O que falta pro `01_coding` aceitar este run. Buraco DECLARADO vale mais que
 *  default silencioso: foi o default `work_repo: me` que fez um ciclo apontar
 *  pro repo do registro em vez do repo do trabalho. */
export function buracos(run: Run): string[] {
  const b: string[] = []
  for (const f of run.broken) b.push(`\`${f}\` não é YAML válido — o run inteiro fica ilegível por causa dele`)
  if (run.tasksDir && !existsSync(join(ROOT, run.tasksDir)))
    b.push(`\`tasks_dir: ${run.tasksDir}\` não existe no disco — o plano aponta pro vazio`)
  if (!run.sprints.length) b.push('nenhuma task lida — nem `tasks_dir:` com pastas, nem yaml em um dos dois dialetos')
  if (!run.repo) b.push('sem `repo:` — o ciclo não adivinha repo alvo')
  if (!run.workRepo) b.push('sem `work_repo:` — falta o CAMINHO do repo onde o código é escrito')
  else if (!existsSync(run.workRepo.replace(/^~/, process.env.HOME ?? '~')))
    b.push(`\`work_repo: ${run.workRepo}\` não existe no disco`)
  if (!run.base) b.push('sem `base:` — o branch de integração não está declarado')
  for (const s of run.sprints) {
    for (const t of s.tasks) {
      if (!t.proof) b.push(`${s.id}/${t.id} sem \`proof:\` — #proof_per_task para o ciclo`)
      if (t.duration === undefined) b.push(`${s.id}/${t.id} sem \`duration:\` — sem ela a sprint não tem soma, e o teto de ${CEILING_MIN} min não é verificável`)
    }
    // O teto é da SPRINT, e sprint é do ciclo: no dialeto `pasta` a lista é o
    // projeto inteiro, e somar tudo acusaria teto em todo projeto com 4 tasks.
    const m = run.dialeto === 'pasta' ? 0 : minutes(s)
    if (m > CEILING_MIN) b.push(`${s.id} soma ${m} min, acima do teto de ${CEILING_MIN} — a alavanca é PARTIR (#sprint_order_and_size)`)
  }
  return b
}

/** Os quatro formatos, e o que cada um serve. Um comando que só imprime pra
 *  humano obriga o próximo a reparsear texto alinhado — e alinhamento muda.
 *
 *  O GRÃO muda com o formato, e é de propósito: `--tsv` e `--jsonl` de um run
 *  saem por TASK, porque a task é a linha que alguém vai filtrar (`awk`, `grep`,
 *  um `while read`). O `--json` sai inteiro, porque aí quem lê é `jq` ou um
 *  script, e a hierarquia é o valor. */
export type Fmt = 'human' | 'json' | 'jsonl' | 'tsv'

/** O run que `alvo` nomeia — e é AQUI que ele é achado, pros dois comandos.
 *
 *  Prefixo basta: `my runs 999_via` acha o run inteiro. Nome de run é longo de
 *  propósito, e digitar 34 caracteres pra ler um plano é onde se desiste de ler.
 *
 *  O `my sprints run` repetia este bloco byte a byte, com a mesma frase de erro.
 *  Uma regra, um lugar — e quem consome recebe o run ou a frase pronta. */
export function acharRun(alvo: string, runs = index()): Run | { erro: string } {
  const achado = resolvePorPrefixo(runs, alvo, (r) => r.run)
  if (!achado) return { erro: `nenhum run casa "${alvo}". Rode \`my runs\` pra ver os ${runs.length}.` }
  return 'erro' in achado ? achado : achado.hit
}

export function fmtOf(argv: string[]): Fmt {
  if (argv.includes('--json')) return 'json'
  if (argv.includes('--jsonl')) return 'jsonl'
  if (argv.includes('--tsv')) return 'tsv'
  return 'human'
}

/** TSV sem cabeçalho: cabeçalho é linha que todo consumidor tem que pular, e
 *  quem pula errado soma o texto como dado. As colunas ficam na docstring. */
const tsv = (...cols: (string | number | undefined)[]) =>
  cols.map((c) => String(c ?? '').replace(/\t|\n/g, ' ')).join('\t')

function show(run: Run, fmt: Fmt): void {
  if (fmt === 'json') {
    console.log(JSON.stringify({ ...run, buracos: buracos(run) }, null, 2))
    return
  }
  // run · sprint · issue url · task · proof
  if (fmt === 'tsv' || fmt === 'jsonl') {
    for (const s of run.sprints)
      for (const t of s.tasks) {
        const linha = { run: run.run, main: run.main, repo: run.repo, base: run.base, sprint: s.id, sprint_title: s.title, issue: s.issue, issue_url: issueUrl(run, s.issue), task: t.id, title: t.title, proof: t.proof }
        console.log(fmt === 'jsonl' ? JSON.stringify(linha) : tsv(run.run, s.id, issueUrl(run, s.issue), t.id, t.title, t.proof))
      }
    return
  }
  const tasks = run.sprints.reduce((n, s) => n + s.tasks.length, 0)
  console.log(`${run.run} · ${run.main} · ${run.sprints.length} sprints · ${tasks} tasks · dialeto ${run.dialeto ?? '—'}`)
  console.log(`  ${run.path}`)
  for (const [k, v] of [
    ['repo', run.repo],
    ['base', run.base],
    ['label', run.label],
    ['serve', run.serve],
  ] as const)
    if (v) console.log(`  ${k}: ${v}`)

  for (const s of run.sprints) {
    const url = issueUrl(run, s.issue)
    console.log(`\n  ${s.id} · ${s.title}${url ? `\n     ${url}` : s.issue ? `\n     issue ${s.issue}` : ''}`)
    for (const t of s.tasks) {
      console.log(`     ${t.id} ${t.title}`)
      console.log(`        proof: ${t.proof ?? 'FALTA'}`)
    }
  }

  const b = buracos(run)
  if (b.length) {
    console.log(`\n  o que falta pro 01_coding aceitar (${b.length}):`)
    for (const l of b) console.log(`   - ${l}`)
  } else {
    console.log('\n  pronto pro 01_coding: repo, base e proof por task')
  }
}

export function main(argv: string[]): number {
  const fmt = fmtOf(argv)
  const [alvo] = argv.filter((a) => !a.startsWith('--'))
  const runs = index()

  if (!alvo) {
    if (fmt === 'json') return console.log(JSON.stringify(runs, null, 2)), 0
    for (const r of runs) {
      const tasks = r.sprints.reduce((n, s) => n + s.tasks.length, 0)
      const issues = r.sprints.filter((s) => s.issue).length
      // run · main · sprints · tasks · issues · dialeto
      if (fmt === 'tsv') console.log(tsv(r.run, r.main, r.sprints.length, tasks, issues, r.dialeto))
      else if (fmt === 'jsonl') console.log(JSON.stringify({ run: r.run, main: r.main, sprints: r.sprints.length, tasks, issues, dialeto: r.dialeto, path: r.path }))
      else {
        const plano = r.sprints.length ? `${r.sprints.length}sp/${tasks}t${issues ? ` · ${issues} issues` : ''}` : r.files.join(' ')
        console.log(`${r.run.padEnd(34)} ${r.main.padEnd(18)} ${plano}`)
      }
    }
    return 0
  }

  const achado = acharRun(alvo, runs)
  if ('erro' in achado) {
    console.error(achado.erro)
    return 1
  }
  show(achado, fmt)
  return 0
}

if (import.meta.main) process.exit(main(process.argv.slice(2)))
