#!/usr/bin/env bun
//! Fecha uma task: roda a prova, commita a worktree e carimba o fim.
//!
//!     my tasks done 3                  prova, commit, commit_end, state: done
//!     my tasks done 3 --blocked "…"    não commita: registra por que travou
//!
//! A ORDEM É A REGRA: a prova roda ANTES do commit. Falhou, não commita e sai 1 —
//! prova depois do commit DESCOBRE o erro, prova antes PREVINE, e só a segunda
//! tem dono (#proof_per_task).
//!
//! `git add -A` DENTRO da worktree, e só ali: a worktree é da task, então tudo que
//! está sujo nela é da task. No checkout principal a mesma linha varreu 43
//! arquivos de outra sessão (medido em 16/08) — é por isso que `start` corta a
//! worktree em vez de confiar no `pathspec` que alguém vai lembrar de passar.
//!
//! E COM `--here` NÃO EXISTE WORKTREE, então a premissa cai junto: o `onde` vira o
//! checkout compartilhado, e o add largo ali É o incidente de 16/08. Nesse modo
//! este verbo commita **só a pasta da task** — a prova roda, o state é carimbado,
//! a mensagem fixada continua sendo a fonte, e o commit do CÓDIGO fica com quem
//! sabe quais mudanças são dele. Medido 19/08 por um agente que recusou o verbo:
//! cinco workers no mesmo checkout, 76 arquivos no diff, deleções alheias
//! inclusas.
//!
//! A MENSAGEM NÃO É REDIGIDA AQUI: ela foi fixada pelo `start` em
//! `output.md#commit_message`. Este verbo só a usa — um estilo de commit por repo,
//! não um por agente.
//!
//! NÃO FAZ MERGE. Integrar é decisão de gente, e a worktree fica pro humano olhar
//! o diff — @02_areas/00_workflows/00_main/01_coding/CONTEXT.md.
//!
//! depends_on: src/tasks/model.ts · src/tasks/start.ts
//! impacts:    02_areas/00_workflows/00_main/01_coding/CONTEXT.md

import { Command } from 'commander'
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  RAIZ,
  type State,
  type Task,
  acharTask,
  agora,
  arquivar,
  escreverFm,
  lembra,
  projetoCorrente,
  projetoDe,
  projetos,
  rel,
  sprintDe,
  stateDe,
} from './model.ts'
import { git } from './start.ts'

/** O que o `done` produziu. `arquivada` só existe quando a task morava numa
 *  sprint — a forma velha (`tasks/NNN_*`) não tem `done/` pra onde ir. */
export type Finished = {
  task: Task
  state: State
  /** Só nos desfechos que NÃO commitam: o porquê que o `--blocked`/`--dropped` gravou. */
  why?: string
  arquivada?: string
  arquivos?: number
  head?: string
  onde?: string
}

export function command(): Command {
  const cmd = new Command('done')
    .description('Roda a prova, commita a worktree da task e carimba o fim.')
    .argument('<nnn>', 'o número da task — `3`, `03` ou `003`')
    .option('-P, --project <slug>', 'o projeto. Passado uma vez, fica lembrado — senão vem do cwd')
    .option('-b, --blocked <porque>', 'não commita: registra o que travou e por quê')
    .option('--dropped <porque>', 'a task não vai acontecer — registra o porquê e fecha')
  cmd.addHelpText('after', '\n  A prova roda ANTES do commit. Falhou, nada é commitado.\n  Merge é decisão de gente: a worktree fica, o branch fica.\n')
  return cmd
}

