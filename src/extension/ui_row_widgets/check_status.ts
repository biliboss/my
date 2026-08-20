//! What CI says about a PR, in one short phrase.
//!
//! Three numbers arrive (ok / failed / pending) and only one of them decides the phrase:
//! a failure is the answer even when nine other jobs passed, and pending beats a green
//! tick because a run still going has not answered yet.
//!
//! Skipped jobs are counted nowhere — see `disk/prs.ts`. The live run had FIVE skipped
//! per PR, and calling them failures would paint the house red.

import type { Pull } from '../disk/prs.js'

export function checkStatus(pull: Pull): string {
  if (pull.checks.failed) return `✗ ${pull.checks.failed} falhou`
  if (pull.checks.pending) return '… rodando'
  if (pull.checks.ok) return '✓ checks'
  return 'sem checks'
}

/** What the review says, in the words a human uses about it. */
export function reviewStatus(pull: Pull): string | undefined {
  if (pull.draft) return 'rascunho'
  if (pull.state === 'MERGED') return 'mergeado'
  if (pull.state === 'CLOSED') return 'fechado'
  if (pull.review === 'APPROVED') return 'aprovado'
  if (pull.review === 'CHANGES_REQUESTED') return 'pediu mudança'
  // No decision recorded is the most common state and the one worth naming: it is what
  // "the PR is open and nobody looked" looks like on GitHub.
  return 'aguarda review'
}
