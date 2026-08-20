//! THE VIEW OF AN ISSUE — one view per element, and this is the first of them.
//!
//! It composes parts and nothing else: the shell decides security and theme, the parts
//! decide how a pill, a label, a body and a comment look, and this file decides the
//! LAYOUT of an issue. Adding a view for another element means writing this much and no
//! more.
//!
//! Full width, two columns above `lg`: body on the left, facts on the right, exactly
//! where a wide screen has room for them.

import type { IssueDetail } from '../gh/api.js'
import { commentCard } from './parts/comment_card.js'
import { ghBody } from './parts/gh_body.js'
import { labelChip } from './parts/label_chip.js'
import { metaSide } from './parts/meta_side.js'
import { statePill } from './parts/state_pill.js'
import { when } from './parts/when.js'
import { escape, shell, type ShellOptions } from './shell.js'

export function issueView(issue: IssueDetail, options: Omit<ShellOptions, 'title'>): string {
  const labels = issue.labels.map((label) => labelChip(label.name, label.color)).join(' ')

  const meta = metaSide([
    { label: 'estado', value: statePill(issue.state) },
    { label: 'labels', value: labels },
    {
      label: 'autor',
      value: `${issue.avatar ? `<img class="w-5 h-5 rounded-full" src="${escape(issue.avatar)}" alt=""> ` : ''}<span class="font-semibold">${escape(issue.author)}</span>`,
    },
    { label: 'aberta em', value: when(issue.createdAt) },
    { label: 'atribuída a', value: issue.assignees.map((who) => escape(who)).join(', ') },
    { label: 'repo', value: `<code class="font-mono text-xs">${escape(issue.repo)}</code>` },
  ])

  const body = `
<main class="w-full px-6 py-5 flex flex-col gap-5">
  <header class="flex flex-col gap-2">
    <div class="flex items-center gap-2 flex-wrap text-sm">
      ${statePill(issue.state)}
      <span class="font-mono opacity-70">#${escape(String(issue.number))}</span>
      ${issue.fixture ? '<span class="badge badge-warning badge-outline text-xs">fixture · sandbox</span>' : ''}
    </div>
    <h1 class="text-2xl font-semibold leading-tight">${escape(issue.title)}</h1>
  </header>

  <div class="flex flex-col lg:flex-row gap-6 items-start">
    <div class="flex flex-col gap-4 grow min-w-0">
      <section class="card bg-base-200 border border-base-300">
        <div class="card-body p-4">${ghBody(issue.bodyHtml, 'text-sm')}</div>
      </section>

      ${
        issue.comments.length
          ? `<section class="flex flex-col gap-3">
        <h2 class="text-sm font-semibold opacity-70">${issue.comments.length} comentário${issue.comments.length === 1 ? '' : 's'}</h2>
        ${issue.comments.map(commentCard).join('\n')}
      </section>`
          : '<p class="text-sm opacity-60">Nenhum comentário.</p>'
      }

      <footer class="flex gap-2 pt-1">
        <button class="btn btn-sm btn-primary" data-do="open">Abrir no GitHub</button>
        <button class="btn btn-sm" data-do="reload">Recarregar</button>
      </footer>
    </div>
    ${meta}
  </div>
</main>`

  return shell(body, { ...options, title: `#${issue.number} · ${issue.title}` })
}
