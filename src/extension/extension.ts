//! The `my` view: the cycles of `~/src/me` in the Explorer.
//!
//! Wiring only. Where everything lives:
//!
//!   ui_rows/          one file per ROW — this is where appearance is edited
//!   ui_row_widgets/   the pieces a row is composed of: clock, icon, counts, tags
//!   disk/             what exists: run folders, branches, commits, issues, the maths
//!   gh/               an issue as an editor tab, read with `gh`
//!   tree/             the provider, the two clocks, the drag
//!
//! `disk/` and `ui_row_widgets/` import no `vscode`, which is why `node --test`
//! reaches them.

import * as vscode from 'vscode'
import type { Run } from './disk/runs.js'
import { register as issuePane } from './gh/pane.js'
import { log } from './log.js'
import { DragRunFolder } from './tree/drag.js'
import { RunsTree } from './tree/provider.js'
import { startTicking } from './tree/tick.js'
import { escape } from './webview/shell.js'

export function activate(context: vscode.ExtensionContext): void {
  const tree = new RunsTree()

  // `createTreeView`, not `registerTreeDataProvider`: the badge, `description` and
  // `onDidChangeVisibility` only exist on the returned view — and visibility is what
  // keeps the clock from ticking against a sidebar nobody is looking at.
  const view = vscode.window.createTreeView('my.runs', {
    treeDataProvider: tree,
    dragAndDropController: new DragRunFolder(),
    // Multi-select so one drag can carry several run folders.
    canSelectMany: true,
  })
  // The title is the only always-visible surface, so it is where "these runs are not
  // real" has to be said. Silent fake data is a trap.
  view.description = tree.inSandbox() ? 'sandbox' : undefined

  context.subscriptions.push(
    view,
    startTicking(view, tree),
    ...issuePane(context),

    vscode.commands.registerCommand('my.refresh', () => tree.refresh()),

    vscode.commands.registerCommand('my.toggleSandbox', () => {
      view.description = tree.toggleSandbox() ? 'sandbox' : undefined
    }),

    vscode.commands.registerCommand('my.cycleStyle', () => {
      vscode.window.setStatusBarMessage(`my: ${tree.cycleStyle()}`, 2000)
    }),

    vscode.commands.registerCommand('my.openRun', async (dir: string) => {
      // `state.yaml` when it exists, the plan otherwise: opening the folder would hand
      // the reader a file list to choose from, which is the click this row saves.
      const fs = await import('node:fs')
      const path = await import('node:path')
      const target = ['state.yaml', 'sprints.yaml', 'issues.yaml', 'input.yaml', 'summary.md']
        .map((name) => path.join(dir, name))
        .find((file) => fs.existsSync(file))
      if (!target) return
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(target))
    }),

    // A TELA DO RUN, e ela existia sem porta: `webview/run.ts` e as 807 linhas
    // abaixo dela só eram alcançáveis pelo `dev/serve.mjs`. Nenhum comando do
    // `package.json` abria um pane de run — o clique da linha abre o `state.yaml`
    // cru, que é outra coisa. Medido e ligado em 19/08 (task 044).
    //
    // Fica no MENU DE CONTEXTO e não no clique: trocar o que o clique faz mudaria
    // um gesto que já tem dono. Quem quer a tela pede a tela.
    vscode.commands.registerCommand('my.openRunPane', async (node: unknown) => {
      const run = (node as { run?: Run } | undefined)?.run
      if (!run) return
      const panel = vscode.window.createWebviewPanel('my.run', run.id, vscode.ViewColumn.Active, {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
        // A página é longa e tem seções abertas pelo leitor; perder a rolagem a
        // cada troca de aba é o que faz alguém parar de usar um pane.
        retainContextWhenHidden: true,
      })
      panel.iconPath = new vscode.ThemeIcon('list-tree')
      const { runView } = await import('./webview/run.js')
      const { chrome } = await import('./webview/chrome.js')
      try {
        panel.webview.html = runView(run, chrome(context, panel))
      } catch (failure) {
        const message = failure instanceof Error ? failure.message : String(failure)
        log().error(`my.openRunPane ${run.main}/${run.id}: ${message}`)
        // DENTRO do pane, e não só no log: uma aba em branco lê como recurso
        // quebrado, e a mensagem costuma ser o diagnóstico inteiro.
        panel.webview.html = `<!DOCTYPE html><body style="font-family:var(--vscode-font-family);padding:2rem">
          <h2>Não deu pra desenhar ${escape(run.id)}</h2>
          <pre style="white-space:pre-wrap">${escape(message)}</pre>
        </body>`
      }
    }),

    vscode.commands.registerCommand('my.openIssues', (node: unknown) => {
      const run = (node as { run?: { repo?: string | null; label?: string | null } } | undefined)?.run
      if (!run?.repo || !run.label) return
      const query = encodeURIComponent(`label:"${run.label}"`)
      void vscode.env.openExternal(vscode.Uri.parse(`https://github.com/${run.repo}/issues?q=${query}`))
    }),
  )

  log().info('my: view registered')
}

export function deactivate(): void {}
