//! A fixed set of runs, for designing the view without the disk.
//!
//! Every widget so far was designed against whatever the house happened to hold
//! that hour — and the house moved while we looked: a run went from `rodando` to
//! `pr_aberto` mid-session, branches got renamed under us, and a test that
//! asserted a live value went red for being right an hour earlier. Designing a
//! row against moving data means never seeing the same row twice.
//!
//! So: one group per SHAPE the real tree can take, hand-written, stable, and
//! deliberately including the ugly ones — no `t0`, no plan, a branch the yaml
//! names and git does not have, a subject with three mains, a subject with one.
//! If a widget looks right here, it looks right everywhere; if a state is missing
//! from this file, it is a state nobody designed for.
//!
//! Clocks are RELATIVE to the moment the sandbox is read, because a fixed
//! timestamp would age into "3 dias" and stop exercising the countdown.

import { readPlan } from './plan.js'
import type { Commit, Issue, Run, Unit } from './runs.js'

/**
 * The repo the sandbox pretends to publish to.
 *
 * It is a marker, not a name: `gh/pane.ts` compares against it to decide whether to
 * shell out or to render a fixture. Clicking an issue in the sandbox has to open a
 * real editor tab — a sandbox that only works until you click is not a sandbox.
 */
export const SANDBOX_REPO = 'exemplo/monorepo'

/**
 * A REAL repo, so one sandbox run can show a real issue in the pane.
 *
 * A fixture proves the layout; only a real body proves the RENDER — headings someone
 * actually wrote, a checklist half ticked, four labels, a comment thread. Both live
 * in the sandbox because they answer different questions.
 */
export const REAL_REPO = 'mktvirtual/mukutu-mono'

const MINUTE = 60_000

function commit(hash: string, subject: string, minutesAgo: number, task: string | null = null): Commit {
  return { hash, subject, at: Date.now() - minutesAgo * MINUTE, task }
}

function unit(id: string, ref: string | null, ahead: number, minutesAgo: number, estado: string): Unit {
  return {
    id,
    branch: `staging/${id.replace('S', 'U')}`,
    ref,
    issue: String(283 + Number(id.slice(1))),
    estado,
    ahead,
    last: ahead || ref ? commit(`abc${id}`, `fix(sandbox): ${id} mexeu em algo [${id}/T1]`, minutesAgo) : null,
    commits: ahead
      ? Array.from({ length: ahead }, (_, index) =>
          commit(`abc${id}${index}`, `fix(sandbox): ${id} passo ${index + 1} [${id}/T${index + 1}]`, minutesAgo + index),
        )
      : [],
  }
}

function issues(...numbers: [string, string][]): Issue[] {
  return numbers.map(([number, titulo]) => ({ number, titulo }))
}

function run(over: Partial<Run> & Pick<Run, 'main' | 'id'>): Run {
  return {
    dir: `/sandbox/${over.main}/${over.id}`,
    root: '/sandbox',
    state: {},
    hasState: true,
    taskMinutes: [],
    t0: null,
    commits: [],
    units: [],
    plan: readPlan(''),
    planFrom: null,
    prs: [],
    done: new Map(),
    repo: null,
    label: null,
    issues: [],
    ...over,
  }
}

