//! A GitHub label, in the colour GitHub gave it.
//!
//! The only literal colour allowed in these views: a label recoloured by the editor's
//! theme is a label that lost its meaning. The INK is computed from luminance, because
//! half the labels in this house are pastel and white on pastel is unreadable.

import { escape } from '../shell.js'

export function labelChip(name: string, hex: string): string {
  const clean = /^[0-9a-f]{6}$/i.test(hex) ? hex : '888888'
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(clean.slice(at, at + 2), 16))
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const ink = luminance > 0.6 ? '#1b1f23' : '#ffffff'
  return `<span class="badge border-0 text-xs font-medium" style="background:#${clean};color:${ink}">${escape(name)}</span>`
}
