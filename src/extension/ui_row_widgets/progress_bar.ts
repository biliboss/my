//! `▓▓▓░░ 7/12` — position instead of time.
//!
//! The position is INFERRED from elapsed-vs-declared, because nothing on disk marks
//! a task done. Upgrade path when it matters: the checkbox state of the published
//! issue, or `actual_duration` written back into the plan.

import type { Eta } from '../disk/eta.js'

const SLOTS = 5

export function progressBar(eta: Eta, taskCount: number): string {
  const fraction = eta.elapsed !== null && eta.declared ? Math.min(1, eta.elapsed / eta.declared) : 0
  const filled = Math.round(fraction * SLOTS)
  const done = Math.min(taskCount, Math.round(fraction * taskCount))
  return `${'▓'.repeat(filled)}${'░'.repeat(SLOTS - filled)} ${done}/${taskCount}`
}
