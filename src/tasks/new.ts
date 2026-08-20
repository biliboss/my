#!/usr/bin/env bun
//! Cria a próxima task de uma SPRINT — uma PASTA, com o pedido e o output em draft.
//!
//!     my tasks new "registry answers on myregistry.localhost" -d 2 -p "curl -sf …"
//!     my tasks new "…" -S 998                na sprint 998, e não na corrente
//!     my tasks new "…" --folder install_zot
//!
//! `01_projects/<proj>/sprints/NNN_<sprint>/NNN_<folder>/` com `CONTEXT.md` (o
//! pedido) e `output.md` (o resultado, nascido em `draft`).
//!
//! A TASK MORA DENTRO DA SPRINT desde 18/08, e a contenção é o ponteiro: sem
//! `-S`, a sprint CORRENTE — a mais nova (número menor) que ainda tem trabalho
//! aberto. Sem nenhuma sprint aberta ele RECUSA e manda criar uma, porque o teto
//! de 10 min é da sprint, e task sem sprint é task que ninguém soma.
//!
//! O `tasks.md` chapado MORREU: uma
//! linha de checkbox não tem onde carregar a prova, a referência ancorada, o
//! symlink pro arquivo que decidiu, nem os dois shas que delimitam o diff.
//!
//! O NNN É A PRIORIDADE, e ele não é reusado nem renumerado: é o ENDEREÇO da
//! task, e endereço que muda quebra toda citação. Por isso `--priority` num
//! número ocupado RECUSA em vez de empurrar os vizinhos.
//!
//! E RECUSA NOME RUIM — #task_naming. O nome da pasta sai do título por slugify
//! com stopword fora, e o que passa de 4 palavras ou 32 caracteres para aqui: foi
//! medido em 18/08 que 4 de 5 nomes gerados por slugify ingênuo truncaram na
//! sidebar, e nome que só se entende com o mouse em cima é id, não nome.
//!
//! depends_on: src/tasks/model.ts · src/tasks/list.ts · src/sprints/new.ts · src/sprints/model.ts · src/shared/template.ts
//! impacts:    src/tasks/list.ts · 03_resources/rules/planning/task_naming.md · src/sprints/new.ts

import { Command } from 'commander'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { acharSprint, corrente, criticaDoTeto } from '../sprints/model.ts'
import { ARQUIVO, BACKLOG, PROJETOS, TASKS, TPL, type Task, ler, lembra, projetoCorrente, projetos, rel, worktreeDe } from './model.ts'
import { doTemplate } from '../shared/template.ts'

/** Palavra que não paga o espaço que ocupa: artigo, preposição, cópula. Sai do
 *  nome da pasta, e nunca do TÍTULO — no título ela é o que faz virar frase. */
const STOP = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas',
  'em', 'e', 'que', 'pra', 'para', 'com', 'por', 'ao', 'aos', 'the', 'a', 'an', 'of', 'in',
  'on', 'at', 'to', 'for', 'and', 'is', 'are', 'be', 'it', 'this', 'that',
])
const MAX_PALAVRAS = 7
const MAX_CHARS = 32
const MAX_PALAVRAS_TITULO = 7

// O strip do que é do MOLDE e o `type` do que NASCE: @src/shared/template.ts

const palavras = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

/** O nome da pasta a partir do título: stopword fora, 4 palavras, 32 caracteres.
 *  Underscore e não hífen porque o `NNN_` já usa `_` — duas convenções no mesmo
 *  nome é o que faz alguém escrever a terceira.
 *
 *  O teto de palavras é PARÂMETRO porque a sprint carrega 5 e a task 4: o nome
 *  da sprint precisa nomear um pacote de capacidades, não uma. */
export function nomeDePasta(titulo: string, maxPalavras = MAX_PALAVRAS): string {
  const uteis = palavras(titulo).filter((p) => !STOP.has(p))
  let nome = ''
  for (const p of uteis.slice(0, maxPalavras)) {
    const candidato = nome ? `${nome}_${p}` : p
    if (candidato.length > MAX_CHARS) break
    nome = candidato
  }
  return nome
}