/** The shapes, in the order they matter while designing: loudest first. */
export function sandboxRuns(): Run[] {
  const now = Date.now()

  return [
    // The loud case: a fan-out mid-flight, four units, one of them on a branch the
    // yaml names and git never had.
    run({
      main: '01_coding',
      id: '979_leque_rodando',
      state: { at: 'coding:BatchSettled', subject: 'quatro unidades em voo' },
      taskMinutes: [4, 3, 2, 5, 4, 3, 2, 4],
      t0: { at: now - 33 * MINUTE, source: 'git' },
      planFrom: '02_product/output/999_leque_rodando_sprints',
      repo: SANDBOX_REPO,
      label: 'run/999_leque_rodando_sprints',
      units: [
        unit('S1', 'staging-U1', 3, 6, 'pr_aberto'),
        unit('S2', 'staging/U2', 2, 1, 'rodando'),
        unit('S3', null, 0, 0, 'rodando'),
        unit('S4', 'staging-U4', 1, 12, 'rodando'),
      ],
      commits: [commit('5d6e7f8', 'chore(979): o lote disparou', 33)],
    }),

    // The plan that produced it: issues published, countdown running.
    run({
      main: '02_product',
      id: '999_leque_rodando_sprints',
      state: { at: 'generate-issues', subject: 'o plano das quatro unidades' },
      taskMinutes: [4, 3, 2, 5, 4, 3, 2, 4],
      t0: { at: now - 41 * MINUTE, source: 'state.yaml' },
      repo: SANDBOX_REPO,
      label: 'run/999_leque_rodando_sprints',
      issues: issues(['284', 'o corte do fluxo'], ['285', 'o worker do outbox'], ['286', 'a marca d’água']),
      commits: [commit('1a2b3c4', 'sprints(999): o plano, oito tasks', 44)],
    }),

    // The QA gate: no `state.yaml` at all, which is the real shape of the first one.
    run({
      main: '03_qa',
      id: '999_leque_rodando_qa',
      hasState: false,
      commits: [commit('9a0b1c2', 'qa(999): o gate falha no staging limpo', 4)],
    }),

    // A countdown halfway through.
    run({
      main: '02_product',
      id: '980_plano_contando',
      state: { at: 'do-sprints', subject: 'o cronômetro no meio do caminho' },
      taskMinutes: [4, 3, 2, 3, 5, 2, 4, 2, 3],
      t0: { at: now - 12 * MINUTE, source: 'state.yaml' },
      commits: [commit('3c4d5e6', 'feat(980): a primeira sprint fechou', 9, '[S1/T3]')],
    }),

    // Past its own estimate: the orange case.
    run({
      main: '02_product',
      id: '981_plano_estourado',
      state: { at: 'do-sprints', subject: 'passou do estimado' },
      taskMinutes: [5, 5, 5],
      // `source: '_events'` até 17/08, quando a pasta morreu. `git` é o que
      // sobrou como relógio de fallback — e a fixture tem que mentir menos que o
      // código, não mais.
      t0: { at: now - 300 * MINUTE, source: 'git' },
    }),

    // REAL issues, on purpose: this run points at `mktvirtual/mukutu-mono` and the
    // numbers are the ones open there right now. Clicking one shells out to `gh` and
    // renders the actual body and comments — the only way to see how a real issue
    // looks in the pane without leaving the sandbox. Everything else here is fake.
    run({
      main: '02_product',
      id: '978_mkt_funnel_asks',
      state: { at: 'generate-issues', subject: 'as issues do funnel, essas existem de verdade' },
      taskMinutes: [3, 4, 5, 3],
      t0: { at: now - 26 * MINUTE, source: 'state.yaml' },
      repo: REAL_REPO,
      label: 'run/978_mkt_funnel_asks',
      issues: issues(
        ['178', 'Meta Ads não retorna dados no painel'],
        ['179', "padronizar rótulos da tela — 'Em Tempo Real' e o 'perdido' órfão"],
        ['180', 'validar HubSpot × mídia antes de chamar conversão de lead'],
        ['181', 'visão por cargo'],
        ['182', 'levantar as plataformas que faltam e dar previsão do LinkedIn'],
      ),
      commits: [commit('7f8e9d0', 'docs(978): as três labels do run', 26)],
    }),

    // A plan with no clock, and a run with nothing at all.
    run({
      main: '02_product',
      id: '982_sem_relogio',
      state: { at: 'generate-sprints', subject: 'plano escrito, nenhum t0 em disco' },
      taskMinutes: [3, 3, 4],
    }),
    run({ main: '03_qa', id: '983_sem_nada', hasState: false }),
  ]
}

/**
 * One fake GitHub issue, shaped exactly like `gh issue view --json` answers.
 *
 * Body and comments are the two things the pane exists to show, so both are here —
 * and the comment is the reason the pane inlines them: reading an issue from a run is
 * usually about the discussion, not the description.
 */
export function sandboxIssue(number: string): {
  number: number
  title: string
  state: string
  body: string
  url: string
  labels: { name: string }[]
  comments: { author: { login: string }; createdAt: string; body: string }[]
} {
  return {
    number: Number(number),
    title: 'o worker do outbox precisa ser idempotente',
    state: 'OPEN',
    body: [
      'Rodar o mesmo lote duas vezes hoje manda a mesma foto duas vezes.',
      '',
      '- [x] chave natural no outbox',
      '- [ ] `find-or-create` antes do insert',
      '- [ ] teste com controle negativo',
      '',
      '> Medido em 17/08: 4 unidades em voo, 10 commits à frente da base.',
    ].join('\n'),
    url: `https://github.com/${SANDBOX_REPO}/issues/${number}`,
    labels: [{ name: 'run/999_leque_rodando_sprints' }, { name: 'bug' }],
    comments: [
      {
        author: { login: 'sandbox' },
        createdAt: '2026-08-17T19:00:00Z',
        body: 'Esta issue é FIXTURE: o sandbox não fala com o GitHub.',
      },
    ],
  }
}
