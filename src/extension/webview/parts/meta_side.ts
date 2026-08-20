//! The right-hand column: the facts nobody reads in prose.
//!
//! On a wide screen it sits beside the body; below `lg` it stacks under it. That is the
//! whole reason the views are full width — a developer tool on a 27" screen with 48rem of
//! centred text wastes the two thirds where the detail belongs.

export interface MetaEntry {
  label: string
  /** Already-escaped HTML, because half of these are chips and links. */
  value: string
}

export function metaSide(entries: MetaEntry[]): string {
  const rows = entries
    .filter((entry) => entry.value)
    .map(
      (entry) => `
    <div class="flex flex-col gap-1 border-b border-base-300 pb-3 last:border-0">
      <span class="text-xs uppercase tracking-wide opacity-50">${entry.label}</span>
      <div class="text-sm flex flex-wrap gap-1 items-center">${entry.value}</div>
    </div>`,
    )
    .join('')

  return `<aside class="flex flex-col gap-3 lg:w-72 lg:shrink-0">${rows}</aside>`
}
