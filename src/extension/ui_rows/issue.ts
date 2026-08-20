//! An issue AS THE PLAN DECLARES IT — a number written back into the yaml.
//!
//! This row is the file's side of the handoff: the plan says `issue: 284`, so the
//! number and the sprint title are all it knows. What GitHub thinks of it — state,
//! labels, comments — arrives only when the pane opens (`gh/pane.ts`), and that is
//! why this row and a fetched GitHub issue are two different things.

import * as vscode from 'vscode'
import { issueUrl } from '../disk/issues.js'
import type { Issue, Run } from '../disk/runs.js'
import { openIssueCommand } from '../gh/pane.js'
import { compose } from '../ui_row_widgets/compose.js'

export function issueRow(run: Run, issue: Issue): vscode.TreeItem {
  const url = issueUrl(run, issue)

  return compose({
    // `#178` first, because the number is what a human says out loud, and the `#` plus
    // the GitHub mark is the pair nobody misreads as a commit.
    label: `🐙 #${issue.number}`,
    parts: [issue.titulo ?? undefined],
    // `github` and not `issues`: the row leads OUT of the house, and the mark that
    // says so in one glyph is the one everybody already reads.
    icon: new vscode.ThemeIcon('github', new vscode.ThemeColor('charts.purple')),
    hover: [
      url
        ? `**issue do GitHub** · [#${issue.number} em ${run.repo}](${url})`
        : '_o plano não diz em qual repo isto foi publicado_',
      '_clique abre a issue numa aba do editor_',
    ],
    // A pane in the EDITOR, not a browser tab. The browser is one click away inside it,
    // for when the answer is a button.
    command: openIssueCommand(run, issue),
  })
}
