//! `3 commits` — the word, not `3c`.
//!
//! And commits, never "tasks": no commit says which task it closed, so calling them
//! tasks would be a guess printed as a fact.

export function commitCount(count: number): string | undefined {
  if (!count) return undefined
  return `${count} commit${count === 1 ? '' : 's'}`
}
