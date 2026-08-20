//! A UNIT of a fan-out: one branch, one issue, and whether it moved.
//!
//! The count is commits AHEAD OF THE BASE, which is the one number nobody can fake:
//! `estado: rodando` in the yaml was written once and never updated, and the branch
//! kept committing. The yaml is the intention; the branch is the truth. The row shows
//! the branch and the hover shows both.

import * as vscode from 'vscode'
import type { Unit } from '../disk/runs.js'
import { commitCount } from '../ui_row_widgets/commit_count.js'
import { compose } from '../ui_row_widgets/compose.js'
import { relativeAge } from '../ui_row_widgets/relative_age.js'
import { State } from '../ui_row_widgets/state_color.js'

export function unitRow(unit: Unit): vscode.TreeItem {
  // `staging/U1` → `U1`: the prefix is identical on every unit of the run, so it
  // spends five characters saying nothing that distinguishes the row.
  const tip = (unit.ref ?? unit.branch)?.split(/[/-]/).pop()
  const moved = unit.last ? relativeAge(unit.last.at) : undefined

  // No ref at all is a different fact from a branch with no commits: the first means
  // the yaml names something git does not have.
  const state = !unit.ref ? State.Overdue : unit.ahead ? State.Moving : State.Silent

  return compose({
    // 🌿 is a BRANCH in the work repo — the one thing in this tree that lives in
    // another checkout.
    label: tip ? `🌿 ${unit.id} · ${tip}` : `🌿 ${unit.id}`,
    parts: unit.ref ? [commitCount(unit.ahead) ?? 'nenhum commit', moved] : ['⚠️ branch não existe'],
    icon: new vscode.ThemeIcon(
      !unit.ref ? 'warning' : unit.ahead ? 'git-branch' : 'circle-outline',
      new vscode.ThemeColor(state),
    ),
    hover: [
      `**${unit.id}**${unit.branch ? ` · \`${unit.branch}\`` : ''}`,
      unit.issue ? `issue: #${unit.issue}` : undefined,
      `state.yaml diz: \`${unit.estado ?? '?'}\``,
      unit.ref && unit.branch && unit.ref !== unit.branch
        ? `⚠️ o branch declarado é \`${unit.branch}\`, o que existe é \`${unit.ref}\``
        : unit.ref
          ? undefined
          : `⚠️ nenhum ref existe para \`${unit.branch}\` no repo de trabalho`,
      unit.last ? `último commit: ${unit.last.subject}` : '_nenhum commit no branch_',
      '_unidade do lote: um branch no repo de trabalho, com uma issue própria_',
    ],
  })
}
