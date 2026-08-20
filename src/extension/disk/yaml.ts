//! The three yaml primitives this house re-invented five times: clean a scalar,
//! match a `key: value`, and swallow a folded block.
//!
//! Still NOT a YAML parser, and on purpose — `plan.ts` and `eta.ts` state the reason
//! and the ceiling: these read files we write ourselves, two levels deep. What was
//! wrong is that each reader wrote its own copy of the same three rules, and the
//! copies had drifted:
//!
//!   - The KEY charset existed in two incompatible variants. `[a-z_][a-z0-9_]*` in
//!     `eta.ts` accepts `s1_note:`; `[a-z_]+` in `plan.ts` does not — so a key with a
//!     digit was read by `topLevel`/`listOfMaps` and dropped in SILENCE by
//!     `readPlan`/`readBatch`. The permissive one wins here: the restrictive one is
//!     the one that loses data.
//!   - The folded-block machine was written twice INSIDE `plan.ts`, and the two
//!     disagreed about the one thing that has already cost a bug: `readPlan` decides
//!     on the RAW value, `readBatch` decided on the CLEANED one. Cleaning strips `>-`
//!     to nothing, so testing the cleaned string reads a folded block as an empty one
//!     — which is exactly how an `out_of_scope` reason came out blank the first time.
//!     One machine now, and it tests the raw.

/** The key charset. Permissive on purpose: `s1_note:` is a key someone wrote. */
export const KEY = '[a-z_][a-z0-9_]*'

const KEY_VALUE = new RegExp(`^(${KEY}):\\s*(.*)$`, 'i')
const ITEM_KEY_VALUE = new RegExp(`^-\\s+(${KEY}):\\s*(.*)$`, 'i')

/** A `key: value` on an already-trimmed line, or null. Indentation is the caller's. */
export function keyValue(text: string): { key: string; raw: string } | null {
  const match = KEY_VALUE.exec(text)
  return match ? { key: match[1], raw: match[2] } : null
}

/** `- key: value`, the line that OPENS a list item. */
export function itemKeyValue(text: string): { key: string; raw: string } | null {
  const match = ITEM_KEY_VALUE.exec(text)
  return match ? { key: match[1], raw: match[2] } : null
}

/**
 * A scalar as written: trailing `# comment` off, trimmed, quotes off.
 *
 * Does NOT touch a `>-` marker — that is a folded BLOCK, not a value, and whether
 * a line opens one has to be decided on the raw text. See `isFolded`.
 */
export function cleanScalar(raw: string): string {
  return raw
    .replace(/\s+#.*$/, '')
    .trim()
    .replace(/^["']|["']$/g, '')
}

/**
 * Does this value open a folded block (`>-`, `|`, or nothing at all)?
 *
 * Takes the RAW value, never the cleaned one. `cleanScalar('>-')` is the empty
 * string, so a cleaned test cannot tell "folded" from "empty" — and it read one as
 * the other in production.
 */
export function isFolded(raw: string): boolean {
  const text = raw.trim()
  return !text || text.startsWith('>') || text.startsWith('|')
}

/** How deep a line sits, in spaces. The shape of a yaml IS its indentation. */
export function depth(line: string): number {
  return line.length - line.trimStart().length
}

/**
 * The folded-block machine: lines indented deeper than the key belong to the value.
 *
 * Used as a single mutable slot because that is how both readers already worked — a
 * line scanner has one block open at a time. `open()` starts one, `feed()` returns
 * true when it swallowed the line, and `flush()` closes whatever is open. Closing is
 * idempotent, which is what lets the callers flush on every line AND at the end
 * without special-casing either.
 */
export class Folding {
  private current: { set: (text: string) => void; indent: number; parts: string[] } | null = null

  open(indent: number, set: (text: string) => void): void {
    this.flush()
    this.current = { set, indent, parts: [] }
  }

  /** True when the line belonged to the open block and was consumed. */
  feed(rawLine: string): boolean {
    if (!this.current || depth(rawLine) <= this.current.indent) return false
    this.current.parts.push(rawLine.trim())
    return true
  }

  flush(): void {
    if (!this.current) return
    const { set, parts } = this.current
    this.current = null
    set(parts.join(' ').trim())
  }
}
