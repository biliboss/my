//! The PLAN of a run, read whole — not just the durations.
//!
//! `eta.ts` only ever pulled `duration:` out of a `sprints.yaml`, so the titles, the
//! `proof` command of every task and the whole `coverage` block sat on disk with nobody
//! reading them. Measured on run 980: 3 sprints, 9 tasks, a proof on every one, 7 ids of
//! coverage and 4 out-of-scope items with a reason each. That is the richest thing this
//! house writes and none of it reached a screen.
//!
//! Same for the batch side: `recusadas[]` and `parqueadas[]` live in a coding run's
//! `state.yaml` — the 979 refuses S5 because its proof pointed at nothing, and parks S6
//! waiting on two decisions — and neither appears anywhere in the UI. The owner named
//! that gap himself during the interview (run 977, round 3).
//!
//! ponytail: still the line scanner, not a YAML parser. It reads files we write, and the
//! shapes are two levels deep. Ceiling stated where it bites: a `proof` containing a
//! newline is truncated to its first line, and the day someone writes one, this needs a
//! real parser rather than a cleverer regex.

import { parseDurationMinutes } from './eta.js'
import { cleanScalar, depth, Folding, isFolded, itemKeyValue, keyValue } from './yaml.js'

export interface PlanTask {
  title: string
  description: string | null
  duration: string | null
  minutes: number | null
  /** The command that proves the task done — mono, because it is meant to be copied. */
  proof: string | null
  references: string[]
}

export interface PlanSprint {
  id: string
  titulo: string | null
  duration: string | null
  minutes: number | null
  unidade: string | null
  /** The issue number publishing wrote back, when it did. */
  issue: string | null
  tasks: PlanTask[]
}

export interface Plan {
  label: string | null
  repo: string | null
  projeto: string | null
  /** The call stack of the feature, when the run declares one. */
  desenho: string | null
  sprints: PlanSprint[]
  /** `id → onde foi coberto`, the map that makes an uncovered id visible. */
  coverage: { id: string; where: string }[]
  outOfScope: { item: string; porQue: string | null }[]
  declaredDeviation: { regra: string | null; desvio: string | null }[]
}

/**
 * Is this the number of an issue that was actually PUBLISHED?
 *
 * A number with a leading zero is not a GitHub number: runs keep draft ids
 * (`issue: "01"`) for issues that were never published, and `#01` rendered as a
 * link sends someone to issue #1 of the wrong repo. `issues.ts` has refused
 * those since 18/08 — but `readPlan` did not, so the same `sprints.yaml` gave a
 * guarded answer through one reader and a clickable `#01` through the other.
 *
 * It lives HERE, in the parser, because the guard belongs where a yaml string
 * becomes an issue number — every view downstream inherits it, instead of each
 * one remembering to ask.
 */
export function publishedIssue(value: string | undefined | null): boolean {
  return Boolean(value && /^[1-9]\d*$/.test(value))
}

/**
 * A scalar, plus the one thing this reader wants that `cleanScalar` must NOT do:
 * a lone `>-` collapses to the empty string.
 *
 * That is only safe AFTER `isFolded` has already looked at the raw text. Kept as a
 * separate step for exactly that reason — folding onto `cleanScalar` itself is the
 * mistake that read a folded block as an empty one.
 */
function clean(value: string): string {
  return cleanScalar(value).replace(/^[>|][-+]?\s*$/, '')
}

/**
 * The plan, in the shape a view can render.
 *
 * Written as one pass over the lines with a tiny state machine, because the interesting
 * structure is exactly two levels — sprint, then task — and every nesting rule here is
 * one the house's own template already guarantees.
 */
