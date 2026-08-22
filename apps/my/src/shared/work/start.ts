#!/usr/bin/env bun
//! Começa uma task: corta a worktree, carimba o início, e FIXA a mensagem do commit.
//!
//!     `my kanban move` 3                 a task 003 do projeto corrente
//!     `my kanban move` 3 --here          sem worktree: commita no checkout atual
//!
//! O que ele escreve no `output.md` — e por que cada campo:
//!
//!   state: doing        o único campo de progresso que o git não responde
//!   owner               quem assumiu; task sem dono é desejo, não task
//!   started_at          o começo do LEAD TIME, e ele não se mexe mais
//!   claude_session      QUEM executou, quando o executor é um agente
//!   commit_start        o HEAD de ANTES — é ele que delimita o diff da task
//!   worktree · branch   onde o trabalho acontece isolado
//!   commit_message      a mensagem PRONTA, escrita agora e usada pelo `done`
//!
//! A MENSAGEM DO COMMIT NASCE AQUI, e é o ponto todo: fixada no início, ela sai
//! do título (7 palavras, presente — #task_naming), carrega o corpo com a prova e
//! o dono, e o `done` só a usa. Deixar o agente redigir no fim é como se ganha
//! trinta estilos de commit no mesmo repo.
//!
//! UMA WORKTREE POR TASK, e é o que deixa o agente ter só as mudanças dele:
//! `done` commita a worktree INTEIRA, então o isolamento é o que faz `git add -A`
//! ser seguro ali dentro e proibido no checkout principal (medido em 16/08: um
//! commit pelado varreu 43 arquivos de outra sessão).
//!
//! depends_on: src/shared/work/model.ts
//! impacts:    src/shared/work/done.ts

import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { TRAVA, crachaDe, ehMinha } from './claim.ts'
import {
  type Task,
  acharTask,
  agora,
  branchDe,
  escreverFm,
  lembra,
  projetoCorrente,
  projetoDe,
  projetos,
  rel,
  rotuloDe,
  stateDe,
  workRepo,
  worktreeDe,
} from './model.ts'

/** `git` no repo dado. Devolve stdout limpo e o exit — nunca joga: o chamador
 *  decide se a falha é recusa ou informação. */
export function git(repo: string, ...args: string[]): { ok: boolean; out: string } {
  const p = Bun.spawnSync(['git', '-C', repo, ...args])
  return { ok: p.exitCode === 0, out: new TextDecoder().decode(p.exitCode === 0 ? p.stdout : p.stderr).trim() }
}

/** O que o `start` produziu, pra quem chamou imprimir. `worktree` vazia é o modo
 *  `--here`: sem worktree, o trabalho acontece no checkout atual. */
export type Started = { task: Task; worktree: string; branch: string; subject: string; commitStart: string }

/** COMEÇA a task: valida, trava, corta a worktree e FIXA a mensagem do commit.
 *
 *  Esta é a função; `main` abaixo é só a casca que traduz argv e imprime. O
 *  projeto NÃO é parâmetro: ele é lido do caminho da task (`projetoDe`), porque
 *  a task já sabe onde mora — passar de novo daria duas fontes pro mesmo fato. */
