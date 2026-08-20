//! The step, short enough to leave room for the numbers.
//!
//! `generate-sprints` and `coding:BatchSettled` are written for a contract, not for a
//! 30-character column — and the column is where they are read most.

export function stepName(at: string | undefined): string {
  if (!at) return '?'
  // `coding:BatchSettled` → `batchSettled`: the component is already the main.
  const event = /:([A-Za-z]+)$/.exec(at)
  if (event) return event[1].replace(/^[A-Z]/, (first) => first.toLowerCase())
  return at.replace(/^generate-/, 'gen-')
}
