//! The four states worth a colour, and the colour of each.
//!
//! Theme ids, never literals: a hardcoded green is invisible in half the themes
//! people use, and this is the thing read sideways.

export const enum State {
  /** Work in flight: a unit has commits its base does not. */
  Moving = 'charts.blue',
  /** Started, inside its estimate. */
  Waiting = 'charts.green',
  /** Past its own estimate — the only state that should nag. */
  Overdue = 'charts.orange',
  /** No clock, or nothing on disk at all. Not an error: a finding. */
  Silent = 'disabledForeground',
}