export function start(t: Task, opts: { owner?: string; here?: boolean } = {}): Started | { erro: string } {
  const owner = opts.owner ?? 'Gabriel'
  const slug = projetoDe(t.dir)
  const estado = stateDe(t)
  if (t.saida.state && estado !== 'draft')
    return { erro: `${t.slug} está em \`${estado}\` desde ${t.saida.started_at ?? '?'} — start só sai de draft` }

  if (!t.pedido.proof || String(t.pedido.proof).includes('<'))
    return { erro: `${t.slug} não declara \`proof:\` — #proof_per_task. Escreva a prova antes de começar.` }

  const repo = workRepo(t)
  if (!existsSync(repo)) return { erro: `work repo não existe: ${repo}` }
  const head = git(repo, 'rev-parse', 'HEAD')
  if (!head.ok) return { erro: `${repo} não é repo git: ${head.out}` }

  // A TRAVA. A checagem de `draft` lá em cima LÊ o state e o `escreverFm` lá
  // embaixo ESCREVE; entre as duas cabe outro agente. Com UM executor a janela
  // nunca importou, e é por isso que ela sobreviveu até aqui — com cinco puxando
  // da mesma lista ela é de milissegundos, e o prejuízo é dois agentes no mesmo
  // arquivo com dois branches.
  //
  // `mkdirSync` sem `recursive` é o primitivo: falha com EEXIST se já existe, e a
  // criação é ATÔMICA no filesystem. É a mesma propriedade que a fila de 19/08
  // usou no `mv` — agora dentro do verbo que já existia, em vez de numa estrutura
  // paralela que reinventava `owner`, `claude_session` e `done/`.
  //
  // Fica DEPOIS das validações, que são leitura barata, e ANTES do primeiro
  // efeito colateral. Assim nenhum `return` de erro deixa trava presa, exceto o
  // do worktree logo abaixo — e esse solta explicitamente.
  //
  // A sentinela mora DENTRO da task porque é estado da task, e o `done` a apaga.
  // Sobrou de um agente que morreu no meio? `rm -rf <task>/.doing`, à mão e de
  // propósito: destravar é decisão de quem SABE que o outro morreu, não um
  // timeout que adivinha.
  const trava = join(t.dir, TRAVA)
  try {
    mkdirSync(trava)
  } catch {
    // Já travada. `my teams claim` grava um CRACHÁ dentro da trava, e ele é o que
    // distingue "outro agente chegou primeiro" de "sou eu, continuando" — sem ele
    // um worker que pega e depois inicia recusava a própria task.
    if (!ehMinha(crachaDe(t.dir)))
      return {
        erro: `${t.slug} já foi assumida por ${t.saida.owner ?? 'outro agente'} — ele chegou primeiro.\n  se o dono morreu no meio: \`my teams claim ${t.nnn} --release --force\``,
      }
  }
  const solta = () => {
    try {
      rmSync(trava, { recursive: true })
    } catch {}
  }

  const branch = branchDe(t)
  let worktree = repo
  if (!opts.here) {
    // O caminho não é escolhido aqui: ele é DERIVADO (`~/.me/worktrees/…`) e já
    // está escrito no `CONTEXT.md` da task, então quem lê o pedido sabe onde o
    // trabalho vai acontecer antes de rodar comando nenhum.
    worktree = String(t.pedido.worktree || worktreeDe(slug, rotuloDe(t))).replace(/^~/, process.env.HOME ?? '~')
    if (existsSync(worktree)) console.log(`worktree já existia: ${worktree}`)
    else {
      mkdirSync(dirname(worktree), { recursive: true }) // `git worktree add` não cria o pai
      const criada = git(repo, 'worktree', 'add', worktree, '-b', branch)
      if (!criada.ok) {
        // Branch já existe (task retomada depois de um `done` incompleto): usa
        // sem `-b` em vez de recusar — retomar é o caso normal, não o excepcional.
        const retomada = git(repo, 'worktree', 'add', worktree, branch)
        if (!retomada.ok) return solta(), { erro: `worktree não saiu: ${criada.out}` }
      }
    }
  }

  // A mensagem, FIXADA agora. Subject no imperativo com o escopo do projeto e o
  // NNN; corpo com o título, a prova e o dono, que é o que o `done` não deveria
  // ter que redigir.
  const subject = `feat(${slug}/${t.nnn}): ${t.titulo}`
  const mensagem = [
    subject,
    '',
    `Task: ${rel(t.dir)}`,
    `Proof: ${String(t.pedido.proof).trim().split('\n').join(' ')}`,
    `Owner: ${owner}`,
  ].join('\n')

  escreverFm(join(t.dir, 'output.md'), {
    state: 'doing',
    owner,
    started_at: agora(),
    claude_session: process.env.CLAUDE_CODE_SESSION_ID ?? '',
    commit_start: head.out,
    worktree: opts.here ? '' : worktree,
    branch: opts.here ? '' : branch,
    commit_message: mensagem,
  })

  return { task: t, worktree: opts.here ? '' : worktree, branch: opts.here ? '' : branch, subject, commitStart: head.out }
}

