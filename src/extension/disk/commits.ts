//! The commits of a run, read in the REGISTRY's own checkout (`~/src/me`).
//!
//! Owns `gitCommits` — the one place that knows the `git log` format string.

import { execFileSync } from 'node:child_process'
import * as path from 'node:path'
import { log, whyFailed } from '../log.js'
import type { Commit } from './runs.js'

/**
 * `git log` as a `Commit[]`, in the order git returned them.
 *
 * The format string is the whole reason this function exists. It was written
 * character for character in two files, and it is a CONTRACT between them: both
 * build the same `Commit` interface, so adding a field to one copy and not the
 * other yields a half-populated object that the type checker cannot see —
 * `commitsFor` would hand back `undefined` where `commitsRange` had a value.
 *
 * `%x1f` between fields and `%x1e` between records, because a subject may hold
 * anything a human types — a newline-delimited log cannot be split back apart.
 *
 * NO SORTING AND NO DEDUP HERE, deliberately: `commitsRange` reads `[0]` as "the
 * newest commit on this branch" and depends on git's own ordering, while
 * `commitsFor` unions two logs and therefore has to dedup by hash itself. Sorting
 * inside this function would be invisible to one caller and wrong for the other.
 *
 * A failure is an empty list, never a throw: not a checkout, no git on PATH, a
 * path outside the repo — a sidebar must not blow up over any of them.
 */
export function gitCommits(cwd: string, revisions: string[], limit = 20): Commit[] {
  const FORMAT = '--format=%h%x1f%ct%x1f%s%x1f%(trailers:key=Task,valueonly)%x1e'
  let out: string
  try {
    const args = ['log', `-n${limit}`, '--no-merges', FORMAT, ...revisions]
    // stderr PIPED so the catch below has something to say: `git` discards the
    // difference between "not a checkout", "bad revision" and "no git" once it is
    // thrown away, and all three used to render as "this run has no commit".
    out = execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (failure) {
    log().warn(`git log ${revisions.join(' ')} in ${cwd}: ${whyFailed(failure)} — the run draws with no commits`)
    return []
  }
  return out
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, seconds, subject, task] = record.split('\x1f')
      return { hash, at: Number(seconds) * 1000, subject: subject ?? '', task: task?.trim() ? task.trim() : null }
    })
}


/**
 * `[S2/T3]` no fim do assunto — a marca que diz QUAL task o commit fechou.
 *
 * MEASURED 17/08 in `~/src/acme-mono`: 13 commits of the live fan-out carry it, 10 distinct
 * ids across S1..S4. It sits in the SUBJECT and not in a trailer, which is why reading only
 * `Task:` found nothing and the tree kept saying "3 commits" while the plan knew about nine
 * tasks. Both are read now: the trailer wins when present, because it is the explicit form.
 */
export function taskMark(subject: string): string | null {
  const found = /\[(S\d+)\s*\/\s*(T\d+)\]\s*$/i.exec(subject.trim())
  return found ? `${found[1].toUpperCase()}/${found[2].toUpperCase()}` : null
}

/**
 * The commits of a run: the ones that NAME it, plus the ones that TOUCHED its
 * folder. Newest first, deduplicated by hash.
 *
 * MEASURED 2026-08-17, and the measurement killed the first design: of 601
 * commits since 01/08, exactly ONE spells a full run id, so matching the
 * conventional-commit scope (`docs(980):`) looked like the way in. It is not —
 * the run NUMBER repeats across mains (`01_coding/980_cockpit_design_prs` and
 * `02_product/980_my_no_explorer` both exist), so scope matching hands every
 * `(980)` commit to both runs and quietly credits work to the wrong cycle.
 *
 * The folder path cannot be ambiguous, and the full slug cannot either. So the
 * union of those two is the whole rule, and a commit that names no run and
 * touches no run folder belongs to no run — which is the truth.
 *
 * TASK level is still NOT derivable: no commit names a task. The `Task:` trailer
 * is read when present and left null otherwise — inferring which task a commit
 * closed from the files it touched would be a guess printed as a fact.
 *
 * ponytail: two `git log` per run, capped at 20 each, on a tick that only fires
 * while the view is visible. If it ever shows in a profile, the upgrade is one
 * `git log --name-only` over the range, bucketed in memory — not a cache.
 */
export function commitsFor(root: string, runId: string, runDir?: string, limit = 20): Commit[] {
  // Dedup by hash: the two logs OVERLAP — a commit that names the run and also
  // touches its folder comes back from both, and it is one commit.
  const byHash = new Map<string, Commit>()
  for (const commit of gitCommits(root, [`--grep=${runId}`], limit)) byHash.set(commit.hash, commit)
  if (runDir) for (const commit of gitCommits(root, ['--', runDir], limit)) byHash.set(commit.hash, commit)

  return [...byHash.values()].sort((a, b) => b.at - a.at)
}

