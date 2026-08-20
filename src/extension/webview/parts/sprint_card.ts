//! A SPRINT in a card: the tasks, their durations, and the command that proves each one.
//!
//! The `proof` is the reason this part exists. Every task in this house declares the
//! command that proves it done — 9 of 9 on run 980 — and until now that command lived in a
//! yaml nobody opened. It renders in mono, because it is meant to be copied, not read.

import type { Commit } from '../../disk/runs.js'
import type { PlanSprint } from '../../disk/plan.js'
import { escape } from '../shell.js'

/**
 * `done` maps `S2/T3` to the commit that closed it — read from the unit branches, never
 * written to disk. A task with a commit shows ✓ and the hash; one without stays hollow.
 * Position is the task number, which is the same rule the commit author followed.
 */
export function sprintCard(sprint: PlanSprint, done?: Map<string, Commit>): string {
  const tasks = sprint.tasks
    .map((task, index) => {
      const closed = done?.get(`${sprint.id}/T${index + 1}`)
      return `
      <li class="flex flex-col gap-1 py-2 border-b border-base-300 last:border-0">
        <div class="flex items-start gap-2">
          <span class="${closed ? 'text-success' : 'opacity-40'} text-xs mt-0.5">${closed ? '✓' : '○'}</span>
          <span class="text-sm grow ${closed ? 'opacity-70' : ''}">${escape(task.title)}</span>
          ${closed ? `<code class="text-[0.7rem] font-mono opacity-50 shrink-0">${escape(closed.hash)}</code>` : ''}
          ${task.duration ? `<span class="badge badge-ghost badge-sm shrink-0">${escape(task.duration)}</span>` : ''}
        </div>
        ${task.description ? `<p class="text-xs opacity-60 pl-6">${escape(task.description)}</p>` : ''}
        ${
          task.proof
            ? `<code class="text-xs font-mono bg-base-300/40 rounded px-2 py-1 ml-6 block overflow-x-auto whitespace-pre">${escape(task.proof)}</code>`
            : '<span class="text-xs text-warning ml-6">sem proof</span>'
        }
      </li>`
    })
    .join('')

  return `
<section class="card bg-base-200 border border-base-300">
  <div class="card-body p-4 gap-2">
    <header class="flex items-baseline gap-2 flex-wrap">
      <span class="badge badge-primary badge-sm font-mono">${escape(sprint.id)}</span>
      <h3 class="text-base font-semibold grow">${escape(sprint.titulo ?? '(sem título)')}</h3>
      ${sprint.duration ? `<span class="text-xs opacity-60">${escape(sprint.duration)}</span>` : ''}
      ${sprint.issue ? `<a class="link link-primary text-xs" data-do="issue" data-arg="${escape(sprint.issue)}">#${escape(sprint.issue)}</a>` : ''}
    </header>
    ${sprint.unidade ? `<p class="text-xs font-mono opacity-50">${escape(sprint.unidade)}</p>` : ''}
    <ul class="flex flex-col">${tasks}</ul>
  </div>
</section>`
}
