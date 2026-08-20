//! The pull requests of a run, found by BRANCH.
//!
//! Nothing on disk says "unit S1 became PR #291": the plan writes an issue number and
//! stops there. What ties them is the head branch — measured 17/08 on the live run:
//! #290→`staging-U2`, #291→`staging-U1`, #292→`staging-U3`, #293→`staging-U4`. So the
//! join key is the ref a unit already resolved to, and a PR that matches no unit is not
//! this run's business.
//!
//! ONE `gh pr list` per repo, memoised for a minute. The tree re-reads the disk every
//! ten seconds while work is in flight, and a network call at that rate would be a rate
//! limit and a stutter — a PR's review state does not change ten times a minute.

import { log } from '../log.js'
import { ghSync } from '../gh/run.js'

export interface Pull {
  number: string
  /** The head branch, which is the only thing that links a PR to a unit. */
  ref: string
  state: string
  draft: boolean
  /** What the review says: `APPROVED`, `CHANGES_REQUESTED`, or empty when nobody looked. */
  review: string
  checks: { ok: number; failed: number; pending: number }
  url: string
}

interface RawCheck {
  conclusion?: string
  state?: string
}

interface RawPull {
  number?: number
  headRefName?: string
  state?: string
  isDraft?: boolean
  reviewDecision?: string
  url?: string
  statusCheckRollup?: RawCheck[]
}

/**
 * The rollup as three numbers.
 *
 * `SKIPPED` and `CANCELLED` are counted as NEITHER: a skipped job is a job that had
 * nothing to do, and calling it a failure would paint half the house red — the live run
 * has five skipped checks per PR. `NEUTRAL` joins them for the same reason.
 */
export function summarise(checks: RawCheck[] = []): Pull['checks'] {
  const tally = { ok: 0, failed: 0, pending: 0 }
  for (const check of checks) {
    const verdict = (check.conclusion || check.state || '').toUpperCase()
    if (verdict === 'SUCCESS') tally.ok += 1
    else if (verdict === 'FAILURE' || verdict === 'TIMED_OUT' || verdict === 'ACTION_REQUIRED') tally.failed += 1
    else if (verdict === 'PENDING' || verdict === 'IN_PROGRESS' || verdict === 'QUEUED') tally.pending += 1
  }
  return tally
}

export function toPull(raw: RawPull): Pull | null {
  if (!raw.number || !raw.headRefName) return null
  return {
    number: String(raw.number),
    ref: raw.headRefName,
    state: (raw.state ?? 'OPEN').toUpperCase(),
    draft: Boolean(raw.isDraft),
    review: raw.reviewDecision ?? '',
    checks: summarise(raw.statusCheckRollup),
    url: raw.url ?? '',
  }
}

const MEMO_MS = 60_000
const memo = new Map<string, { at: number; pulls: Pull[] }>()

/** Every open PR of a repo, memoised. `[]` when `gh` is not there or not logged in. */
function pullsOf(repo: string): Pull[] {
  const cached = memo.get(repo)
  if (cached && Date.now() - cached.at < MEMO_MS) return cached.pulls

  let pulls: Pull[] = []
  // Through the runner (`gh/run.ts`), which owns the timeout and the 5xx retry. This
  // site had NEITHER: a hung `gh` froze the tree with no ceiling, and the 503 measured
  // on 17/08 reached it unprotected while the twin call in `src/gh/prs.ts` retried.
  const out = ghSync([
    'pr',
    'list',
    '--repo',
    repo,
    '--limit',
    '50',
    '--json',
    'number,headRefName,state,isDraft,reviewDecision,url,statusCheckRollup',
  ])

  if (!out.ok) {
    // No network, no `gh`, no access: no PRs is a fine answer, and a sidebar must never
    // throw because GitHub is unreachable.
    //
    // But it must SAY SO. An expired `gh auth` blanks the PR line of every run in the
    // tree at once, and the silent version of this catch made that indistinguishable
    // from a repo where nobody opened a PR. `warn` and not `error`: the sidebar still
    // renders, and the house already tells the user `gh auth status` when a PANE fails
    // for the same reason (`gh/pane.ts`).
    log().warn(`gh pr list ${repo}: ${out.error} — the tree draws with no PRs`)
  } else {
    try {
      pulls = (JSON.parse(out.stdout) as RawPull[]).map(toPull).filter((pull): pull is Pull => pull !== null)
    } catch {
      // Exit 0 with a body that is not JSON: rare, and it used to throw a SyntaxError
      // that named neither `gh` nor this repo.
      log().warn(`gh pr list ${repo}: printed no JSON — the tree draws with no PRs`)
    }
  }

  memo.set(repo, { at: Date.now(), pulls })
  return pulls
}

/** The PRs whose head branch is one of these refs — the run's own, and nobody else's. */
export function prsFor(repo: string | null, refs: (string | null)[]): Pull[] {
  if (!repo) return []
  // `origin/staging-U1` and `staging-U1` are the same branch to GitHub, which only knows
  // the short name.
  const wanted = new Set(refs.filter(Boolean).map((ref) => (ref as string).replace(/^origin\//, '')))
  if (!wanted.size) return []
  return pullsOf(repo).filter((pull) => wanted.has(pull.ref))
}
