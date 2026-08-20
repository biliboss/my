//! The state of a thing, as a pill: OPEN, MERGED, CLOSED, DRAFT.
//!
//! GitHub's semantics, because this pane is read next to github.com: green is open,
//! purple is merged, red is closed, grey is draft. Anything else keeps the neutral pill
//! rather than guessing — #enum_aberto.

import { escape } from '../shell.js'

const LOOK: Record<string, { badge: string; glyph: string }> = {
  OPEN: { badge: 'badge-success', glyph: '●' },
  MERGED: { badge: 'badge-secondary', glyph: '⑃' },
  CLOSED: { badge: 'badge-error', glyph: '✕' },
  DRAFT: { badge: 'badge-neutral', glyph: '◐' },
}

export function statePill(state: string): string {
  const key = state.toUpperCase()
  const look = LOOK[key] ?? { badge: 'badge-neutral', glyph: '·' }
  return `<span class="badge ${look.badge} gap-1 text-xs font-semibold">${look.glyph} ${escape(key)}</span>`
}
