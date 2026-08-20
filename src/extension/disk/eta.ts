//! The countdown behind the `my` tree: how much longer does this run have?
//!
//! Pure on purpose — no `vscode` import anywhere in this file — because the
//! interesting part is arithmetic over declared durations, and arithmetic tested
//! inside an extension host is arithmetic nobody re-runs. `node --test` reaches
//! it; the tree only formats what comes back.
//!
//! WHAT THE DISK ACTUALLY HOLDS (measured 2026-08-17 in ~/src/me):
//!   138 tasks with a declared `duration:`  ·  0 with `actual_duration:`
//!     4 real durations, written by hand in comments ("9min52s", "7min30s",
//!       "7min07s", "5min36s") — all four UNDER their declared ceiling
//!    22 `cycle_time:` em recibos de `_events/`, todos 0 ou 1 (tempo de CLI, não
//!    de trabalho) — e a pasta inteira morreu em 17/08, o que confirma a medição:
//!    a fonte que não media nada foi a primeira a poder sair
//!
//! So the Monte Carlo samples the DECLARED sum through a ratio prior, and the
//! prior is stated here rather than hidden in a constant: four pairs cannot
//! estimate a distribution, and pretending otherwise is how an estimate stops
//! being auditable. It does NOT learn — nothing writes `actual_duration` back
//! yet. See F2 of run 980 for the `wrong_when`.
//!
//! Quantiles, never a mean: a right-skewed sum has a mean nobody experiences,
//! and a countdown that reads "4 min" for twenty minutes is a countdown people
//! stop believing.

import { cleanScalar, itemKeyValue, keyValue } from './yaml.js'

/** Median of actual/declared. Below 1 because all four measured pairs came in under. */
export const RATIO_MEDIAN = 0.9
/** Spread of ln(actual/declared). Assumed, not measured — the honest half of the prior. */
export const RATIO_SIGMA = 0.35
/** Samples. 2000 puts the p90 within a few seconds of stable, and costs microseconds. */
export const SAMPLES = 2000

export interface Eta {
  /** Minutes still to go, median case. Never negative — a run past its estimate reads 0. */
  p50: number
  /** Minutes still to go, pessimistic case. This is the number the tooltip shows. */
  p90: number
  /** Sum of every declared `duration:` in the plan, untouched by the prior. */
  declared: number
  /** Minutes since `t0`, or null when no `t0` could be resolved. */
  elapsed: number | null
}

/**
 * `duration:` as written by humans in `sprints.yaml`, all three shapes that
 * exist on disk. Anything else is null, never 0: zero would claim "instant",
 * and a claim is worse than an absence — #enum_aberto for numbers.
 */
export function parseDurationMinutes(raw: string): number | null {
  const text = raw.trim().replace(/^["']|["']$/g, '')

  // "9min52s" / "7min30s" — a measured duration, minutes and seconds glued.
  const withSeconds = /^(\d+)\s*min(?:utos?)?\s*(\d+)\s*s/i.exec(text)
  if (withSeconds) return Number(withSeconds[1]) + Number(withSeconds[2]) / 60

  // "5 min" / "10min" / "12 minutos" — the declared form, 138 of them.
  const minutes = /^(\d+(?:[.,]\d+)?)\s*min/i.exec(text)
  if (minutes) return Number(minutes[1].replace(',', '.'))

  return null
}

/**
 * Every `duration:` of a `sprints.yaml`, in order, as minutes.
 *
 * ponytail: line scan, not a YAML parser. The extension has one dependency
 * (tslog) and this file needs three fields out of a file we write ourselves.
 * Ceiling: a `duration:` nested inside a quoted block would be counted — if
 * that ever happens, take a real YAML parser, not a cleverer regex.
 */
export function declaredDurations(sprintsYaml: string): number[] {
  const found: number[] = []
  for (const line of sprintsYaml.split('\n')) {
    // The `- ` prefix is optional: a task writes `duration:` as its own key, and
    // a one-line task writes it right after the dash. Both shapes are on disk.
    const match = /^\s*(?:-\s*)?duration:\s*(.+)$/.exec(line)
    if (!match) continue
    // Strip a trailing `# comment` — several measured durations carry one.
    const minutes = parseDurationMinutes(match[1].replace(/\s+#.*$/, ''))
    if (minutes !== null) found.push(minutes)
  }
  return found
}

/**
 * Top-level `key: value` of a small yaml (`state.yaml`), values kept as strings.
 *
 * Same ponytail ceiling as above, and the same reason: `at`, `started_at` and
 * `subject` are all this needs, and all three are top-level scalars.
 */
export function topLevel(yaml: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of yaml.split('\n')) {
    const found = keyValue(line)
    if (!found) continue
    const value = cleanScalar(found.raw)
    if (value) out[found.key] = value
  }
  return out
}

/** Seeded so the same run renders the same number twice — mulberry32. */
function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box–Muller, one normal per call. Good enough; nothing here is hot. */
function normal(next: () => number): number {
  const u = Math.max(next(), Number.EPSILON)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next())
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))
  return sorted[index]
}

