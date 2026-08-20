//! The DESIGN LOOP: the views in a browser, hot-reloaded, off the real disk.
//!
//!   npm run dev        → http://localhost:5177
//!
//! Reloading a VS Code window to look at a colour is the slowest possible way to design
//! a view, and it costs the whole tree state every time. This serves the same compiled
//! views — the exact functions the extension calls — over http, watches `out/` and
//! `media/`, and pushes a reload down an SSE stream when either changes. `npm run watch`
//! in another pane keeps `out/` fresh; the page blinks and the design is on screen.
//!
//! It reads the REAL runs of `~/src/me`, because a view designed against a fixture is a
//! view that breaks on the first real folder. The sandbox fixtures are one click away for
//! the ugly shapes.
//!
//! MACOS LIGHT is the default theme here on purpose: the pane inherits `--vscode-*`
//! variables inside the editor and has none in a browser, so `dev/macos.css` supplies a
//! light set that matches the system default. The dark set is one query string away
//! (`?theme=dark`), which is also how a design gets checked in both.

import { createServer } from 'node:http'
import { readFileSync, existsSync, watch, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const HOUSE = join(homedir(), 'src', 'me')
const MAINS = join(HOUSE, '02_areas/00_workflows/00_main')
const PORT = Number(process.env.MY_DEV_PORT) || 5177

/** Fresh require on every request: a cached module is a hot reload that shows old code. */
function fresh(path) {
  const require = createRequire(pathToFileURL(join(ROOT, 'x.cjs')))
  const resolved = require.resolve(path)
  delete require.cache[resolved]
  // The whole graph has to go, or a change in `parts/` renders with the cached parent.
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(join(ROOT, 'out'))) delete require.cache[key]
  }
  return require(path)
}

/**
 * The runs on disk, newest first, straight from the extension's own scanner — MEMOISED.
 *
 * Measured before this cache existed: 3.2 s per page load. The scanner runs two `git log`
 * calls per run (25 runs on this disk) plus one `gh pr list` per repo, all synchronous, and
 * a page that takes three seconds to answer is a design loop nobody uses. The extension
 * already caches for 8 s for the same reason.
 *
 * The memo is dropped by the SAME watcher that triggers a reload, so a build always shows
 * fresh data: the cache never outlives a change, only a click.
 */
let scanned = null
function runs() {
  if (scanned) return scanned
  const { scanRuns, ordered } = fresh('./out/disk/runs.js')
  scanned = ordered(scanRuns(HOUSE))
  return scanned
}

const CHROME = (theme) => ({
  styleUri: '/media/issue.css',
  mermaidUri: '/media/mermaid.min.js',
  nonce: 'dev',
  // `'self'` where the editor would put `vscode-resource:` — the CSP stays REAL in dev,
  // so a violation shows up here instead of in the pane.
  cspSource: "'self'",
  devTheme: theme,
})

