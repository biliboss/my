//! THE VIEW OF A CODING RUN: the batch, unit by unit.
//!
//! Decision D3 of run 977, and the owner picked the shape himself: one column per unit —
//! branch, commits ahead, its PR, its checks — because four agents running in parallel are
//! read by COMPARING them.
//!
//! And then the part nobody could see anywhere: `recusadas[]` and `parqueadas[]`. Run 979
//! refused S5 because `pnpm --filter broker-web` matches no package in the repo (a proof
//! pointing at nothing) and parked S6 waiting on two decisions. Both reasons were written
//! down the day it happened and had no surface until this view.

import { callstackBlock } from './parts/callstack_block.js'
import { docSections } from './parts/doc_sections.js'
import { metaSide } from './parts/meta_side.js'
import { unitColumn } from './parts/unit_column.js'
import type { RunPage } from './run.js'
import { escape, shell, type ShellOptions } from './shell.js'

function refusedCard(title: string, tone: string, items: RunPage['batch']['refused']): string {
  if (!items.length) return ''
  return `
<section class="card bg-base-200 border ${tone}">
  <div class="card-body p-4 gap-2">
    <h2 class="text-sm font-semibold opacity-80">${title} · ${items.length}</h2>
    ${items
      .map(
        (item) => `<div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <span class="badge badge-sm font-mono">${escape(item.id)}</span>
        ${item.issue ? `<button class="link link-primary text-xs" data-do="issue" data-arg="${escape(item.issue)}">#${escape(item.issue)}</button>` : ''}
      </div>
      <p class="text-xs opacity-75">${escape(item.porQue ?? 'sem motivo escrito')}</p>
    </div>`,
      )
      .join('')}
  </div>
</section>`
}

export function codingRunView(page: RunPage, options: Omit<ShellOptions, 'title'>): string {
  const { run } = page
  const moving = run.units.filter((unit) => unit.ahead > 0).length
  const byRef = new Map(run.prs.map((pull) => [pull.ref.replace(/^origin\//, ''), pull]))

  const columns = run.units
    .map((unit) => unitColumn(unit, byRef.get((unit.ref ?? unit.branch ?? '').replace(/^origin\//, ''))))
    .join('\n')

  const meta = metaSide([
    { label: 'passo', value: `<code class="text-xs">${escape(run.state.at ?? '?')}</code>` },
    { label: 'unidades', value: `${moving} de ${run.units.length} andando` },
    { label: 'repo', value: run.repo ? `<code class="text-xs">${escape(run.repo)}</code>` : '' },
    { label: 'repo de trabalho', value: run.state.work_repo ? `<code class="text-xs">${escape(run.state.work_repo)}</code>` : '' },
    { label: 'base', value: run.state.base ? `<code class="text-xs">${escape(run.state.base)}</code>` : '' },
    { label: 'plano', value: page.plan.label ? `<code class="text-xs">${escape(page.plan.label)}</code>` : '' },
    {
      label: 'origem',
      value: run.state.origem
        ? `<button class="link text-xs font-mono text-left" data-do="file" data-arg="${escape(run.state.origem)}">${escape(run.state.origem.split('/').pop() ?? '')}</button>`
        : '',
    },
  ])

  const body = `
<main class="w-full px-6 py-5 flex flex-col gap-5">
  <header class="flex flex-col gap-1">
    <div class="flex items-center gap-2 text-sm">
      <span class="badge badge-info badge-sm">coding</span>
      <span class="font-mono opacity-60">${escape(run.main)}</span>
    </div>
    <h1 class="text-2xl font-semibold">${escape(run.id)}</h1>
    ${run.state.subject ? `<p class="text-sm opacity-70">${escape(run.state.subject)}</p>` : ''}
  </header>

  <div class="flex flex-col lg:flex-row gap-6 items-start">
    <div class="flex flex-col gap-4 grow min-w-0">
      ${
        run.units.length
          ? `<section class="flex flex-wrap gap-3">${columns}</section>`
          : '<p class="text-sm opacity-60">Este run não declara <code>unidades:</code>.</p>'
      }
      ${refusedCard('recusadas', 'border-error/40', page.batch.refused)}
      ${refusedCard('parqueadas', 'border-warning/40', page.batch.parked)}
      ${page.desenho ? callstackBlock(page.desenho.path, page.desenho.markdown) : ''}
      ${page.summary ? docSections(page.summary) : ''}
    </div>
    ${meta}
  </div>
</main>`

  return shell(body, { ...options, title: `${run.id} · lote` })
}
