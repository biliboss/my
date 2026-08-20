//! A UNIT of a fan-out, as a column: branch, commits ahead, its PR, its checks.
//!
//! Columns rather than rows because four units running in parallel are read by COMPARING
//! them — which one is behind, which one is red — and comparison across rows makes the eye
//! travel. Below `sm` they stack, because a phone has no columns.

import type { Pull } from '../../disk/prs.js'
import type { Unit } from '../../disk/runs.js'
import { escape } from '../shell.js'

export function unitColumn(unit: Unit, pull: Pull | undefined): string {
  const failed = pull?.checks.failed ?? 0
  const pending = pull?.checks.pending ?? 0

  // The branch is the truth and the yaml is the intention: a unit whose declared branch
  // does not exist is the state that cost the most to find, so it gets the loud border.
  const border = !unit.ref ? 'border-warning' : failed ? 'border-error' : 'border-base-300'

  return `
<article class="card bg-base-200 border ${border} grow basis-56">
  <div class="card-body p-3 gap-2">
    <header class="flex items-center gap-2">
      <span class="badge badge-sm font-mono">${escape(unit.id)}</span>
      <code class="text-xs opacity-70 truncate">${escape((unit.ref ?? unit.branch ?? '?').split('/').pop() ?? '?')}</code>
    </header>

    ${
      unit.ref
        ? `<p class="text-sm">${unit.ahead} commit${unit.ahead === 1 ? '' : 's'} à frente</p>`
        : '<p class="text-sm text-warning">o branch declarado não existe</p>'
    }

    ${
      pull
        ? `<div class="flex items-center gap-2 text-sm">
        <a class="link link-primary font-mono" data-do="pr" data-arg="${escape(pull.number)}">#${escape(pull.number)}</a>
        <span class="badge badge-sm ${failed ? 'badge-error' : pending ? 'badge-info' : 'badge-success'}">
          ${failed ? `✗ ${failed}` : pending ? '…' : '✓'}
        </span>
      </div>`
        : '<p class="text-xs opacity-50">sem PR</p>'
    }

    <p class="text-xs opacity-50">state.yaml diz: <code>${escape(unit.estado ?? '?')}</code></p>
    ${unit.last ? `<p class="text-xs opacity-60 truncate" title="${escape(unit.last.subject)}">${escape(unit.last.subject)}</p>` : ''}
  </div>
</article>`
}