/**
 * The countdown: sample the plan, subtract what already burned.
 *
 * Each task gets its OWN ratio draw, so a long plan averages its own errors out
 * — one draw for the whole sum would make a 9-task plan as uncertain as a
 * 1-task one, which is the opposite of true.
 *
 * `elapsed` null (no `t0` on disk) means there is nothing to subtract, and the
 * answer is the full plan rather than a guess dressed as a countdown.
 */
/**
 * The sorted samples for one plan — computed once per `(seed, taskMinutes)`.
 *
 * The draw depends on NOTHING that changes between beats: `seed` comes from the
 * run id and the plan is what `duration:` says on disk. `elapsed` never reaches
 * here — it is a subtraction at the very end. So the 2000 samples were being
 * redrawn every second to rebuild, bit for bit, the array from the second
 * before: 64 ms of extension-host CPU per beat, on the same thread as
 * autocomplete and file save.
 *
 * ponytail: unbounded Map, and deliberately. One entry per distinct plan — 56
 * runs on disk today, plus one more each time a `duration:` is edited, holding
 * 2000 floats each. If that ever stops being noise, the upgrade is an LRU keyed
 * the same way, not an eviction policy invented here.
 */
const samplesByPlan = new Map<string, number[]>()

function sortedSamples(taskMinutes: number[], seed: number): number[] {
  const key = `${seed}|${taskMinutes.join(',')}`
  const cached = samplesByPlan.get(key)
  if (cached) return cached

  const next = rng(seed)
  const totals: number[] = []
  for (let i = 0; i < SAMPLES; i++) {
    let total = 0
    for (const minutes of taskMinutes) {
      total += minutes * RATIO_MEDIAN * Math.exp(RATIO_SIGMA * normal(next))
    }
    totals.push(total)
  }
  totals.sort((a, b) => a - b)

  samplesByPlan.set(key, totals)
  return totals
}

export function estimate(taskMinutes: number[], elapsedMinutes: number | null, seed = 1): Eta {
  const declared = taskMinutes.reduce((sum, m) => sum + m, 0)
  const totals = sortedSamples(taskMinutes, seed)

  const burned = elapsedMinutes ?? 0
  return {
    p50: Math.max(0, quantile(totals, 0.5) - burned),
    p90: Math.max(0, quantile(totals, 0.9) - burned),
    declared,
    elapsed: elapsedMinutes,
  }
}

/**
 * A top-level list of maps out of a small yaml — `unidades:` and its siblings.
 *
 * ponytail: indentation-aware line scan, still not a YAML parser, and still for
 * the same reason: this reads files we write ourselves, and the shape is one
 * level of `- key: value`. Ceiling: nested maps INSIDE an item are ignored, not
 * mis-parsed. When something nests, take a parser.
 */
export function listOfMaps(yaml: string, key: string): Record<string, string>[] {
  const lines = yaml.split('\n')
  const start = lines.findIndex((line) => new RegExp(`^${key}:\\s*$`).test(line))
  if (start === -1) return []

  const items: Record<string, string>[] = []
  let current: Record<string, string> | null = null

  for (const line of lines.slice(start + 1)) {
    // A new top-level key ends the list — anything unindented that is not an item.
    if (/^\S/.test(line)) break
    if (!line.trim()) continue

    // Indented, then the shape: the guard above already rejected column 0.
    const text = line.trim()

    const item = itemKeyValue(text)
    if (item) {
      current = {}
      items.push(current)
      const value = cleanScalar(item.raw)
      if (value) current[item.key] = value
      continue
    }

    const field = keyValue(text)
    if (field && current) {
      const value = cleanScalar(field.raw)
      if (value) current[field.key] = value
    }
  }

  return items
}
