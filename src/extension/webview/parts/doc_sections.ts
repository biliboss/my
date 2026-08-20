//! A long document as COLLAPSIBLE sections, with an index beside it.
//!
//! Straight from the screen: the QA summary rendered as one card was two thousand pixels of
//! prose — "tá gigante né?" — and a document that long is read by scrolling past it. Cut at
//! its headings, the reader gets a table of contents and opens what they came for.
//!
//! `<details>` and not a script, because a webview under this CSP runs only nonce'd code and
//! the native element already remembers which section is open while the page lives. The
//! FIRST section opens by itself: a page of nine closed rows looks broken.

import { markdownLite, sections, type Section } from './markdown_lite.js'
import { escape } from '../shell.js'

/** A stable id per heading, so the index can jump and the browser can deep-link. */
function slug(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return base ? `${base}-${index}` : `secao-${index}`
}

/** A hint of what a closed section holds: the first line of prose, cut short. */
function preview(section: Section): string {
  const first = section.body
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('|') && !line.startsWith('```') && !line.startsWith('>'))
  if (!first) return ''
  const short = first.length > 90 ? `${first.slice(0, 90)}…` : first
  return `<span class="text-xs opacity-50 font-normal truncate">${escape(short.replace(/[*`]/g, ''))}</span>`
}

export function docIndex(markdown: string): string {
  const { sections: found } = sections(markdown)
  if (found.length < 2) return ''

  const links = found
    .map(
      (section, index) =>
        `<a class="text-xs opacity-70 hover:opacity-100 truncate ${section.level > 2 ? 'pl-3' : ''}" href="#${slug(section.title, index)}">${escape(section.title.replace(/[*`]/g, ''))}</a>`,
    )
    .join('')

  return `
<nav class="flex flex-col gap-1 lg:sticky lg:top-4">
  <span class="text-xs uppercase tracking-wide opacity-50 mb-1">${found.length} seções</span>
  ${links}
</nav>`
}

export function docSections(markdown: string): string {
  const { intro, sections: found } = sections(markdown)

  // A document with one section is not a document with sections: render it plain.
  if (found.length < 2) {
    return `<section class="card bg-base-200 border border-base-300"><div class="card-body p-4">${markdownLite(markdown)}</div></section>`
  }

  const cards = found
    .map(
      (section, index) => `
    <details id="${slug(section.title, index)}" class="card bg-base-200 border border-base-300" ${index === 0 ? 'open' : ''}>
      <summary class="card-body p-3 cursor-pointer flex flex-row items-baseline gap-2 min-w-0">
        <span class="text-sm font-semibold shrink-0">${escape(section.title.replace(/[*`]/g, ''))}</span>
        ${preview(section)}
      </summary>
      <div class="px-4 pb-4 -mt-1">${markdownLite(section.body)}</div>
    </details>`,
    )
    .join('')

  return `
${intro ? `<div class="text-sm opacity-80">${markdownLite(intro)}</div>` : ''}
<div class="flex flex-col gap-2">${cards}</div>`
}
