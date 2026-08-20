//! THE VIEW OF A QA RUN: the verdict, and the control that makes it mean something.
//!
//! Decision D4 of run 977. The QA of run 999 measured the gate on a CLEAN worktree first
//! and found it already failing — which changes the reading of every unit below it. So the
//! control goes at the top, loud, before any per-unit result.
//!
//! Declared risk, from the same interview: the QA summary is PROSE. There is no structured
//! verdict on disk, so this view renders the markdown the QA wrote rather than faking a
//! table out of it — a table built from prose would be the pane inventing data.

import { docIndex, docSections } from './parts/doc_sections.js'
import { metaSide } from './parts/meta_side.js'
import type { RunPage } from './run.js'
import { escape, shell, type ShellOptions } from './shell.js'

/** The first paragraph under a heading that mentions a clean tree — the control. */
function controlWarning(summary: string): string | null {
  const lines = summary.split('\n')
  const at = lines.findIndex((line) => /^#{1,3} .*(limpo|clean)/i.test(line))
  if (at === -1) return null
  const heading = lines[at].replace(/^#+\s*/, '')
  return heading
}

export function qaRunView(page: RunPage, options: Omit<ShellOptions, 'title'>): string {
  const { run, summary } = page
  const control = summary ? controlWarning(summary) : null

  const repro = page.reproFiles.length
    ? `<section class="card bg-base-200 border border-base-300">
      <div class="card-body p-4 gap-2">
        <h2 class="text-sm font-semibold opacity-70">repro · ${page.reproFiles.length}</h2>
        <div class="flex flex-col gap-1">
          ${page.reproFiles
            .map(
              (file) =>
                `<button class="link text-xs font-mono text-left" data-do="file" data-arg="repro/${escape(file)}">repro/${escape(file)}</button>`,
            )
            .join('')}
        </div>
      </div>
    </section>`
    : ''

  // The index goes ABOVE the facts in the side column: on a nine-section document the
  // question is "where is the part I want", and the repo slug can wait.
  const meta = metaSide([
    { label: 'seções', value: summary ? docIndex(summary) : '' },
    { label: 'passo', value: `<code class="text-xs">${escape(run.state.at ?? '?')}</code>` },
    { label: 'repo', value: run.repo ? `<code class="text-xs">${escape(run.repo)}</code>` : '' },
    { label: 'alvo', value: run.state.origem ? `<code class="text-xs">${escape(run.state.origem)}</code>` : '' },
    { label: 'artefatos', value: page.artefacts.map((file) => `<button class="link text-xs font-mono text-left" data-do="file" data-arg="${escape(file)}">${escape(file)}</button>`).join('<br>') },
  ])

  const body = `
<main class="w-full px-6 py-5 flex flex-col gap-5">
  <header class="flex flex-col gap-1">
    <div class="flex items-center gap-2 text-sm">
      <span class="badge badge-success badge-sm">qa</span>
      <span class="font-mono opacity-60">${escape(run.main)}</span>
    </div>
    <h1 class="text-2xl font-semibold">${escape(run.id)}</h1>
  </header>

  ${
    control
      ? `<div class="alert alert-warning text-sm">
    <span>⚠️ ${escape(control)} — o controle vem antes do veredito, senão cada unidade parece culpada.</span>
  </div>`
      : ''
  }

  <div class="flex flex-col lg:flex-row gap-6 items-start">
    <div class="flex flex-col gap-4 grow min-w-0">
      ${
        summary
          ? docSections(summary)
          : '<p class="text-sm opacity-60">Este run de QA não deixou <code>summary.md</code>.</p>'
      }
      ${repro}
    </div>
    ${meta}
  </div>
</main>`

  return shell(body, { ...options, title: `${run.id} · veredito` })
}