/** O que o nome tem de errado, ou nada. Devolve string vazia quando serve —
 *  #task_naming. */
export function criticaDoNome(nome: string, maxPalavras = MAX_PALAVRAS): string {
  const ps = nome.split('_').filter(Boolean)
  if (!ps.length) return 'nome vazio'
  if (!/^[a-z0-9_]+$/.test(nome)) return 'só minúscula, dígito e `_`'
  if (ps.length > maxPalavras) return `${ps.length} palavras, teto é ${maxPalavras} — a sidebar trunca em ${MAX_CHARS} caracteres`
  if (nome.length > MAX_CHARS) return `${nome.length} caracteres, teto é ${MAX_CHARS} — a sidebar trunca`
  if (STOP.has(ps[0]!)) return `abre com "${ps[0]}", que não paga o espaço — comece pelo VERBO no imperativo`
  return ''
}

/** O próximo NNN: o maior que existe, mais um. Buraco na sequência NÃO é
 *  preenchido — 003 ausente significa que a 003 foi apagada, e reusar o número
 *  faria duas tasks diferentes atenderem pela mesma citação. */
export function proximoNNN(tasksDir: string): number {
  // `done/` e `backlog/` contam. Task arquivada continua sendo a dona do número dela, e ignorar
  // a pasta faria a próxima task nascer com o endereço de uma já entregue — duas
  // tasks diferentes atendendo pela mesma citação, que é o que o NNN existe pra
  // impedir. Arquivar muda onde a pasta mora, não se o número está ocupado.
  const nums = [tasksDir, join(tasksDir, BACKLOG), join(tasksDir, ARQUIVO)]
    .filter(existsSync)
    .flatMap((d) => readdirSync(d))
    .map((d) => d.match(/^(\d+)_/)?.[1])
    .filter((n): n is string => !!n)
    .map(Number)
  return (nums.length ? Math.max(...nums) : 0) + 1
}

/** A task recém-nascida, com a sprint que a recebeu — o `n` sai separado porque
 *  é o número PEDIDO, e é ele que o `--priority` disputa. */
export type Criada = { task: Task; sprint: string; n: number }

/** CRIA a próxima task de uma sprint — a pasta, o pedido e o output em `draft`.
 *
 *  Chama-se `criar` e não `new` porque `new` é palavra reservada: o verbo da CLI
 *  continua sendo `my tasks new`, e é a casca que traduz o nome.
 *
 *  Esta é a função; `main` abaixo é só a casca que traduz argv e imprime. */
