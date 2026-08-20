//! The four values every webview needs to render inside the editor: where the
//! stylesheet is, where mermaid is, the nonce, and the CSP source.
//!
//! Extracted from `gh/pane.ts` on 19/08, when a THIRD view — the run pane — had
//! to draw with the same chrome. It was a closure inside `register()`, reachable
//! only by the issue and PR panes; the run pane would have had to copy it, and a
//! copied CSP is how one view quietly stops loading mermaid while the other two
//! keep working.
//!
//! depends_on: src/extension/webview/shell.ts
//! impacts:    src/extension/gh/pane.ts · src/extension/extension.ts

import * as vscode from 'vscode'

/** A fresh nonce per render: the CSP names it, so a reused one would let a stale
 *  script tag from a previous render still execute.
 *
 *  No dependency, not even `node:crypto`: the value only has to be unguessable
 *  within one page load. Moved here from `gh/pane.ts` unchanged. */
export function nonce(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
}

/**
 * `media/` is the ONLY local resource root the panes get, so both files it names
 * live there — 3.4 MB of mermaid included, because GitHub returns diagrams as
 * SOURCE and under this CSP a CDN is unreachable.
 */
export function chrome(context: vscode.ExtensionContext, panel: vscode.WebviewPanel) {
  const style = vscode.Uri.joinPath(context.extensionUri, 'media', 'issue.css')
  const mermaid = vscode.Uri.joinPath(context.extensionUri, 'media', 'mermaid.min.js')
  return {
    styleUri: panel.webview.asWebviewUri(style).toString(),
    mermaidUri: panel.webview.asWebviewUri(mermaid).toString(),
    nonce: nonce(),
    cspSource: panel.webview.cspSource,
  }
}
