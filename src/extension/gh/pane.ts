//! An issue as a WEBVIEW panel — the pane, and the only place a panel is created.
//!
//! It replaced a virtual markdown document, and the reason is what the document could
//! not do: `state`, `labels[]`, `assignees[]` and the comment thread all arrive as
//! structured data from `gh`, and a markdown preview turns every one of them back into
//! a paragraph. A state pill, a label in the colour GitHub gave it, and a comment in a
//! card are the whole point.
//!
//! Style comes from `media/issue.css`, compiled by `npm run css` (Tailwind + daisyUI).
//! A webview has NO network under this CSP, so a CDN build is not an option — not even
//! for a prototype.
//!
//! One panel per issue, reused: clicking the same row twice reveals the open tab instead
//! of stacking a second one.

import * as vscode from 'vscode'
import { SANDBOX_REPO, sandboxIssue } from '../disk/fixtures.js'
import type { Issue, Run } from '../disk/runs.js'
import { log } from '../log.js'
import { issueView } from '../webview/issue.js'
import { prView } from '../webview/pr.js'
import { chrome as sharedChrome } from '../webview/chrome.js'
import { escape } from '../webview/shell.js'
import { fetchIssue, fetchPull, toIssueDetail, type IssueDetail } from './api.js'

/** `<repo>#<number>` — one panel per issue. */
const open = new Map<string, vscode.WebviewPanel>()

async function load(repo: string, number: string): Promise<IssueDetail> {
  // The sandbox never shells out: its repo does not exist, so `gh` would answer with an
  // error and the pane would show the error instead of a design.
  if (repo === SANDBOX_REPO) {
    const fixture = sandboxIssue(number)
    return {
      ...toIssueDetail(repo, {
        number: fixture.number,
        title: fixture.title,
        state: fixture.state,
        html_url: fixture.url,
        created_at: '2026-08-17T18:30:00Z',
        user: { login: 'sandbox' },
        labels: fixture.labels.map((label) => ({ name: label.name, color: 'BFD4F2' })),
      }),
      // The fixture body is markdown, and this pane speaks HTML — wrapping it in `<pre>`
      // is honest: it says "this is not rendered by GitHub" without pretending.
      bodyHtml: `<pre>${escape(fixture.body)}</pre>`,
      comments: fixture.comments.map((comment) => ({
        author: comment.author.login,
        avatar: null,
        createdAt: comment.createdAt,
        // `escape()` for the same reason the body above gets it, five lines up: the two
        // came from one function with two rules. The value is a literal in
        // `disk/fixtures.ts` today, so this is not a hole — it is the hole that opens
        // the day the fixture is read from disk or typed by a human.
        bodyHtml: `<p>${escape(comment.body)}</p>`,
      })),
      fixture: true,
    }
  }

  return fetchIssue(repo, number)
}

export function register(context: vscode.ExtensionContext): vscode.Disposable[] {
  // O chrome mora em `webview/chrome.ts` desde 19/08 — o pane de run precisa do
  // mesmo, e CSP copiada é como uma view para de carregar mermaid sozinha.
  const chrome = (panel: vscode.WebviewPanel) => sharedChrome(context, panel)

  return [
    // Issue and PR are the same panel with a different view: same CSP, same
    // `localResourceRoots`, same reuse-by-key, same `open`/`reload` bridge. They differ
    // in the four things `pane()` takes.
    pane(context, {
      command: 'my.openIssue',
      viewType: 'my.issue',
      icon: 'github',
      key: (repo, number) => `${repo}#${number}`,
      url: (repo, number) => `https://github.com/${repo}/issues/${number}`,
      what: (number) => `#${number}`,
      draw: async (panel, repo, number) => {
        const issue = await load(repo, number)
        panel.title = `#${number} · ${issue.title}`
        return issueView(issue, chrome(panel))
      },
    }),

    pane(context, {
      command: 'my.openPr',
      viewType: 'my.pr',
      icon: 'git-pull-request',
      // `!` and not `#`: the two keys share the `open` map, and an issue and a PR of the
      // same repo can carry the SAME number — one key would reveal the wrong tab.
      key: (repo, number) => `${repo}!${number}`,
      url: (repo, number) => `https://github.com/${repo}/pull/${number}`,
      what: (number) => `PR #${number}`,
      draw: async (panel, repo, number) => {
        const pull = await fetchPull(repo, number)
        panel.title = `#${number} · ${pull.title}`
        return prView(pull, chrome(panel))
      },
    }),
  ]
}