export function readPlan(yaml: string): Plan {
  const plan: Plan = {
    label: null,
    repo: null,
    projeto: null,
    desenho: null,
    sprints: [],
    coverage: [],
    outOfScope: [],
    declaredDeviation: [],
  }

  type Where = 'top' | 'sprints' | 'coverage' | 'out_of_scope' | 'declared_deviation'
  let where: Where = 'top'
  let sprint: PlanSprint | null = null
  let task: PlanTask | null = null
  const folding = new Folding()

  for (const raw of yaml.split('\n')) {
    if (!raw.trim()) continue

    // A folded block keeps swallowing lines that are indented deeper than its key.
    if (folding.feed(raw)) continue
    folding.flush()

    const line = raw.trimEnd()
    const at = depth(line)
    const text = line.trim()

    // Top-level keys switch section AND close whatever was open.
    if (at === 0) {
      const top = keyValue(text)
      if (!top) continue
      const { key, raw: rest } = top
      sprint = null
      task = null
      where =
        key === 'sprints'
          ? 'sprints'
          : key === 'coverage'
            ? 'coverage'
            : key === 'out_of_scope'
              ? 'out_of_scope'
              : key === 'declared_deviation'
                ? 'declared_deviation'
                : 'top'
      const value = clean(rest ?? '')
      if (key === 'label') plan.label = value || null
      if (key === 'repo') plan.repo = value && value !== 'null' ? value : null
      if (key === 'projeto') plan.projeto = value || null
      if (key === 'desenho') plan.desenho = value || null
      continue
    }

    if (where === 'coverage') {
      const [, id, rest] = /^([a-z0-9_]+):\s*(.*)$/i.exec(text) ?? []
      if (id) plan.coverage.push({ id, where: clean(rest ?? '') })
      continue
    }

    if (where === 'out_of_scope' || where === 'declared_deviation') {
      const item = itemKeyValue(text)
      const field = keyValue(text)
      const target = where === 'out_of_scope' ? plan.outOfScope : plan.declaredDeviation
      if (item) {
        // A new list entry. The two lists differ only in their field names.
        target.push(
          where === 'out_of_scope'
            ? ({ item: clean(item.raw), porQue: null } as never)
            : ({ regra: clean(item.raw), desvio: null } as never),
        )
        continue
      }
      if (field && target.length) {
        const last = target[target.length - 1] as Record<string, unknown>
        const key = field.key === 'por_que' ? 'porQue' : field.key
        // `isFolded` reads the RAW value — see the note on it: cleaning strips `>-` to
        // nothing, and testing the cleaned string reads a folded block as an empty one.
        if (isFolded(field.raw)) folding.open(at, (folded) => (last[key] = folded))
        else last[key] = clean(field.raw)
      }
      continue
    }

    if (where !== 'sprints') continue

    // `- sprint: 1` opens a sprint; `- title: …` opens a task inside it.
    const opensSprint = /^-\s+sprint:\s*(.*)$/i.exec(text)
    if (opensSprint) {
      sprint = {
        id: `S${clean(opensSprint[1])}`,
        titulo: null,
        duration: null,
        minutes: null,
        unidade: null,
        issue: null,
        tasks: [],
      }
      task = null
      plan.sprints.push(sprint)
      continue
    }

    const opensTask = /^-\s+title:\s*(.*)$/i.exec(text)
    if (opensTask && sprint) {
      task = { title: clean(opensTask[1]), description: null, duration: null, minutes: null, proof: null, references: [] }
      sprint.tasks.push(task)
      // A title written as a folded block: `- title: >-`
      if (!task.title) {
        const opened = task
        folding.open(at, (folded) => (opened.title = folded))
      }
      continue
    }

    const reference = /^-\s+"?(.+?)"?$/.exec(text)
    if (reference && task && !text.includes(': ')) {
      task.references.push(clean(reference[1]))
      continue
    }

    const found = keyValue(text)
    if (!found) continue
    const { key, raw: rest } = found
    const value = clean(rest)
    // One writer for both shapes: the field names are the same where they overlap, and
    // the cast is the honest cost of a line parser that fills two record types.
    const holder = (task ?? sprint) as unknown as Record<string, unknown> | null
    if (!holder) continue

    // `key: >-` means the value is the indented block that follows, decided on the RAW
    // text for the same reason as above.
    if (isFolded(rest) && (key === 'description' || key === 'proof' || key === 'titulo' || key === 'title')) {
      folding.open(at, (folded) => (holder[key] = folded))
      continue
    }

    if (key === 'duration') {
      holder.duration = value
      holder.minutes = parseDurationMinutes(value)
      continue
    }
    if (key === 'issue') {
      // A draft id (`issue: "01"`) is not an issue: it stays null so no view can
      // turn it into a link. Same rule `issuesOf` has always applied.
      holder.issue = publishedIssue(value) ? value : null
      continue
    }
    if (key === 'titulo' || key === 'title' || key === 'description' || key === 'proof' || key === 'unidade') {
      holder[key] = value
    }
  }

  folding.flush()
  return plan
}

export interface Refused {
  id: string
  issue: string | null
  porQue: string | null
}

export interface Batch {
  refused: Refused[]
  parked: Refused[]
}

/**
 * What a coding run REFUSED and what it PARKED, with the reason in the words of whoever
 * wrote it.
 *
 * Measured on 979: S5 refused because `pnpm --filter broker-web` matches no package in
 * the repo — a proof pointing at nothing — and S6 parked waiting on two decisions. Both
 * reasons were written down and neither was ever shown, which is the whole point of
 * reading them here.
 */
export function readBatch(stateYaml: string): Batch {
  const batch: Batch = { refused: [], parked: [] }

  let list: Refused[] | null = null
  let entry: Refused | null = null
  const folding = new Folding()

  for (const raw of stateYaml.split('\n')) {
    if (!raw.trim()) continue

    if (folding.feed(raw)) continue
    folding.flush()

    const at = depth(raw)
    const text = raw.trim()

    if (at === 0) {
      const key = keyValue(text)?.key
      list = key === 'recusadas' ? batch.refused : key === 'parqueadas' ? batch.parked : null
      entry = null
      continue
    }

    if (!list) continue

    const opens = /^-\s+id:\s*(.*)$/i.exec(text)
    if (opens) {
      entry = { id: clean(opens[1]), issue: null, porQue: null }
      list.push(entry)
      continue
    }

    const field = keyValue(text)
    if (!field || !entry) continue
    const open = entry
    // Same guard as the plan: `recusadas:`/`parqueadas:` is exactly where the draft
    // ids live, and `run_coding.ts` renders this field as a clickable `#…`.
    if (field.key === 'issue') {
      const number = clean(field.raw)
      open.issue = publishedIssue(number) ? number : null
    }
    if (field.key === 'por_que') {
      // Decided on the RAW value, like `readPlan` — this reader used to test the
      // CLEANED one, and cleaning strips `>-` to nothing, so a folded reason and an
      // empty reason were indistinguishable here.
      if (isFolded(field.raw)) folding.open(at, (folded) => (open.porQue = folded))
      else open.porQue = clean(field.raw)
    }
  }

  folding.flush()
  return batch
}