export function main(argv: string[]): number {
  const cmd = command().exitOverride()
  try {
    cmd.parse(argv, { from: 'user' })
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1
  }
  const [alvo] = cmd.args
  const opts = cmd.opts()

  const { slug, porque } = projetoCorrente(opts.project)
  if (!slug) return console.error(`de que projeto? \`-P <slug>\`\n  existem: ${projetos().join(', ')}`), 1
  if (porque !== 'último usado') lembra(slug)

  const t = acharTask(slug, alvo!)
  if ('erro' in t) return console.error(t.erro), 1

  const fechada = done(t, { blocked: opts.blocked, dropped: opts.dropped })
  if ('erro' in fechada) return console.error(fechada.erro), 1

  if (fechada.state !== 'done') {
    console.log(`${t.nnn} ${fechada.state} — ${fechada.why}`)
    return 0
  }

  console.log(`\n${t.nnn} done · ${fechada.arquivos} arquivo(s) · ${fechada.head!.slice(0, 8)}`)
  if (fechada.arquivada) console.log(`  arquivada em ${fechada.arquivada}`)
  console.log(
    `  ${rel(fechada.arquivada ? join(RAIZ, fechada.arquivada, 'output.md') : join(t.dir, 'output.md'))} — preencha o resumo: um parágrafo, e 3 a 5 seções de um parágrafo`,
  )
  console.log(`  diff da task: git -C ${fechada.onde} log ${String(t.saida.commit_start ?? '').slice(0, 8)}..${fechada.head!.slice(0, 8)} --stat`)
  console.log('  merge é decisão de gente: o branch e a worktree ficam.')
  return 0
}

/** FECHA a task: roda a prova, commita e carimba o fim — ou registra o desfecho
 *  que não é entrega (`blocked`, `dropped`), e esses não commitam nada.
 *
 *  Esta é a função; o `main` acima é só a casca que traduz argv e imprime. */
