//! THE ROUTER of the run views: the main decides which view a run gets.
//!
//! The house's output is organised BY WORKFLOW, and the three mains keep different things
//! on disk — measured before this was designed: `02_product` holds 21 `state.yaml`, 15
//! `sprints.yaml` and 15 `interview.yaml`; `01_coding` holds units, refusals and parked
//! sprints inside its state; `03_qa` holds a prose `summary.md` and a `repro/` folder.
//! One view with conditional sections would make each main's layout hostage to the others,
//! so there are three sibling views over the same parts. That was decision D1 of run 977.
//!
//! An unknown main falls back to the product view: it is the one that renders whatever a
//! run happens to have, and a blank pane would be worse than a partial one. #enum_aberto

import * as fs from 'node:fs'
import * as path from 'node:path'
import { readBatch, type Plan } from '../disk/plan.js'
import { read, type Run } from '../disk/runs.js'
import { codingRunView } from './run_coding.js'
import { productRunView } from './run_product.js'
import { qaRunView } from './run_qa.js'
import type { ShellOptions } from './shell.js'

/** Everything the three views read, gathered once so no view touches the disk twice. */
export interface RunPage {
  run: Run
  plan: Plan
  batch: ReturnType<typeof readBatch>
  /**
   * `desenho:` resolved. `markdown: null` means the run POINTS at a drawing that is not
   * there — which is a finding, not an absence: the 980 pointed at a file that a refactor
   * had moved, and the section simply vanished instead of saying so.
   */
  desenho: { path: string; markdown: string | null } | null
  /** The QA summary, or any `summary.md` a run left behind. */
  summary: string | null
  /** Files in the run folder, for the artefact list. */
  artefacts: string[]
  reproFiles: string[]
}

export function readRunPage(run: Run): RunPage {
  // The plan comes ALREADY PARSED from `scanRuns`, inheritance rule and all: a coding
  // run points at the product run that produced it (`origem:`), and that is where
  // `sprints.yaml` lives. Reading and parsing it a second time here is what let the two
  // sides disagree about which issue numbers were real.
  const plan = run.plan

  const stateYaml = read(path.join(run.dir, 'state.yaml')) ?? ''
  const desenhoPath = plan.desenho ?? run.state.desenho ?? null
  const desenhoMarkdown = desenhoPath ? read(path.join(run.root, desenhoPath)) : null

  let artefacts: string[] = []
  let reproFiles: string[] = []
  try {
    artefacts = fs.readdirSync(run.dir).filter((entry) => !entry.startsWith('.'))
  } catch {
    artefacts = []
  }
  try {
    reproFiles = fs.readdirSync(path.join(run.dir, 'repro'))
  } catch {
    reproFiles = []
  }

  return {
    run,
    plan,
    batch: readBatch(stateYaml),
    desenho: desenhoPath ? { path: desenhoPath, markdown: desenhoMarkdown } : null,
    summary: read(path.join(run.dir, 'summary.md')),
    artefacts,
    reproFiles,
  }
}

export function runView(run: Run, options: Omit<ShellOptions, 'title'>): string {
  const page = readRunPage(run)
  if (run.main === '01_coding') return codingRunView(page, options)
  if (run.main === '03_qa') return qaRunView(page, options)
  return productRunView(page, options)
}
