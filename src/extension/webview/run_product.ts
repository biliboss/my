//! THE VIEW OF A PRODUCT RUN: the plan, and the plan is the point.
//!
//! Decision D2 of run 977, in the owner's words: the view leads with sprint · task ·
//! proof. Everything else — the interview, the research fronts, the state pointer — is a
//! link, because those are files someone opens to EDIT, and a pane that re-renders a file
//! you are about to edit is a pane in the way.
//!
//! `coverage` closes the page for the reason it exists in the template: an id that made it
//! into no sprint is invisible until something lists them side by side.

import { callstackBlock } from './parts/callstack_block.js'
import { metaSide } from './parts/meta_side.js'
import { sprintCard } from './parts/sprint_card.js'
import type { RunPage } from './run.js'
import { escape, shell, type ShellOptions } from './shell.js'

function artefactList(page: RunPage): string {
  return page.artefacts
    .map(
      (file) =>
        `<button class="link text-xs font-mono opacity-70 text-left" data-do="file" data-arg="${escape(file)}">${escape(file)}</button>`,
    )
    .join('<br>')
}

export function productRunView(page: RunPage, options: Omit<ShellOptions, 'title'>): string {
  const { run, plan } = page
  const tasks = plan.sprints.flatMap((sprint) => sprint.tasks)
  const declared = tasks.reduce((sum, task) => sum + (task.minutes ?? 0), 0)

  const coverage = plan.coverage.length
    ? `<section class="card bg-base-200 border border-base-300">
        <div class="card-body p-4 gap-2">
          <h2 class="text-sm font-semibold opacity-70">coverage · ${plan.coverage.length} ids</h2>
          <ul class="text-xs font-mono flex flex-col gap-1">
            ${plan.coverage.map((entry) => `<li><span class="opacity-60">${escape(entry.id)}</span> → ${escape(entry.where)}</li>`).join('')}
          </ul>
          ${
            plan.outOfScope.length
              ? `<h3 class="text-sm font-semibold opacity-70 mt-2">fora de escopo · ${plan.outOfScope.length}</h3>
              <ul class="text-xs flex flex-col gap-2">
                ${plan.outOfScope.map((item) => `<li><strong>${escape(item.item)}</strong><br><span class="opacity-60">${escape(item.porQue ?? 'sem motivo escrito')}</span></li>`).join('')}
              </ul>`
              : ''
          }
        </div>
      </section>`
    : ''

  const meta = metaSide([
    { label: 'passo', value: `<code class="text-xs">${escape(run.state.at ?? '?')}</code>` },
    {
      label: 'plano',
      value: `${plan.sprints.length} sprints · ${tasks.length} tasks · ${Math.round(declared)} min${
        run.done.size ? ` · <strong>${run.done.size} fechada${run.done.size === 1 ? '' : 's'}</strong>` : ''
      }`,
    },
    { label: 'label', value: plan.label ? `<code class="text-xs">${escape(plan.label)}</code>` : '' },
    { label: 'projeto', value: plan.projeto ? `<code class="text-xs">${escape(plan.projeto)}</code>` : '' },
    { label: 'issues', value: run.issues.map((issue) => `<button class="link link-primary text-xs" data-do="issue" data-arg="${escape(issue.number)}">#${escape(issue.number)}</button>`).join(' ') },
    { label: 'artefatos', value: artefactList(page) },
  ])

  const body = `
<main class="w-full px-6 py-5 flex flex-col gap-5">
  <header class="flex flex-col gap-1">
    <div class="flex items-center gap-2 text-sm">
      <span class="badge badge-primary badge-sm">product</span>
      <span class="font-mono opacity-60">${escape(run.main)}</span>
    </div>
    <h1 class="text-2xl font-semibold">${escape(run.id)}</h1>
    ${run.state.subject ? `<p class="text-sm opacity-70">${escape(run.state.subject)}</p>` : ''}
  </header>

  <div class="flex flex-col lg:flex-row gap-6 items-start">
    <div class="flex flex-col gap-4 grow min-w-0">
      ${plan.sprints.length ? plan.sprints.map((sprint) => sprintCard(sprint, run.done)).join('\n') : '<p class="text-sm opacity-60">Este run não tem <code>sprints.yaml</code> — nada foi planejado ainda.</p>'}
      ${page.desenho ? callstackBlock(page.desenho.path, page.desenho.markdown) : ''}
      ${coverage}
      ${
        plan.declaredDeviation.length
          ? `<section class="card bg-base-200 border border-warning/40">
        <div class="card-body p-4 gap-1">
          <h2 class="text-sm font-semibold text-warning">desvio declarado</h2>
          ${plan.declaredDeviation.map((item) => `<p class="text-xs"><strong>${escape(item.regra ?? '')}</strong><br><span class="opacity-70">${escape(item.desvio ?? '')}</span></p>`).join('')}
        </div>
      </section>`
          : ''
      }
    </div>
    ${meta}
  </div>
</main>`

  return shell(body, { ...options, title: `${run.id} · plano` })
}
