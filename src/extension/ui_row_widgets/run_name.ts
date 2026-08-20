//! The name of a run: the SUBJECT, not the folder.
//!
//! `via_share_external`, not `979_via_share_external` — the number is the run's
//! position in the count-down-from-999, and the icon already says which main it is.
//! Both are one hover away.

import { slugKey, type Run } from '../disk/runs.js'

export function runName(run: Run): string {
  return slugKey(run.id)
}