export function done(t: Task, opts: { blocked?: string; dropped?: string } = {}): Finished | { erro: string } {
  const slug = projetoDe(t.dir)
  const saida = join(t.dir, 'output.md')

  // Os dois desfechos que NÃO são entrega. Ficam antes da prova porque prova de
  // task travada não mede nada, e um `blocked` sem registro é a task que ninguém
  // sabe por que parou.
  if (opts.blocked || opts.dropped) {
    const state: State = opts.blocked ? 'blocked' : 'dropped'
    escreverFm(saida, { state, ended_at: agora(), why: opts.blocked ?? opts.dropped })
    // Solta a trava do `start` aqui também: `blocked` e `dropped` são FIM de posse.
    // Quem destravar a task depois (voltando o state pra draft) não deveria também
    // ter que descobrir que existe um `.doing` escondido segurando ela.
    try {
      rmSync(join(t.dir, '.doing'), { recursive: true })
    } catch {}
    return { task: t, state, why: opts.blocked ?? opts.dropped }
  }

  if (stateDe(t) !== 'doing') return { erro: `${t.slug} está em \`${stateDe(t)}\` — rode \`my tasks start ${t.nnn}\` primeiro` }
  const onde = String(t.saida.worktree || '') || process.cwd()
  if (!existsSync(onde)) return { erro: `a worktree do start não existe mais: ${onde}` }

  const proof = String(t.pedido.proof ?? '').trim()
  if (!proof) return { erro: `${t.slug} sem \`proof:\` — #proof_per_task` }

  // A prova roda NA worktree, com o shell do usuário: ela é escrita como comando
  // de shell (`rg … && test …`), não como argv.
  console.log(`prova: ${proof.split('\n').join(' ')}`)
  const p = Bun.spawnSync(['bash', '-lc', proof], { cwd: onde, stdout: 'inherit', stderr: 'inherit' })
  if (p.exitCode !== 0)
    return { erro: `\nprova falhou (exit ${p.exitCode}) — nada foi commitado. Conserte, ou feche com --blocked "<o que travou>".` }

  // A ÁRVORE INTEIRA só quando ela é DA TASK.
  //
  // O `//!` deste arquivo justifica o add largo pela worktree: tudo que está sujo
  // nela é da task, porque o `start` cortou uma só pra ela. Com `--here` essa
  // premissa NÃO VALE — não existe worktree, o `onde` cai pro `process.cwd()`, e
  // o cwd é o checkout compartilhado com as outras sessões. O add largo ali é
  // exatamente o incidente de 16/08 que o cabeçalho cita: 43 arquivos de outra
  // sessão varridos pra dentro.
  //
  // Medido 19/08, e por um agente que RECUSOU o verbo: com cinco workers no mesmo
  // checkout, o `git diff` mostrava 76 arquivos, incluindo deleções alheias. Ele
  // commitou por pathspec à mão e escreveu o porquê — este conserto é o que faz o
  // verbo merecer a próxima chamada.
  //
  // O que sobra pro `--here`: a prova roda, o state é carimbado, a mensagem
  // fixada continua sendo a fonte. O que NÃO dá é adivinhar quais mudanças do
  // checkout são da task — então o commit do CÓDIGO fica com quem sabe, e este
  // verbo commita só a pasta da task.
  const semWorktree = !String(t.saida.worktree || '')

  // A TRAVA SAI ANTES DO `add`, e a ordem é o bug. Ela saía depois do commit, e
  // aí `.doing/claim.json` — o crachá de quem pegou a task — ia junto pro git:
  // medido 20/08 na 001 do study-bloom, um lock versionado dentro de uma task
  // fechada. Trava é estado VIVO; o que se versiona é o resultado.
  try {
    rmSync(join(t.dir, '.doing'), { recursive: true })
  } catch {}

  const oQueEntra = semWorktree ? [t.dir] : ["-A"]
  const add = git(onde, "add", ...oQueEntra)
  if (!add.ok) return { erro: `git add: ${add.out}` }
  const sujo = git(onde, 'diff', '--cached', '--name-only')
  if (!sujo.out) return { erro: `nada pra commitar em ${onde} — a prova passou sem mudança nenhuma. A task já estava feita?` }
  if (semWorktree)
    console.log(`--here: commitando SÓ ${rel(t.dir)} — o código é seu, commite por pathspec com a mensagem fixada em output.md#commit_message`)

  // A mensagem vem do `start` — este verbo NÃO redige. `-F -` porque ela é
  // multi-linha, e passar corpo por `-m` repetido perde a linha em branco.
  const mensagem = String(t.saida.commit_message ?? `feat(${slug}/${t.nnn}): ${t.titulo}`)
  const c = Bun.spawnSync(['git', '-C', onde, 'commit', '-q', '-F', '-'], { stdin: new TextEncoder().encode(mensagem + '\n') })
  if (c.exitCode !== 0) return { erro: `git commit: ${new TextDecoder().decode(c.stderr).trim()}` }
  const head = git(onde, 'rev-parse', 'HEAD')

  escreverFm(saida, { state: 'done', ended_at: agora(), commit_end: head.out })

  // ARQUIVA a pasta em `<sprint>/done/`, e só quando ela mora numa sprint: a forma
  // velha (`tasks/NNN_*`) não tem sprint pra guardar dentro. Sprint com dez tasks
  // feitas afoga a que está aberta na sidebar, e ordenar por estado é justamente o
  // que a pasta faz de graça.
  //
  // `git mv` PRIMEIRO, com `rename` de reserva — e a ordem importa nos dois sentidos.
  // Pasta já versionada movida por fora do git deixa a antiga como deleção
  // não-encenada, pro próximo commit de outra sessão varrer. Mas pasta de task
  // RECÉM-CRIADA é untracked, e aí o `git mv` recusa com "source directory is empty"
  // (medido em 18/08 nas seis tasks da 991) — que é o caso NORMAL, não o excepcional:
  // quem fecha a task no mesmo dia que a criou nunca commitou a pasta ainda.
  let arquivada = ''
  if (sprintDe(t)) {
    const destino = arquivar(t.dir)
    mkdirSync(dirname(destino), { recursive: true })
    const mv = git(RAIZ, 'mv', t.dir, destino)
    if (!mv.ok) {
      try {
        renameSync(t.dir, destino)
      } catch (e) {
        // A task ESTÁ done — o commit do código já saiu. Arquivar é arrumação, e
        // recusar o fechamento por causa dela troca o essencial pelo cosmético.
        console.log(`  (não arquivou: ${(e as Error).message})`)
      }
    }
    if (existsSync(destino)) arquivada = rel(destino)
  }

  return { task: t, state: 'done', arquivada: arquivada || undefined, arquivos: sujo.out.split('\n').length, head: head.out, onde }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)))
