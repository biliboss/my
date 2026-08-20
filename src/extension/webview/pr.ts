//! THE VIEW OF A PULL REQUEST: the same parts, a different question.
//!
//! An issue asks "what has to happen"; a PR asks "can this land". So the checks are the
//! headline here, and they are the one thing this view adds to the issue layout.

import type { CheckRun, PullDetail } from '../gh/api.js'
import { summarise } from '../disk/prs.js'
import { commentCard } from './parts/comment_card.js'
import { ghBody } from './parts/gh_body.js'
import { labelChip } from './parts/label_chip.js'
import { metaSide } from './parts/meta_side.js'
import { statePill } from './parts/state_pill.js'
import { when } from './parts/when.js'
import { escape, shell, type ShellOptions } from './shell.js'

/**
 * The one classifier, borrowed from the tree.
 *
 * `summarise` reads `state` and the API here calls the same field `status`, so the rename
 * is the whole adaptation. Calling it PER CHECK is deliberate: this view used to carry its
 * own copy of the three verdict sets, and a third copy — the headline — had drifted to
 * `conclusion === 'FAILURE'` alone. Whatever the tree counts as failed, this pane paints
 * red, by construction rather than by someone remembering to edit both.
 */
const tallyOf = (checks: CheckRun[]) =>
  summarise(checks.map((check) => ({ conclusion: check.conclusion, state: check.status })))

/** One line per check, because "1 falhou" is the answer and WHICH one is the next question. */
function checkList(checks: PullDetail['checks']): string {
  if (!checks.length) return '<p class="text-sm opacity-60">Nenhum check.</p>'

  const rows = checks
    .map((check) => {
      const verdict = (check.conclusion || check.status || '').toUpperCase()
      const tally = tallyOf([check])
      const bad = tally.failed > 0
      const running = tally.pending > 0
      // Skipped is dimmed rather than coloured: a job with nothing to do is not news, and
      // this house skips five per PR.
      const badge = bad ? 'badge-error' : running ? 'badge-info' : verdict === 'SUCCESS' ? 'badge-success' : 'badge-ghost'
      const glyph = bad ? '✗' : running ? '…' : verdict === 'SUCCESS' ? '✓' : '·'
      return `<li class="flex items-center gap-2 text-sm py-1">
        <span class="badge ${badge} badge-sm">${glyph}</span>
        <span class="${bad || running ? '' : 'opacity-70'}">${escape(check.name)}</span>
        <span class="text-xs opacity-50 ml-auto">${escape(verdict.toLowerCase())}</span>
      </li>`
    })
    .join('')

  return `<ul class="flex flex-col divide-y divide-base-300">${rows}</ul>`
}

export function prView(pull: PullDetail, options: Omit<ShellOptions, 'title'>): string {
  const failed = tallyOf(pull.checks).failed

  const meta = metaSide([
    { label: 'estado', value: statePill(pull.draft ? 'DRAFT' : pull.state) },
    { label: 'review', value: pull.review ? escape(pull.review.toLowerCase().replace('_', ' ')) : 'ninguém olhou' },
    { label: 'branch', value: `<code class="font-mono text-xs">${escape(pull.ref)} → ${escape(pull.base)}</code>` },
    { label: 'diff', value: `<span class="text-success">+${pull.additions}</span> <span class="text-error">−${pull.deletions}</span> · ${pull.changedFiles} arquivo${pull.changedFiles === 1 ? '' : 's'}` },
    { label: 'labels', value: pull.labels.map((label) => labelChip(label.name, label.color)).join(' ') },
    { label: 'autor', value: `<span class="font-semibold">${escape(pull.author)}</span>` },
    { label: 'aberto em', value: when(pull.createdAt) },
    { label: 'repo', value: `<code class="font-mono text-xs">${escape(pull.repo)}</code>` },
  ])

  const body = `
<main class="w-full px-6 py-5 flex flex-col gap-5">
  <header class="flex flex-col gap-2">
    <div class="flex items-center gap-2 flex-wrap text-sm">
      ${statePill(pull.draft ? 'DRAFT' : pull.state)}
      <span class="font-mono opacity-70">#${escape(String(pull.number))}</span>
      ${failed ? `<span class="badge badge-error text-xs">${failed} check${failed === 1 ? '' : 's'} falhando</span>` : ''}
    </div>
    <h1 class="text-2xl font-semibold leading-tight">${escape(pull.title)}</h1>
  </header>

  <div class="flex flex-col lg:flex-row gap-6 items-start">
    <div class="flex flex-col gap-4 grow min-w-0">
      <section class="card bg-base-200 border border-base-300">
        <div class="card-body p-4 gap-3">
          <h2 class="text-sm font-semibold opacity-70">Checks</h2>
          ${checkList(pull.checks)}
        </div>
      </section>

      <section class="card bg-base-200 border border-base-300">
        <div class="card-body p-4">${ghBody(pull.bodyHtml, 'text-sm')}</div>
      </section>

      ${
        pull.comments.length
          ? `<section class="flex flex-col gap-3">
        <h2 class="text-sm font-semibold opacity-70">${pull.comments.length} comentário${pull.comments.length === 1 ? '' : 's'}</h2>
        ${pull.comments.map(commentCard).join('\n')}
      </section>`
          : ''
      }

      <footer class="flex gap-2 pt-1">
        <button class="btn btn-sm btn-primary" data-do="open">Abrir no GitHub</button>
        <button class="btn btn-sm" data-do="reload">Recarregar</button>
      </footer>
    </div>
    ${meta}
  </div>
</main>`

  return shell(body, { ...options, title: `#${pull.number} · ${pull.title}` })
}
