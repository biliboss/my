//! The disk half of the `my` tree: which run folders exist, and when each started.
//!
//! Split out of `my_view.ts` for one reason: this file imports no `vscode`, so
//! `node --test` can point it at the real house and assert against the real
//! runs. Anything that needs the extension host stays next door.
//!
//! THE FOLDER IS THE SOURCE, not `state.yaml`. Measured 2026-08-17 in ~/src/me:
//! 18 `state.yaml`, 17 of them under `02_product`, and `01_coding` writes ZERO —
//! so a tree that lists only runs holding a `state.yaml` hides the very main
//! where code is being written. A run with no receipt is listed anyway, marked;
//! being visible is what gets the file written. See run 980, F2.

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { declaredDurations, topLevel } from './eta.js'
import { doneTasks, unitsOf } from './branches.js'
import { commitsForMany } from './commits.js'
import { issuesOf } from './issues.js'
import { readPlan, type Plan } from './plan.js'
import { prsFor, type Pull } from './prs.js'

/**
 * The mains in PIPELINE order, which is NOT how their folder names sort.
 *
 * `02_product` decides what to write, `01_coding` writes it, `03_qa` approves it.
 * Sorted by name, the middle step comes first — and the first QA run of the house
 * landed at the bottom of the tree, under the product run that produced it. The
 * numbers are the folders' history; the flow is this list.
 *
 * Open list on purpose: a main nobody named here sorts after these, alphabetically,
 * instead of disappearing.
 */
export const MAIN_ORDER = ['02_product', '01_coding', '03_qa']

/** Where the mains live, relative to the house root. */
const MAINS = path.join('02_areas', '00_workflows', '00_main')

export interface Commit {
  hash: string
  /** Unix ms. */
  at: number
  subject: string
  /** The `Task:` trailer, when the commit says which task it closed. */
  task: string | null
}

export interface Unit {
  /** `S1`, `S2`… as the plan names them. */
  id: string
  /** The branch as the run DECLARED it — which is not always the one that exists. */
  branch: string | null
  /** The ref that actually resolved, or null when no candidate exists in the work repo. */
  ref: string | null
  issue: string | null
  /** What the run's own bookkeeping claims — `rodando`, `pronto`, … */
  estado: string | null
  /** Commits on this unit's branch that the base does not have. The live signal. */
  ahead: number
  /** Newest commit on the branch, or null when the branch has none / does not exist. */
  last: Commit | null
  /** Every commit ahead of the base — this is where the `[S2/T3]` marks live. */
  commits: Commit[]
}

export interface Issue {
  number: string
  /** The sprint title, when the plan carries one — the issue's own title lives on GitHub. */
  titulo: string | null
}

export interface Run {
  main: string
  /** Folder name, e.g. `980_my_no_explorer`. The run id everywhere else. */
  id: string
  dir: string
  /**
   * The house this run was scanned from. Carried rather than recomputed: the view
   * used to walk back six `..` from `dir` to find it, so moving a run one level
   * would have resolved to the wrong house with no error — the same shape of
   * accident `check/notes.ts` records for 18/08.
   */
  root: string
  /** `state.yaml` top-level fields, empty when the file is absent. */
  state: Record<string, string>
  hasState: boolean
  /** Declared task durations out of `sprints.yaml`, in minutes. */
  taskMinutes: number[]
  t0: { at: number; source: string } | null
  /** Commits that name this run, newest first. Empty when nothing names it. */
  commits: Commit[]
  /**
   * The units in flight, when the run declares them. A coding run keeps them in
   * `unidades:`; a product run has none, and its plan is the sprints instead.
   */
  units: Unit[]
  /**
   * The plan, PARSED ONCE here so nobody parses it twice.
   *
   * `sprints.yaml` used to be read from disk and parsed on both sides — `scanRuns`
   * with the line scanners, `readRunPage` with `readPlan` — and the two disagreed
   * on which issue numbers were real. One reader, one answer.
   */
  plan: Plan
  /** Where the plan came from, when it is not this run's own folder. */
  planFrom: string | null
  /** `<owner>/<repo>`, from the plan or the state — null while nothing was published. */
  repo: string | null
  /** The run label every issue of this cycle carries: `run/<NNN>_<slug>`. */
  label: string | null
  /** The issues this run opened, in plan order. */
  issues: Issue[]
  /** The PRs of this run's units, joined by head branch. */
  prs: Pull[]
  /** `S2/T3` → the commit that closed it, read from the unit branches. */
  done: Map<string, Commit>
}