export function criar(
  projeto: string,
  titulo: string,
  opts: { sprint?: string; folder?: string; duration?: string; proof?: string; priority?: string; backlog?: boolean } = {},
): Criada | { erro: string } {
  const nTitulo = palavras(titulo).length
  if (nTitulo > MAX_PALAVRAS_TITULO)
    return { erro: `título com ${nTitulo} palavras, teto é ${MAX_PALAVRAS_TITULO} — #task_naming ("my resources task_naming")\n  "${titulo}"` }

  const nome = opts.folder ?? nomeDePasta(titulo)
  const critica = criticaDoNome(nome)
  if (critica)
    return {
      erro: [
        `nome de pasta recusado: "${nome}" — ${critica}`,
        `  o que eu geraria do título: ${nomeDePasta(titulo) || '(nada — o título é só stopword)'}`,
        '  a forma inteira, com vinte exemplos: `my resources task_naming`',
      ].join('\n'),
    }

  // A task nasce DENTRO de uma sprint. Sem `-S`, a CORRENTE — a mais nova
  // (número menor) que ainda tem trabalho aberto. Sem nenhuma aberta, RECUSA e
  // ensina: enfiar task numa sprint que já entregou é como se estoura o teto de
  // uma sprint fechada, e criar solta em `tasks/` era a forma velha.
  const sprint = opts.sprint ? acharSprint(projeto, opts.sprint) : corrente(projeto)
  if (!sprint)
    return {
      erro: `${projeto} não tem sprint ABERTA — crie uma: my sprints new "<título>" -P ${projeto}\n  (a task mora em sprints/NNN_<slug>/NNN_<nome>/ desde 18/08)`,
    }
  if ('erro' in sprint) return sprint

  // `backlog/` é uma task ESCRITA e não prometida. Sem ela, escrever já gastava o
  // teto de 10 min da sprint, e a alternativa era não escrever — #sprint_order_and_size.
  // `tasks/` SEMPRE, e o estado dentro dele: a sprint tem CONTEXT.md, docs e o que
  // mais o pacote precisar, e sem o segmento a varredura tinha que adivinhar pelo
  // `NNN_` qual pasta era task.
  const raizDasTasks = join(sprint.dir, TASKS)
  const tasksDir = opts.backlog ? join(raizDasTasks, BACKLOG) : raizDasTasks
  const n = opts.priority ? Number(opts.priority) : proximoNNN(raizDasTasks)
  if (!Number.isInteger(n) || n < 1) return { erro: `--priority é inteiro >= 1, veio: ${opts.priority}` }
  const nnn = String(n).padStart(3, '0')
  // Olha no `done/` também: número de task arquivada segue OCUPADO, senão
  // `--priority 3` nasce em cima do endereço de uma task já entregue.
  // O NNN é endereço da SPRINT, não da pasta de estado: os três lugares disputam a
  // mesma numeração, senão promover do backlog colidiria com uma task já entregue.
  const ocupado = [raizDasTasks, join(raizDasTasks, BACKLOG), join(raizDasTasks, ARQUIVO)]
    .filter(existsSync)
    .flatMap((d) => readdirSync(d).map((x) => (d === raizDasTasks ? x : `${d.split('/').pop()}/${x}`)))
    .find((d) => d.split('/').pop()!.startsWith(`${nnn}_`))
  // Recusa em vez de empurrar: renumerar vizinho pra abrir espaço quebra toda
  // citação a ele.
  if (ocupado) return { erro: `${nnn} já é ${ocupado} — o NNN é endereço, não posição. Escolha outro, ou omita e leve o próximo.` }

  const pastaTask = `${nnn}_${nome}`
  const pasta = join(tasksDir, pastaTask)
  mkdirSync(tasksDir, { recursive: true })
  try {
    mkdirSync(pasta) // sem `recursive`: EEXIST é a trava atômica contra duas sessões
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return { erro: `já existe: ${rel(pasta)}` }
    throw e
  }

  // A worktree e o branch nascem no PEDIDO, não no start: quem lê a task sabe
  // onde o trabalho vai acontecer antes de rodar comando nenhum — e uma task que
  // não vale uma worktree própria era um pedaço de outra task.
  // O rótulo da worktree carrega a SPRINT porque o NNN da task reinicia em cada
  // uma: sem ela, `999/001` e `998/001` disputam a mesma worktree e o mesmo
  // branch — #task_identifier.
  const rotulo = `${sprint.nnn}_${pastaTask}`
  const ctx = doTemplate(readFileSync(join(TPL, 'CONTEXT.md'), 'utf8'), 'task')
    .replace('worktree: <caminho>', `worktree: ${worktreeDe(projeto, rotulo).replace(process.env.HOME ?? '~', '~')}`)
    .replace('branch: <task/…>', `branch: task/${rotulo}`)
    .replace('duration: <n> min', `duration: ${opts.duration ? `${opts.duration} min` : '<n> min'}`)
    .replace('  <rg | test | wc -l>', `  ${opts.proof ?? '<rg | test | wc -l>'}`)
    // O `#` por REGEX e não por texto literal: o placeholder do template já mudou
    // de redação uma vez e o `replace` literal falhou CALADO — a task nascia com
    // `# <o RESULTADO, no presente…>` como título e ninguém via até o `list`.
    .replace(/^#\s+<.*>$/m, `# ${titulo}`)
  const output = doTemplate(readFileSync(join(TPL, 'output.md'), 'utf8'), 'task').replace('# Output — <o título da task>', `# Output — ${titulo}`)

  writeFileSync(join(pasta, 'CONTEXT.md'), ctx)
  writeFileSync(join(pasta, 'output.md'), output)

  return { task: ler(pasta), sprint: sprint.pasta, n }
}

export function command(): Command {
  const cmd = new Command('new')
    .description('Cria a próxima task DA SPRINT — uma pasta, com CONTEXT.md e output.md.')
    .argument('<titulo>', 'o RESULTADO, no presente, até 7 palavras — #task_naming')
    .option('-P, --project <slug>', 'o projeto. Passado uma vez, fica lembrado — senão vem do cwd')
    .option('-S, --sprint <nnn>', 'a sprint que recebe a task — `999` ou `999_<slug>`. Omitida, a CORRENTE')
    .option('-f, --folder <nome>', 'o nome da pasta, no imperativo, até 4 palavras. Omitido, sai do título')
    .option('-d, --duration <min>', 'minutos; a SOMA da sprint não passa de 10')
    .option('-p, --proof <cmd>', 'o comando que prova ESTA task')
    .option('-n, --priority <nnn>', 'o número da pasta. Ocupado, RECUSA — o NNN é endereço')
    .option('-b, --backlog', 'nasce em `backlog/`: escrita, não comprometida — não gasta o teto')
  cmd.addHelpText(
    'after',
    '\n  PASTA no imperativo, 4 palavras: `install_zot` · `map_hosts_entry`\n  TÍTULO no presente, 7 palavras: "registry answers on myregistry.localhost"\n  Os vinte exemplos e o porquê: `my resources task_naming`\n',
  )
  return cmd
}

export function main(argv: string[]): number {
  const cmd = command().exitOverride()
  try {
    cmd.parse(argv, { from: 'user' })
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1
  }
  const [titulo] = cmd.args
  const opts = cmd.opts()

  const { slug, porque } = projetoCorrente(opts.project)
  if (!slug)
    return console.error(
      `de que projeto é esta task? passe \`-P <slug>\` (fica lembrado), ou rode de dentro de 01_projects/<slug>/\n  existem: ${projetos().join(', ')}`,
    ), 1
  const dir = join(PROJETOS, slug)
  if (!existsSync(dir))
    return console.error(`projeto não existe: 01_projects/${slug}/ (veio de ${porque})\n  existem: ${projetos().join(', ')}`), 1
  if (porque !== 'último usado') lembra(slug)

  const criada = criar(slug, titulo!, opts)
  if ('erro' in criada) return console.error(criada.erro), 1
  const { task, sprint, n } = criada
  const pasta = task.dir

  console.log(rel(join(pasta, 'CONTEXT.md')))
  console.log(`${rel(join(pasta, 'output.md'))}   state: draft`)
  console.log(`projeto ${slug} (${porque}) · sprint ${sprint} · prioridade ${n}`)
  if (!opts.proof || !opts.duration) console.log('falta `proof:` e/ou `duration:` — sem os dois o 01_coding recusa a task')
  // O teto é relido do DISCO, não somado na memória: a task acabou de ser
  // escrita, e a única soma que vale é a que o próximo comando também vê.
  const depois = acharSprint(slug, sprint)
  const teto = 'erro' in depois ? '' : criticaDoTeto(depois)
  if (teto) console.log(`sprint ${sprint}: ${teto}`)
  console.log(`começa com: my tasks start ${sprint}/${task.nnn}`)
  return 0
}

if (import.meta.main) process.exit(main(process.argv.slice(2)))
