//! THE TREE: nodes in, rows out.
//!
//! This file decides WHAT is on screen and in which order; every row's appearance
//! lives in `ui_rows/`, and every piece of a row in `ui_row_widgets/`. Reading the
//! disk is `disk/`. That split is the reason a design change touches one small file.
//!
//! Two things it owns and nothing else can: the CACHE, because a countdown repaints
//! once a second and a scan means a `git log` per run, and the SANDBOX switch, because
//! "where do the runs come from" is a question about the whole tree.
//!
//! O cache NÃO tem prazo — quem manda reler é o tick de dados, e só ele. O porquê está
//! no comentário sobre a classe, e custou 1,8 s de janela travada a cada oito segundos.

import * as vscode from 'vscode'
import { sandboxRuns } from '../disk/fixtures.js'
import type { Pull } from '../disk/prs.js'
import { houseRoot, isMoving, ordered, scanRuns, type Commit, type Issue, type Run, type Unit } from '../disk/runs.js'
import { commitRow } from '../ui_rows/commit.js'
import { issueRow } from '../ui_rows/issue.js'
import { prRow } from '../ui_rows/gh_pr.js'
import { runRow } from '../ui_rows/run.js'
import { unitRow } from '../ui_rows/unit.js'
import { STYLES, type Style } from '../ui_row_widgets/countdown_timer.js'

export type Node =
  // The ROOT: a run is a plan, a coding cycle or a QA gate, and its icon says which.
  | { kind: 'run'; run: Run }
  | { kind: 'unit'; unit: Unit }
  | { kind: 'issue'; run: Run; issue: Issue }
  | { kind: 'commit'; commit: Commit }
  | { kind: 'pr'; repo: string; pull: Pull }

/*
 * O CACHE nao vence sozinho, e essa e a correcao de 19/08.
 *
 * Ele tinha um TTL de 8s, e havia DOIS relogios mandando no mesmo dado: o tick de
 * DADOS (10s/60s, `tree/tick.ts`) chamando `refresh()`, e o TTL vencendo por conta
 * propria. Quem colhia o vencimento era quem pintasse depois dele — e quem pinta e a
 * batida de UM segundo. Medido: uma em cada oito batidas varria o disco inteiro,
 * 1,8 s de `execFileSync` na thread do extension host, exatamente o que o `//!` do
 * `tick.ts` promete que NAO acontece ("It reads the CACHE, never the disk").
 *
 * Agora o cache vive ate alguem INVALIDAR: `refresh()` — o tick de dados, dono
 * legitimo de "releia o disco" — e `toggleSandbox()`. Um relogio, um dono.
 */

/** Does this run show a live countdown? Then the second hand has to move. */
function isCounting(run: Run): boolean {
  return Boolean(run.t0) && run.taskMinutes.length > 0
}

export class RunsTree implements vscode.TreeDataProvider<Node> {
  private readonly changed = new vscode.EventEmitter<Node | undefined>()
  readonly onDidChangeTreeData = this.changed.event

  // Both choices persist in settings: an answer that resets on reload is not an answer.
  private style: Style = vscode.workspace.getConfiguration('my').get<Style>('style') ?? 'cronometro'
  private sandbox = vscode.workspace.getConfiguration('my').get<boolean>('sandbox') ?? false

  private root = RunsTree.houseRoot()
  private cache: Run[] | undefined

  /** The workspace folders are the only thing the host knows and the disk layer does not. */
  private static houseRoot(): string | null {
    return houseRoot((vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath))
  }

  refresh(): void {
    this.root = RunsTree.houseRoot()
    this.cache = undefined
    this.changed.fire(undefined)
  }

  /**
   * Repaint without re-reading the disk: the countdown loses a second.
   *
   * The colour pulse that used to live here is GONE. Cycling a `ThemeColor` means
   * re-firing the tree four times a second, and repainting the whole tree that often
   * flickers the sidebar. An icon FILE animates itself (`icons/`), so animation costs
   * no refresh, and this beat now exists only for rows showing a live countdown.
   *
   * PINTAR NÃO LÊ O DISCO, e até 19/08 lia — o porquê está no comentário do cache.
   */
  repaint(): void {
    this.changed.fire(undefined)
  }

  /** Whether any run has a unit ahead of its base — the fast data-tick condition. */
  moving(): boolean {
    return this.runs().some(isMoving)
  }

  /** Whether anything changes every second: a live countdown, or a run in flight. */
  ticking(): boolean {
    return this.runs().some((run) => isCounting(run) || isMoving(run))
  }

  inSandbox(): boolean {
    return this.sandbox
  }

  toggleSandbox(): boolean {
    this.sandbox = !this.sandbox
    this.cache = undefined
    void vscode.workspace.getConfiguration('my').update('sandbox', this.sandbox, vscode.ConfigurationTarget.Global)
    this.changed.fire(undefined)
    return this.sandbox
  }

  cycleStyle(): Style {
    this.style = STYLES[(STYLES.indexOf(this.style) + 1) % STYLES.length]
    void vscode.workspace.getConfiguration('my').update('style', this.style, vscode.ConfigurationTarget.Global)
    this.changed.fire(undefined)
    return this.style
  }

  /** The runs, from the sandbox or from the disk — every read goes through here. */
  private runs(): Run[] {
    if (this.sandbox) return sandboxRuns()
    if (!this.root) return []
    if (this.cache) return this.cache
    this.cache = ordered(scanRuns(this.root))
    return this.cache
  }

  getChildren(node?: Node): Node[] {
    if (!node) return this.runs().map((run) => ({ kind: 'run' as const, run }))

    if (node.kind === 'run') {
      // Units first: "which unit is moving" is the question a running fan-out raises.
      // Then issues, because an issue is what the plan promised and a commit is only
      // what happened — the promise is what someone goes looking for.
      return [
        ...node.run.units.map((unit) => ({ kind: 'unit' as const, unit })),
        // PRs before issues: a PR is what someone can review RIGHT NOW, and the issue is
        // the promise it answers.
        ...node.run.prs.map((pull) => ({ kind: 'pr' as const, repo: node.run.repo as string, pull })),
        ...node.run.issues.map((issue) => ({ kind: 'issue' as const, run: node.run, issue })),
        ...node.run.commits.map((commit) => ({ kind: 'commit' as const, commit })),
      ]
    }

    return []
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === 'unit') return unitRow(node.unit)
    if (node.kind === 'issue') return issueRow(node.run, node.issue)
    if (node.kind === 'pr') return prRow(node.repo, node.pull)
    if (node.kind === 'commit') return commitRow(node.commit)
    return runRow(node.run, this.style, this.sandbox)
  }
}