/** The index: every run, grouped by main, plus the two GitHub views. */
function index(all) {
  const rows = all
    .map(
      (run) => `<tr>
        <td><code>${run.main}</code></td>
        <td><a href="/run/${run.main}/${run.id}">${run.id}</a></td>
        <td>${run.units.length ? `${run.units.length}u` : ''} ${run.issues.length ? `${run.issues.length} issues` : ''} ${run.prs.length ? `${run.prs.length} PRs` : ''}</td>
      </tr>`,
    )
    .join('')

  const withIssue = all.find((run) => run.repo && run.issues.length)
  const withPr = all.find((run) => run.repo && run.prs.length)

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/media/issue.css"><link rel="stylesheet" href="/dev/macos.css">
<title>my · views</title></head>
<body class="bg-base-100 text-base-content font-sans p-8">
<h1 class="text-2xl font-semibold mb-1">my · as views</h1>
<p class="text-sm opacity-70 mb-6">hot reload ligado · <a class="link" href="?theme=dark">ver no escuro</a></p>
${
  withIssue
    ? `<p class="mb-2"><a class="btn btn-sm btn-primary" href="/issue/${withIssue.repo}/${withIssue.issues[0].number}">issue #${withIssue.issues[0].number}</a>
       ${withPr ? `<a class="btn btn-sm" href="/pr/${withPr.repo}/${withPr.prs[0].number}">PR #${withPr.prs[0].number}</a>` : ''}</p>`
    : ''
}
<table class="table table-sm mt-4"><thead><tr><th>main</th><th>run</th><th>tem</th></tr></thead><tbody>${rows}</tbody></table>
<script src="/dev/live.js"></script>
</body></html>`
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`)
  // `?fresh` forces a re-scan without restarting the server: the runs move while a lote is
  // in flight, and that is exactly when someone stares at this page.
  if (url.searchParams.has('fresh')) scanned = null
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'
  const send = (body, type = 'text/html; charset=utf-8') => {
    response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' })
    response.end(body)
  }

  try {
    if (url.pathname === '/dev/live') {
      // SSE: the page holds this open and reloads when a build lands.
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      })
      const tick = setInterval(() => response.write(': ping\n\n'), 15_000)
      const stop = watchers.add(() => response.write('data: reload\n\n'))
      request.on('close', () => {
        clearInterval(tick)
        stop()
      })
      return
    }

    if (url.pathname === '/dev/live.js') {
      return send(
        `new EventSource('/dev/live').onmessage = () => location.reload()`,
        'application/javascript; charset=utf-8',
      )
    }

    if (url.pathname === '/dev/macos.css') {
      return send(readFileSync(join(HERE, 'macos.css'), 'utf8'), 'text/css; charset=utf-8')
    }

    if (url.pathname.startsWith('/media/')) {
      const file = join(ROOT, url.pathname)
      if (!existsSync(file)) {
        response.writeHead(404)
        return response.end('sem build — roda `npm run compile`')
      }
      const type = file.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8'
      return send(readFileSync(file), type)
    }

    if (url.pathname === '/') return send(index(runs()))

    const run = url.pathname.match(/^\/run\/([^/]+)\/([^/]+)$/)
    if (run) {
      const [, main, id] = run
      const found = runs().find((candidate) => candidate.main === main && candidate.id === id)
      if (!found) {
        response.writeHead(404)
        return response.end('run não existe')
      }
      const { runView } = fresh('./out/webview/run.js')
      return send(runView(found, CHROME(theme)))
    }

    const issue = url.pathname.match(/^\/issue\/([^/]+)\/([^/]+)\/(\d+)$/)
    if (issue) {
      const [, owner, repo, number] = issue
      const { fetchIssue } = fresh('./out/gh/api.js')
      const { issueView } = fresh('./out/webview/issue.js')
      return send(issueView(await fetchIssue(`${owner}/${repo}`, number), CHROME(theme)))
    }

    const pull = url.pathname.match(/^\/pr\/([^/]+)\/([^/]+)\/(\d+)$/)
    if (pull) {
      const [, owner, repo, number] = pull
      const { fetchPull } = fresh('./out/gh/api.js')
      const { prView } = fresh('./out/webview/pr.js')
      return send(prView(await fetchPull(`${owner}/${repo}`, number), CHROME(theme)))
    }

    response.writeHead(404)
    response.end('nada aqui')
  } catch (failure) {
    // The error goes to the PAGE, not only to the terminal: the browser is where the eye
    // already is, and a blank tab says nothing.
    response.writeHead(500, { 'content-type': 'text/html; charset=utf-8' })
    response.end(
      `<pre style="font:13px ui-monospace;padding:2rem;white-space:pre-wrap">${String(failure.stack || failure).replace(/</g, '&lt;')}</pre><script src="/dev/live.js"></script>`,
    )
  }
})

/** Everyone waiting on a reload, and the watcher that wakes them. */
const watchers = {
  listeners: new Set(),
  add(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  },
  fire() {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        this.listeners.delete(listener)
      }
    }
  },
}

/** Debounced: `tsc` writes dozens of files per build, and each one is not a reload. */
let pending
function bump() {
  // The disk moved, so the memo is stale by definition.
  scanned = null
  clearTimeout(pending)
  pending = setTimeout(() => watchers.fire(), 120)
}

for (const dir of ['out', 'media']) {
  const path = join(ROOT, dir)
  if (existsSync(path)) watch(path, { recursive: true }, bump)
}

server.listen(PORT, () => {
  console.log(`my · views  →  http://localhost:${PORT}`)
  // Warm the scan at boot: the first click was paying the 3.8 s that every click used to.
  const started = Date.now()
  runs()
  console.log(`disco varrido em ${Date.now() - started}ms — os cliques agora são instantâneos`)
  console.log('deixa `npm run watch` rodando em outro pane; a página recarrega sozinha.')
})
