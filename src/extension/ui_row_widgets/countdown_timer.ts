//! The clock of a row: how much longer, how long already, or `draft`.
//!
//! Three styles because the experiment is which one to keep, and the answer comes
//! from looking at the sidebar rather than from arguing in a doc. Whichever wins,
//! this file is the only place the choice lives.
//!
//! `↑` counts UP (elapsed), no arrow counts DOWN (remaining). The two mean opposite
//! things, and a bare `12m` that sometimes rises and sometimes falls is worse than
//! no clock at all.

import { estimate, type Eta } from '../disk/eta.js'
import type { Run } from '../disk/runs.js'
import { DRAFT } from './draft_tag.js'
import { progressBar } from './progress_bar.js'
import { relativeAge } from './relative_age.js'

/**
 * Minutes as a timer: `11:42`, `0:38`, `1h04`.
 *
 * Seconds because the estimate is good enough to spend them: a number that only moves
 * once a minute reads as a stale label, and the same number ticking down is read as a
 * countdown without anyone explaining it. Past an hour the seconds stop meaning
 * anything, so they go. Negative is `0:00` — a minus sign in a countdown reads as a
 * bug before it reads as an overrun.
 */
export function timer(minutes: number): string {
  const total = Math.max(0, Math.round(minutes * 60))
  if (total >= 3600) {
    const hours = Math.floor(total / 3600)
    return `${hours}h${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}`
  }
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export type Style = 'cronometro' | 'progresso' | 'faixa'

export const STYLES: Style[] = ['cronometro', 'progresso', 'faixa']

/** Seeded by the run id so the same row shows the same number twice: a countdown
 *  that jitters every beat is noise pretending to be information. */
export function etaOf(run: Run): Eta {
  const elapsed = run.t0 ? (Date.now() - run.t0.at) / 60_000 : null
  const seed = [...run.id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7)
  return estimate(run.taskMinutes, elapsed, seed >>> 0 || 1)
}

/**
 * The one string beside the name, and it says WHICH clock it is.
 *
 * `0:00` alone was unreadable — reported from the screen. A bare number cannot say
 * whether it is counting down, counting up, or already blown, so the word does:
 * `falta 11:42`, `rodando há 33 min`, `estourou`, `draft`.
 */
export function countdownTimer(run: Run, style: Style): string {
  // No clock means the cycle has not started.
  if (!run.t0) return DRAFT
  // A clock but no plan: there is nothing to count down from, so count up.
  if (!run.taskMinutes.length) return `rodando ${relativeAge(run.t0.at)}`

  const eta = etaOf(run)
  // Past the estimate: a countdown pinned at zero says "broken", not "late".
  if (eta.p50 === 0) return 'estourou'

  const round = (minutes: number) => (minutes < 1 ? '<1' : String(Math.round(minutes)))

  if (style === 'faixa') return `falta ${round(eta.p50)}–${round(eta.p90)} min`
  if (style === 'progresso') return progressBar(eta, run.taskMinutes.length)
  return `falta ${timer(eta.p50)}`
}
