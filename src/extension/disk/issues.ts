//! The issues a run opened, and the two URLs that lead to them.

import { listOfMaps } from './eta.js'
import { publishedIssue, type Plan } from './plan.js'
import type { Issue, Run } from './runs.js'

/**
 * The issues a run opened: number plus the sprint title that produced it.
 *
 * Read from `sprints.yaml` first, because that is where publishing writes the
 * number back (`issue:` per sprint, six of them on run 999). A coding run keeps
 * the same numbers under `unidades:`, so that is the fallback — same issues,
 * reached from the other side of the handoff.
 *
 * A number with a leading zero is NOT a GitHub number: two runs keep draft ids
 * (`issue: "01"`) under `agentes:` for issues that were never published, and
 * rendering those as links would send someone to issue #1 of the wrong repo.
 * That guard now lives in `publishedIssue` — `readPlan` applies it while parsing,
 * so the plan side arrives already filtered and this function only has to keep
 * the STATE side honest.
 *
 * Takes the plan already PARSED: `scanRuns` reads `sprints.yaml` once and every
 * consumer shares that result. Re-reading it here with `listOfMaps` was the third
 * parser over the same file — and the one that disagreed.
 */
export function issuesOf(plan: Plan, stateYaml: string): Issue[] {
  const fromPlan = plan.sprints
    .filter((sprint) => publishedIssue(sprint.issue))
    .map((sprint) => ({ number: sprint.issue as string, titulo: sprint.titulo }))
  if (fromPlan.length) return fromPlan

  return [...listOfMaps(stateYaml, 'unidades'), ...listOfMaps(stateYaml, 'agentes')]
    .filter((unit) => publishedIssue(unit.issue))
    .map((unit) => ({ number: unit.issue, titulo: unit.slug ?? unit.id ?? null }))
}

/** The GitHub search that shows exactly this run's issues — the label IS the run. */
export function labelUrl(run: Run): string | null {
  if (!run.repo || !run.label) return null
  return `https://github.com/${run.repo}/issues?q=${encodeURIComponent(`label:"${run.label}"`)}`
}

/** One issue, in the repo the plan named. */
export function issueUrl(run: Run, issue: Issue): string | null {
  return run.repo ? `https://github.com/${run.repo}/issues/${issue.number}` : null
}