/** A file, or null when it is not there. Exported: the webview reads the same way. */
export function read(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/**
 * The house root: the first candidate folder that actually holds the mains.
 *
 * Takes the folders instead of reading `vscode.workspace` so this file stays
 * host-free. Always falls back to `~/src/me`, because the extension is usually
 * open on a project folder rather than on the house — and a tree that silently
 * shows nothing is worse than one that looks where the house has always lived.
 */
export function houseRoot(folders: readonly string[] = []): string | null {
  const candidates = [...folders, path.join(os.homedir(), 'src', 'me')]
  return candidates.find((root) => fs.existsSync(path.join(root, MAINS))) ?? null
}

/**
 * `t0`, in order of how much it can be trusted:
 *
 *   1. `started_at:` in `state.yaml` — written on purpose, ISO with an hour.
 *   2. the FIRST commit on a unit branch — when the fan-out actually started.
 *   3. null — and null renders as "sem t0", never as a made-up clock.
 *
 * There used to be a middle candidate: the oldest receipt in `_events/`, whose
 * `origem.em` was already ISO. The folder died on 17/08 — 151 receipts, none of
 * them written by the agents that were supposed to — and the chain degrades on
 * its own, which is why removing it costs a comment and not a feature.
 *
 * mtime is deliberately NOT a candidate: it measures the last WRITE, so a run
 * touched twenty seconds ago would read as freshly opened. A clock that lies is
 * worse than a missing clock, because only one of the two is visible.
 */
export function resolveT0(
  root: string,
  run: { id: string; dir: string; state: Record<string, string> },
  units: Unit[] = [],
): Run['t0'] {
  const declared = run.state.started_at
  if (declared) {
    const at = Date.parse(declared)
    if (!Number.isNaN(at)) return { at, source: 'state.yaml' }
  }

  // The only other clock with an HOUR in it: the FIRST commit on a unit branch. That
  // is when the fan-out actually started working, which beats every date on disk
  // — `aberto_em: 2026-08-17` has no hour, so it cannot be a t0 at all.
  const first = units
    .map((unit) => unit.last?.at)
    .filter((at): at is number => typeof at === 'number')
    .sort((a, b) => a - b)[0]
  return first === undefined ? null : { at: first, source: 'git' }
}

function safeReaddir(dir: string): string[] {
  try {
    return fs.readdirSync(dir)
  } catch {
    return []
  }
}

/** Every run folder under every main, newest first — the house numbers DOWN from 999. */
export function scanRuns(root: string): Run[] {
  const runs: Run[] = []

  const rank = (main: string) => {
    const index = MAIN_ORDER.indexOf(main)
    return index === -1 ? MAIN_ORDER.length : index
  }

  for (const main of safeReaddir(path.join(root, MAINS)).sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b),
  )) {
    const output = path.join(root, MAINS, main, 'output')
    for (const id of safeReaddir(output).sort()) {
      if (!/^\d+_/.test(id)) continue
      const dir = path.join(output, id)
      if (!fs.statSync(dir).isDirectory()) continue

      const stateFile = read(path.join(dir, 'state.yaml'))
      const state = stateFile ? topLevel(stateFile) : {}

      // The plan is not always in this folder. A CODING run points at the product
      // run that produced it (`origem:`), and that is where `sprints.yaml` lives —
      // reading only the own folder is why the live run 979, with four agents
      // committing right now, showed up as "sem plano".
      const units = unitsOf(state, stateFile ?? '')
      let sprints = read(path.join(dir, 'sprints.yaml'))
      let planFrom: string | null = null
      if (!sprints && state.origem) {
        sprints = read(path.join(root, state.origem, 'sprints.yaml'))
        if (sprints) planFrom = state.origem
      }

      // ONE parse of the plan, for everyone: the tree, the issues, the PRs and the
      // three run views all read this same object.
      const plan = readPlan(sprints ?? '')
      const repo = repoOf(plan, state)

      runs.push({
        main,
        id,
        dir,
        root,
        state,
        hasState: stateFile !== null,
        taskMinutes: sprints ? declaredDurations(sprints) : [],
        t0: resolveT0(root, { id, dir, state }, units),
        // Preenchido DEPOIS do laço, numa varredura só — ver o `commitsForMany`
        // logo abaixo. Uma chamada por run aqui era o que custava 15,7s.
        commits: [],
        units,
        plan,
        planFrom,
        repo,
        // The POINTER first: `state.yaml` is the one file every run has, and the plan
        // file is not always called `sprints.yaml` — a communications run writes
        // `issues.yaml` with the label three levels deep. See `my references gh_issues`.
        label: state.label ?? plan.label ?? null,
        issues: issuesOf(plan, stateFile ?? ''),
        // Joined by BRANCH: nothing on disk says which PR a unit became, and the head
        // branch is the one link that exists.
        prs: prsFor(repo, units.map((unit) => unit.ref)),
        done: doneTasks(units),
      })
    }
  }

  // UMA varredura do `git log` pra todos os runs, depois do laço. Era uma chamada
  // por run — 46 runs × 2 `git log` = 92 processos sequenciais, 15,7s medidos em
  // 19/08 na thread do extension host. Agora é um processo, 0,83s.
  // Por POSIÇÃO, não por id: dois runs podem ter o mesmo id em mains diferentes
  // (`975_litoral` está em `01_coding` e em `02_product` hoje).
  const porRun = commitsForMany(root, runs)
  runs.forEach((run, i) => {
    run.commits = porRun[i] ?? []
  })

  return runs
}


