//! The CALL STACK of the feature, when the run declares one.
//!
//! A run's `desenho:` points at a markdown file whose whole value is a mermaid diagram
//! plus one table — this house does not let a feature become code before it becomes a
//! drawing. The pane already renders mermaid (it ships 3.4 MB of it), so showing the
//! drawing costs a `readFileSync` and nothing else.
//!
//! The owner asked for it in one clause during the interview: "callstac se tiver também é
//! interessante".

import { escape } from '../shell.js'

/** Pull the mermaid fences out of a markdown file. Everything else is prose we skip. */
export function mermaidBlocks(markdown: string): string[] {
  const found: string[] = []
  const fence = /```mermaid\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = fence.exec(markdown))) found.push(match[1].trimEnd())
  return found
}

export function callstackBlock(path: string, markdown: string | null): string {
  // A pointer at nothing is the loudest thing this view can say: the run 980 declared a
  // `desenho:` whose file had been moved by a refactor, and the section disappearing was
  // how nobody noticed. `my check citations` exists for the same reason.
  if (markdown === null) {
    return `
<section class="card bg-base-200 border border-warning/50">
  <div class="card-body p-4 gap-1">
    <h2 class="text-sm font-semibold text-warning">o desenho aponta pro vazio</h2>
    <p class="text-xs font-mono opacity-70">${escape(path)}</p>
    <p class="text-xs opacity-60">O run declara este \`desenho:\` e o arquivo não está lá.</p>
  </div>
</section>`
  }

  const blocks = mermaidBlocks(markdown)
  if (!blocks.length) return ''

  // `<pre lang="mermaid">` is exactly what GitHub emits, so the shell's boot script picks
  // these up with no second code path.
  const diagrams = blocks
    .map((code) => `<pre lang="mermaid" class="text-xs">${escape(code)}</pre>`)
    .join('\n')

  return `
<section class="card bg-base-200 border border-base-300">
  <div class="card-body p-4 gap-2">
    <header class="flex items-baseline gap-2">
      <h2 class="text-sm font-semibold opacity-70">o desenho</h2>
      <button class="link text-xs font-mono opacity-60" data-do="file" data-arg="${escape(path)}">${escape(path.split('/').pop() ?? path)}</button>
    </header>
    ${diagrams}
  </div>
</section>`
}
