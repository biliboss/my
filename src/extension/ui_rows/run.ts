//! THE ROOT ROW: a run — a plan, a coding cycle, or a QA gate.
//!
//! The row is the NAME and ONE clock, and that is the whole design: `batchSettled
//! 3/4u 6c` beside a name made every row a sentence to parse, and a sidebar is read
//! sideways. Step, units, commits, the plan and the p90 are all one hover away, and
//! the children already show them as rows.

import * as vscode from 'vscode'
import { labelUrl } from '../disk/issues.js'
import { isMoving, type Run } from '../disk/runs.js'
import { compose } from '../ui_row_widgets/compose.js'
import { countdownTimer, etaOf, type Style } from '../ui_row_widgets/countdown_timer.js'
import { commitCount } from '../ui_row_widgets/commit_count.js'
import { relativeAge } from '../ui_row_widgets/relative_age.js'
import { mainEmoji, rowTypeIcon, MAIN_TAG } from '../ui_row_widgets/row_type_icon.js'
import { runName } from '../ui_row_widgets/run_name.js'
import { State } from '../ui_row_widgets/state_color.js'
import { stepName } from '../ui_row_widgets/step_name.js'
import { taskCount } from '../ui_row_widgets/task_count.js'
import { unitCount } from '../ui_row_widgets/unit_count.js'

/**
 * The four states, in the order they win.
 *
 * Moving beats everything — it is why anyone opened the sidebar. Overdue comes next,
 * because it is the only state that should nag. A draft is grey: it has no clock, so
 * nothing about it is under way, and green beside `draft` would read as "fine,
 * running".
 */
export function runState(run: Run): State {
  if (isMoving(run)) return State.Moving
  if (run.taskMinutes.length && etaOf(run).p50 === 0) return State.Overdue
  if (!run.t0) return State.Silent
  return State.Waiting
}

/** Everything the row deliberately does not say. */
function hover(run: Run, style: Style): (string | undefined)[] {
  const eta = run.taskMinutes.length ? etaOf(run) : undefined
  const moving = run.units.filter((unit) => unit.ahead > 0).length
  const commits = run.units.reduce((sum, unit) => sum + unit.ahead, 0)

  return [
    `**${run.id}** · ${MAIN_TAG[run.main] ?? run.main} · \`${stepName(run.state.at)}\``,
    run.state.subject,
    run.units.length ? `unidades: ${unitCount(moving, run.units.length)} · ${commits}c à frente da base` : undefined,
    run.done.size ? `tasks fechadas: ${[...run.done.keys()].sort().join(' · ')}` : undefined,
    eta ? `plano: ${run.taskMinutes.length} tasks · ${Math.round(eta.declared)} min declarados` : undefined,
    // "falta" only means something when there is a clock to subtract: with no `t0`
    // the same numbers are the WHOLE plan, and calling them "falta" would be the
    // hover asserting a countdown it does not have.
    eta
      ? run.t0
        ? `falta: p50 ${Math.round(eta.p50)} min · **p90 ${Math.round(eta.p90)} min**`
        : `plano inteiro: p50 ${Math.round(eta.p50)} min · **p90 ${Math.round(eta.p90)} min**`
      : undefined,
    run.t0
      ? `t0: \`${new Date(run.t0.at).toISOString()}\` (${run.t0.source})`
      : '_sem t0 — nada a descontar, então nada de cronômetro_',
    run.planFrom ? `plano herdado de \`${run.planFrom}\`` : undefined,
    run.prs.length ? `PRs: ${run.prs.map((pull) => `#${pull.number}`).join(' · ')}` : undefined,
    run.commits.length
      ? `git: ${commitCount(run.commits.length)} · último ${relativeAge(run.commits[0].at)} atrás`
      : '_nenhum commit nomeia este run_',
    run.hasState ? undefined : '_sem `state.yaml`: este ciclo não deixou recibo_',
    labelUrl(run) ? `[as ${run.issues.length} issues deste run](${labelUrl(run)})` : undefined,
  ]
}

export function runRow(run: Run, style: Style, sandbox: boolean): vscode.TreeItem {
  return compose({
    label: `${mainEmoji(run.main)} ${runName(run)}`,
    // The clock, then the tasks — and the task count only exists when a commit said which
    // task it closed. The row he asked for: `979_via_share_external  3 de 9 tasks`.
    parts: [countdownTimer(run, style), taskCount(run.done.size, run.taskMinutes.length)],
    icon: rowTypeIcon(run.main, runState(run)),
    hover: hover(run, style),
    id: `${run.main}/${run.id}`,
    // `contextValue` is what puts the inline "abrir as issues" button on the row.
    context: labelUrl(run) ? 'run.published' : 'run',
    // A sandbox run has no folder on disk, so it gets no resource: a row that offers
    // a path to nothing is worse than a row that offers none.
    resource: sandbox ? undefined : vscode.Uri.file(run.dir),
    command: { command: 'my.openRun', title: 'Abrir o run', arguments: [run.dir] },
    children: Boolean(run.units.length || run.prs.length || run.issues.length || run.commits.length),
    expanded: isMoving(run),
  })
}