/**
 * Is this run moving right now? A unit with commits its base does not have is work
 * in flight, and it is what decides the colour, the spin, the ordering and the tick
 * rate. A run with no units cannot answer yes — nothing else on disk moves.
 */
export function isMoving(run: Run): boolean {
  return run.units.some((unit) => unit.ahead > 0)
}

/** When this run was last touched: a commit, a unit, or its own `t0`. 0 when silent. */
export function activityOf(run: Run): number {
  return Math.max(run.t0?.at ?? 0, run.commits[0]?.at ?? 0, ...run.units.map((unit) => unit.last?.at ?? 0))
}

/**
 * The runs in reading order: MOVING first, then most recently touched.
 *
 * The root of the tree is a RUN — a plan, a coding cycle or a QA gate — and not a
 * subject with the three nested inside. Grouping put the answer one expand away and
 * spent a whole level on a name the rows already carry.
 */
export function ordered(runs: Run[]): Run[] {
  return [...runs].sort(
    (a, b) => Number(isMoving(b)) - Number(isMoving(a)) || activityOf(b) - activityOf(a),
  )
}

/** `999_via_share_external_sprints` → `via_share_external`. The number is position, not identity. */
export function slugKey(runId: string): string {
  return runId.replace(/^\d+_/, '').replace(/_(sprints|issues|qa|research|prs)$/, '')
}


/**
 * `<owner>/<repo>` out of the plan or the pointer.
 *
 * A yaml `repo: null` is the WORD null, and a URL built from it would point at
 * github.com/null — so anything without a slash in it is no repo at all.
 * `readPlan` already drops the literal null on the plan side; the `state.yaml`
 * side has no parser of its own, so the check stays here for it.
 */
function repoOf(plan: Plan, state: Record<string, string>): string | null {
  const clean = (value: string | undefined | null) =>
    value && value !== 'null' && value.includes('/') ? value : null
  return clean(plan.repo) ?? clean(state.repo)
}