interface PaneKind {
  /** The command a tree row fires. */
  command: string
  /** The webview type, for VS Code's own bookkeeping. */
  viewType: string
  /** A `ThemeIcon` id. */
  icon: string
  key: (repo: string, number: string) => string
  url: (repo: string, number: string) => string
  /** What the loading and error bodies call this thing — `#12`, `PR #12`. */
  what: (number: string) => string
  /** Fetch and render. Throwing is fine: the error lands INSIDE the pane. */
  draw: (panel: vscode.WebviewPanel, repo: string, number: string) => Promise<string>
}

/** The panel body while `gh` is still answering. Two calls take a beat on a big thread. */
function loading(what: string): string {
  return `<!DOCTYPE html><body style="font-family:var(--vscode-font-family);padding:2rem;opacity:.7">carregando ${escape(what)}…</body>`
}

/**
 * One panel lifecycle, parameterised: reuse by key, create, draw, and say so when it
 * fails.
 *
 * The two commands used to keep a copy each — same options, same disposal, same bridge —
 * and the copies had already drifted: `loading()` was extracted for the issue and
 * re-inlined for the PR, and only the issue pane escaped the `gh` error at all.
 */
function pane(context: vscode.ExtensionContext, kind: PaneKind): vscode.Disposable {
  return vscode.commands.registerCommand(kind.command, async (repo: string, number: string) => {
    const key = kind.key(repo, number)
    const existing = open.get(key)
    if (existing) {
      existing.reveal()
      return
    }

    const panel = vscode.window.createWebviewPanel(kind.viewType, `#${number}`, vscode.ViewColumn.Active, {
      enableScripts: true,
      // Only our compiled stylesheet is reachable as a local resource; everything else
      // the page wants has to come from GitHub over https, or not at all.
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
      // The thread can be long, and losing the scroll position on every tab switch is
      // what makes a reader stop using a pane.
      retainContextWhenHidden: true,
    })
    panel.iconPath = new vscode.ThemeIcon(kind.icon)
    open.set(key, panel)
    panel.onDidDispose(() => open.delete(key))

    const render = async () => {
      panel.webview.html = loading(kind.what(number))
      try {
        panel.webview.html = await kind.draw(panel, repo, number)
      } catch (failure) {
        const message = failure instanceof Error ? failure.message : String(failure)
        log().error(`${kind.command} ${repo}#${number}: ${message}`)
        // Loud, and INSIDE the pane: a click that opens an empty tab reads as a broken
        // feature, and the `gh` message is usually the whole diagnosis (not logged in,
        // no access, wrong repo).
        //
        // `escape()` and not a hand-rolled `<`-only replace: this is the `gh` process's
        // own output, so it is data from OUTSIDE, and a message carrying `"` or `&` used
        // to reach the body unescaped.
        panel.webview.html = `<!DOCTYPE html><body style="font-family:var(--vscode-font-family);padding:2rem">
          <h2>Não deu pra ler ${escape(kind.what(number))}</h2>
          <p><code>${escape(repo)}</code></p>
          <pre style="white-space:pre-wrap">${escape(message)}</pre>
          <p>Isto vem do <code>gh</code>. Se for autenticação: <code>gh auth status</code>.</p>
        </body>`
      }
    }

    panel.webview.onDidReceiveMessage((message: { do?: string }) => {
      if (message.do === 'open') void vscode.env.openExternal(vscode.Uri.parse(kind.url(repo, number)))
      if (message.do === 'reload') void render()
    })

    await render()
  })
}

export function openIssueCommand(run: Run, issue: Issue): vscode.Command | undefined {
  if (!run.repo) return undefined
  return { command: 'my.openIssue', title: 'Abrir a issue', arguments: [run.repo, issue.number] }
}
