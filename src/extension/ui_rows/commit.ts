//! A COMMIT that names the run: the evidence beside the promise.
//!
//! The row has to ANNOUNCE what it is. Reported from the screen: a diamond glyph and a
//! conventional-commit subject beside `#178` rows read as the same kind of thing. So
//! the short hash comes back into the row — a hash looks like a hash, and nothing else
//! in the tree looks like one — and the icon goes grey while an issue stays purple:
//! history is grey, a promise is coloured.

import * as vscode from 'vscode'
import type { Commit } from '../disk/runs.js'
import { compose } from '../ui_row_widgets/compose.js'
import { relativeAge } from '../ui_row_widgets/relative_age.js'

export function commitRow(commit: Commit): vscode.TreeItem {
  return compose({
    label: `⏺ ${commit.subject}`,
    parts: [commit.hash, relativeAge(commit.at)],
    icon: new vscode.ThemeIcon('git-commit', new vscode.ThemeColor('disabledForeground')),
    hover: [
      `\`${commit.hash}\` · ${new Date(commit.at).toLocaleString()}`,
      commit.subject,
      commit.task ? `task: \`${commit.task}\`` : '_sem trailer `Task:` — o commit não diz QUAL task_',
      '_commit deste repo (o registro), não issue do GitHub_',
    ],
  })
}
