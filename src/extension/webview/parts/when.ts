//! A timestamp in the reader's own locale, or the raw string when it is not a date.

import { escape } from '../shell.js'

export function when(iso: string | undefined): string {
  if (!iso) return ''
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return escape(iso)
  return escape(new Date(at).toLocaleString())
}