/** One commit as the batch reads it: the `Commit` fields, plus what `commitsFor`
 *  used to ask git twice for — the whole message, and the files touched. */
type Scanned = Commit & { message: string; files: string[] }

/**
 * EVERY commit of the checkout, in ONE `git log`, with the files each one touched.
 *
 * This is the upgrade the `commitsFor` note above predicted, and the profile
 * finally demanded it: `scanRuns` called `commitsFor` once per run, and each call
 * spawned two `git log` — 46 runs became 92 sequential processes and **15,7 s**
 * measured on 19/08, on the extension host thread. Four tests were timing out at
 * 5 s because they were measuring exactly that.
 *
 * One process over the whole history costs **0,83 s**, and it does NOT truncate:
 * the per-run form searched all of history for its 20 matches, so a window here
 * would have quietly dropped old commits. Whole history keeps the semantics.
 *
 * The record starts with `%x1e` instead of ending with it, so splitting yields one
 * clean chunk per commit; the trailing `%x1f` closes the body, because a body is
 * multi-line and the file list has to begin somewhere unambiguous.
 *
 * `%b` is read and not just `%s`: the old form used `--grep`, which matches the
 * WHOLE message, so a run named only in the body still counts.
 *
 * ponytail: `maxBuffer` at 256 MB, and it is not decoration — Node defaults to
 * 1 MB and this output is already 1,5 MB at 971 commits, so the default would
 * throw and every run would silently draw with no commits. Ceiling: it all lands
 * in memory at once. If the history ever outgrows that, the upgrade is `--since`
 * bounded by the oldest run folder, not a smaller buffer.
 */
export function scanCommits(cwd: string): Scanned[] {
  const FORMAT = '--format=%x1e%h%x1f%ct%x1f%s%x1f%(trailers:key=Task,valueonly)%x1f%b%x1f'
  let out: string
  try {
    out = execFileSync('git', ['log', '--no-merges', '--name-only', FORMAT], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (failure) {
    log().warn(`git log --name-only in ${cwd}: ${whyFailed(failure)} — every run draws with no commits`)
    return []
  }

  return out
    .split('\x1e')
    .filter((chunk) => chunk.trim())
    .map((chunk) => {
      const [hash, seconds, subject, task, body, files] = chunk.split('\x1f')
      return {
        hash: hash!,
        at: Number(seconds) * 1000,
        subject: subject ?? '',
        task: task?.trim() ? task.trim() : null,
        message: `${subject ?? ''}\n${body ?? ''}`,
        files: (files ?? '').split('\n').map((f) => f.trim()).filter(Boolean),
      }
    })
}

/**
 * The commits of MANY runs, from a single scan — same rule as `commitsFor`, which
 * it replaces at the only call site that was hurting: the union of "names the run"
 * and "touched its folder", newest first, capped per run.
 *
 * `dirs` come in absolute (that is what `scanRuns` holds); git reports paths from
 * the repo root, so they are relativised here rather than at every comparison.
 *
 * RETURNS BY POSITION, not by id, and that is not a style choice: two runs can
 * carry the SAME id under different mains — `975_litoral` exists in both
 * `01_coding` and `02_product` today. Keying the result by id merged their two
 * buckets and handed each run the other's commits; the first version of this
 * function did exactly that, and the diff against `commitsFor` caught it. It is
 * the same trap the note on `commitsFor` describes for the run NUMBER, one level
 * up: here the whole slug repeats.
 */
export function commitsForMany(
  root: string,
  runs: { id: string; dir?: string }[],
  limit = 20,
  scanned = scanCommits(root),
): Commit[][] {
  const rel = (dir: string) => path.relative(root, dir).split(path.sep).join('/')
  const wanted = runs.map((run) => ({ id: run.id, prefix: run.dir ? `${rel(run.dir)}/` : null }))
  const out: Commit[][] = runs.map(() => [])

  // Newest first is already git's order, so the per-run cap is just "stop adding".
  for (const commit of scanned) {
    wanted.forEach(({ id, prefix }, i) => {
      const bucket = out[i]!
      if (bucket.length >= limit) return
      const names = commit.message.includes(id)
      const touches = prefix !== null && commit.files.some((file) => file.startsWith(prefix))
      if (names || touches) bucket.push({ hash: commit.hash, at: commit.at, subject: commit.subject, task: commit.task })
    })
  }
  return out
}
