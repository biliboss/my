//! A PULL REQUEST of the run: the unit's work, as GitHub sees it.
//!
//! It sits beside the issues rather than under the unit because this is the row QA opens:
//! "what is ready to look at" is a question about the run, not about one branch.

import * as vscode from 'vscode'
import type { Pull } from '../disk/prs.js'
import { checkStatus, reviewStatus } from '../ui_row_widgets/check_status.js'
import { compose } from '../ui_row_widgets/compose.js'
import { State } from '../ui_row_widgets/state_color.js'

export function prRow(repo: string, pull: Pull): vscode.TreeItem {
  // Red only for a real failure: a PR waiting for review is not a problem, it is the
  // normal state of a PR, and colouring it would make the tree cry wolf.
  const colour = pull.checks.failed
    ? State.Overdue
    : pull.checks.pending
      ? State.Moving
      : pull.review === 'APPROVED'
        ? State.Waiting
        : State.Silent

  return compose({
    label: `🔀 #${pull.number}`,
    parts: [checkStatus(pull), reviewStatus(pull)],
    icon: new vscode.ThemeIcon('git-pull-request', new vscode.ThemeColor(colour)),
    hover: [
      `**PR #${pull.number}** · \`${repo}\``,
      `branch: \`${pull.ref}\``,
      `checks: ${pull.checks.ok} ok · ${pull.checks.failed} falha · ${pull.checks.pending} rodando`,
      `review: ${pull.review || 'ninguém olhou ainda'}`,
      '_clique abre o PR numa aba do editor_',
    ],
    command: { command: 'my.openPr', title: 'Abrir o PR', arguments: [repo, pull.number] },
  })
}
