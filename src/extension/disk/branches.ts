//! The units of a coding run, and the branch each one ACTUALLY has.
//!
//! This is the only file that reaches into ANOTHER checkout: the work repo named by
//! `work_repo:`. The registry keeps the plan; the code lives somewhere else.

import { execFileSync } from 'node:child_process'
import * as os from 'node:os'
import * as path from 'node:path'
import { listOfMaps } from './eta.js'
import { gitCommits, taskMark } from './commits.js'
import type { Commit, Unit } from './runs.js'

/** `~/src/acme-mono` as written in `work_repo:` — the tilde is the house's own shorthand. */
function expandHome(target: string): string {
  return target.startsWith('~') ? path.join(os.homedir(), target.slice(1)) : target
}

/**
 * The units of a run, with the ONE number that says whether work is happening:
 * commits the unit's branch has that the base does not.
 *
 * This is the closest thing to per-task progress the disk can honestly give.
 * MEASURED 2026-08-17 on the live run 979: four branches, `staging/U2` committed
 * 45 seconds ago, and `estado: rodando` in `state.yaml` had been written once
 * and never updated since. The branch is the truth; the yaml is the intention.
 *
 * Still not per TASK: a commit does not say which task it closed. `Task:` in the
 * trailer would close that gap, and nothing writes it yet — so `ahead` counts
 * commits, and the row says "commits", never "tasks".
 */
export function unitsOf(state: Record<string, string>, stateYaml: string): Unit[] {
  const declared = listOfMaps(stateYaml, 'unidades')
  if (!declared.length) return []

  const repo = state.work_repo ? expandHome(state.work_repo) : null
  const base = state.base ?? 'main'

  return declared.map((unit) => {
    const branch = unit.branch ?? null
    const ref = repo && branch ? resolveRef(repo, branch) : null
    let ahead = 0
    let last: Commit | null = null
    let done: Commit[] = []

    if (repo && ref) {
      // `origin/<base>` first: a work repo driven by agents often has no LOCAL
      // base branch at all — measured, `staging` exists only as `origin/staging`
      // in ~/src/acme-mono, which is also why `staging/U1` was impossible as a
      // branch name and why the agents fell back to `staging-U1`.
      for (const reference of [`origin/${base}`, base]) {
        const commits = commitsRange(repo, `${reference}..${ref}`)
        if (commits.length) {
          ahead = commits.length
          last = commits[0]
          done = commits
          break
        }
      }
      if (!last) last = commitsRange(repo, ref, 1)[0] ?? null
    }

    return { id: unit.id ?? '?', branch, ref, issue: unit.issue ?? null, estado: unit.estado ?? null, ahead, last, commits: done }
  })
}

/** `git log <range>` in another checkout — the work repo, which is never this one.
 *
 *  The 50 is this caller's own, and higher than the sidebar's 20 on purpose: a
 *  branch ahead of base can carry more than twenty, and `ahead` is a COUNT — a low
 *  cap would silently under-report how much work happened. */
// `function`, not a `const` arrow: this sits BELOW its callers, and a const in
// the temporal dead zone would throw at runtime while type-checking clean.
function commitsRange(repo: string, range: string, limit = 50): Commit[] {
  return gitCommits(repo, [range], limit)
}

/**
 * The ref that exists, out of the ones a declared branch name could mean.
 *
 * MEASURED 2026-08-17, mid-run: `state.yaml` declares `staging/U1`, and the repo
 * holds `staging-U1`. The slash form is IMPOSSIBLE while a ref named `staging`
 * exists — git stores refs as paths, so `staging` cannot be both a file and a
 * directory — so whoever created the branches fell back to the hyphen, and the
 * yaml was never corrected. Only U2 kept the slash.
 *
 * Trusting the declared name alone reports "no commits" for three units that are
 * committing every few minutes. So: the declared name, its hyphen/slash twin,
 * and both under `origin/`. Null means no candidate exists, and the row says that
 * instead of showing a zero that reads as "nothing happened".
 */
export function resolveRef(repo: string, declared: string): string | null {
  const twin = declared.includes('/') ? declared.replace(/\//g, '-') : declared.replace(/-/g, '/')
  for (const candidate of [declared, twin, `origin/${declared}`, `origin/${twin}`]) {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`], {
        cwd: repo,
        stdio: 'ignore',
      })
      return candidate
    } catch {
      // Next candidate.
    }
  }
  return null
}

/**
 * The tasks a run has CLOSED, by id, out of the commits its units carry.
 *
 * `3 commits` answers how much moved; `3 de 9 tasks` answers how much is LEFT, which is the
 * question the plan already knows the denominator of. Nothing new is written to disk for
 * this: the mark was already in every subject the fan-out produced.
 */
export function doneTasks(units: Unit[]): Map<string, Commit> {
  const done = new Map<string, Commit>()
  for (const unit of units) {
    for (const commit of unit.commits) {
      const id = commit.task ? commit.task.replace(/^\[|\]$/g, '') : taskMark(commit.subject)
      // Newest wins: a task committed twice (a fix on top) shows the latest hash.
      if (id && !done.has(id)) done.set(id, commit)
    }
  }
  return done
}
