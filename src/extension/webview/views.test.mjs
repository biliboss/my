//! The checks for the VIEWS: one per element, all over the same shell and parts.
//!
//!   node --test webview/views.test.mjs      (after `npm run compile`)
//!
//! Two rules live here and they pull in opposite directions: `body_html` from GitHub goes
//! in RAW (it is sanitised upstream, and it carries the markup the pane exists to show),
//! while everything WE interpolate is escaped. These tests are what keep the next edit
//! from swapping one for the other.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { issueView } = require('../out/webview/issue.js')
const { prView } = require('../out/webview/pr.js')

const CHROME = {
  styleUri: 'vscode-resource://media/issue.css',
  mermaidUri: 'vscode-resource://media/mermaid.min.js',
  nonce: 'abc123',
  cspSource: 'vscode-resource:',
}

const issue = (over = {}) => ({
  repo: 'a/b',
  number: 178,
  title: 'um título',
  state: 'open',
  author: 'biliboss',
  avatar: null,
  createdAt: '2026-08-17T18:00:00Z',
  url: 'https://github.com/a/b/issues/178',
  labels: [],
  assignees: [],
  bodyHtml: '<p>corpo</p>',
  comments: [],
  ...over,
})

const pull = (over = {}) => ({
  ...issue(),
  number: 291,
  ref: 'staging-U1',
  base: 'staging',
  draft: false,
  review: '',
  additions: 12,
  deletions: 3,
  changedFiles: 2,
  checks: [],
  ...over,
})

test('the CSP denies everything the pane does not need', () => {
  const html = issueView(issue(), CHROME)

  assert.match(html, /default-src 'none'/)
  // Avatars and pasted screenshots live on GitHub's CDN — an issue with a screenshot is
  // exactly the one someone opens a pane for.
  assert.match(html, /img-src vscode-resource: https: data:/)
  // Only nonce'd scripts run, so GitHub's own HTML never can.
  assert.match(html, /script-src 'nonce-abc123'/)
})

test('what we interpolate is escaped; what GitHub rendered is not', () => {
  const html = issueView(
    issue({ title: '<img src=x onerror=alert(1)>', bodyHtml: '<p>já <strong>renderizado</strong></p>' }),
    CHROME,
  )

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.ok(!html.includes('<img src=x onerror'))
  assert.match(html, /<p>já <strong>renderizado<\/strong><\/p>/)
})

test('mermaid ships locally, and only loads on a page that HAS a diagram', () => {
  // 3.5 MB of script on a view with no diagram in it is a tax paid for nothing.
  const without = issueView(issue({ bodyHtml: '<p>sem diagrama</p>' }), CHROME)
  assert.ok(!without.includes('mermaid.min.js'), 'não devia carregar mermaid sem diagrama')

  // GitHub returns the diagram as SOURCE, so the pane renders it: a CDN is unreachable
  // under this CSP, which is why the file travels with the extension.
  const withDiagram = issueView(issue({ bodyHtml: '<pre lang="mermaid">graph TD</pre>' }), CHROME)
  assert.match(withDiagram, /src="vscode-resource:\/\/media\/mermaid\.min\.js"/)
  assert.match(withDiagram, /pre\[lang="mermaid"\]/)
  // The theme follows the editor: a light diagram on a dark pane is worse than none.
  assert.match(withDiagram, /vscode-dark/)
})

test('the layout is full width, and stacks below lg', () => {
  const html = issueView(issue(), CHROME)

  // A developer tool on a wide screen: no centred 48rem column.
  assert.ok(!html.includes('max-w-3xl'))
  assert.match(html, /class="w-full px-6/)
  assert.match(html, /flex flex-col lg:flex-row/)
})

test('a label keeps the colour GitHub gave it, and picks readable ink', () => {
  const html = issueView(issue({ labels: [{ name: 'bug', color: 'd73a4a' }, { name: 'pastel', color: 'BFD4F2' }] }), CHROME)

  assert.match(html, /background:#d73a4a;color:#ffffff/)
  // White on pastel is the unreadable case, and half the labels in this house are pastel.
  assert.match(html, /background:#BFD4F2;color:#1b1f23/)
})

test('an empty issue still renders, and says what is missing', () => {
  const html = issueView(issue({ bodyHtml: '', comments: [] }), CHROME)
  assert.match(html, /sem corpo/)
  assert.match(html, /Nenhum comentário/)
})

test('the sandbox says out loud that it is a fixture', () => {
  assert.match(issueView(issue({ fixture: true }), CHROME), /fixture · sandbox/)
})

test('the PR view leads with the checks, named one per line', () => {
  const html = prView(
    pull({
      checks: [
        { name: 'mypy', status: 'completed', conclusion: 'FAILURE' },
        { name: 'pytest', status: 'completed', conclusion: 'SUCCESS' },
        { name: 'docs', status: 'completed', conclusion: 'SKIPPED' },
      ],
    }),
    CHROME,
  )

  assert.match(html, /Checks/)
  assert.match(html, /mypy/)
  assert.match(html, /1 check falhando/)
  // The tree answers "1 falhou"; the pane exists for "which one".
  assert.match(html, /badge-error/)
  // Skipped is dimmed, not coloured: this house skips five jobs per PR.
  assert.match(html, /badge-ghost/)
})

// The bug this test exists for, measured 19/08: the headline classified with
// `conclusion === 'FAILURE'` alone, so a PR whose only problem was TIMED_OUT (or
// ACTION_REQUIRED) showed NO red badge while the row right below it showed `✗` and the
// unit column painted its border red. The same screen contradicted itself.
test('a TIMED_OUT check is failed in the headline too, not only in the row', () => {
  const html = prView(
    pull({
      checks: [
        { name: 'e2e', status: 'completed', conclusion: 'TIMED_OUT' },
        { name: 'pytest', status: 'completed', conclusion: 'SUCCESS' },
      ],
    }),
    CHROME,
  )

  assert.match(html, /1 check falhando/)
  assert.match(html, /badge-error/)
})

test('ACTION_REQUIRED counts too, and SKIPPED never does', () => {
  const html = prView(
    pull({
      checks: [
        { name: 'deploy', status: 'completed', conclusion: 'ACTION_REQUIRED' },
        { name: 'lint', status: 'completed', conclusion: 'TIMED_OUT' },
        { name: 'docs', status: 'completed', conclusion: 'SKIPPED' },
        { name: 'flaky', status: 'completed', conclusion: 'CANCELLED' },
      ],
    }),
    CHROME,
  )

  // Two failed, and the two that had nothing to do stay out of the count — otherwise
  // half the house turns red, since this run skips five jobs per PR.
  assert.match(html, /2 checks falhando/)
})

// CONTROLE NEGATIVO: a PR that is merely RUNNING must not read as broken.
test('a queued check is pending, not failed', () => {
  const html = prView(
    pull({ checks: [{ name: 'e2e', status: 'QUEUED', conclusion: '' }] }),
    CHROME,
  )

  assert.doesNotMatch(html, /check falhando/)
  assert.match(html, /badge-info/)
})

test('the PR view shows the branch pair and the diff size', () => {
  const html = prView(pull(), CHROME)

  assert.match(html, /staging-U1 → staging/)
  assert.match(html, /\+12/)
  assert.match(html, /−3/)
  assert.match(html, /2 arquivos/)
})

test('a draft PR is a draft, whatever its state says', () => {
  assert.match(prView(pull({ draft: true }), CHROME), /DRAFT/)
})

// ── as views de run, uma por main ──────────────────────────────────────────────

const { productRunView } = require('../out/webview/run_product.js')
const { codingRunView } = require('../out/webview/run_coding.js')
const { qaRunView } = require('../out/webview/run_qa.js')
const { mermaidBlocks, callstackBlock } = require('../out/webview/parts/callstack_block.js')
const { markdownLite, inline, sections } = require('../out/webview/parts/markdown_lite.js')
const { docSections, docIndex } = require('../out/webview/parts/doc_sections.js')

const page = (over = {}) => ({
  run: {
    main: '02_product',
    id: '980_um_run',
    dir: '/x',
    state: { at: 'do-sprints', subject: 'um assunto' },
    hasState: true,
    taskMinutes: [4, 3],
    t0: null,
    commits: [],
    units: [],
    prs: [],
    done: new Map(),
    planFrom: null,
    repo: null,
    label: null,
    issues: [],
    ...(over.run ?? {}),
  },
  plan: {
    label: 'run/980_um_run',
    repo: null,
    projeto: 'src/extension',
    desenho: null,
    sprints: [],
    coverage: [],
    outOfScope: [],
    declaredDeviation: [],
    ...(over.plan ?? {}),
  },
  batch: { refused: [], parked: [], ...(over.batch ?? {}) },
  desenho: over.desenho ?? null,
  summary: over.summary ?? null,
  artefacts: over.artefacts ?? [],
  reproFiles: over.reproFiles ?? [],
})

test('the product view leads with sprint · task · proof', () => {
  const html = productRunView(
    page({
      plan: {
        sprints: [
          {
            id: 'S1',
            titulo: 'a árvore lê a pasta do run',
            duration: '9 min',
            minutes: 9,
            unidade: 'src/my_view.ts',
            issue: null,
            tasks: [
              { title: 'scanRuns() varre os runs', description: null, duration: '4 min', minutes: 4, proof: 'node --test out/my_view.test.js', references: [] },
            ],
          },
        ],
        coverage: [{ id: 'E1', where: 'sprint 1' }],
        outOfScope: [{ item: 'webview com histograma', porQue: 'TreeView não tem pixel' }],
      },
    }),
    CHROME,
  )

  assert.match(html, /S1/)
  assert.match(html, /a árvore lê a pasta do run/)
  // The proof is the whole reason the view exists: it was on disk and never on a screen.
  assert.match(html, /node --test out\/my_view\.test\.js/)
  assert.match(html, /coverage · 1 ids/)
  // Out of scope WITH its reason, which is the half nobody sees.
  assert.match(html, /TreeView não tem pixel/)
})

test('a task closed by a commit gets a tick and the hash', () => {
  // The mark `[S1/T1]` in the subject is what says which task closed — 13 commits of the
  // live fan-out carry one, and until now the card had no way to show it.
  const html = productRunView(
    page({
      run: { done: new Map([['S1/T1', { hash: 'd88d541', at: Date.now(), subject: 'fix: algo [S1/T1]', task: 'S1/T1' }]]) },
      plan: {
        sprints: [
          {
            id: 'S1',
            titulo: 'a primeira',
            duration: '9 min',
            minutes: 9,
            unidade: null,
            issue: null,
            tasks: [
              { title: 'a task fechada', description: null, duration: '4 min', minutes: 4, proof: 'node --test', references: [] },
              { title: 'a task aberta', description: null, duration: '3 min', minutes: 3, proof: 'node --test', references: [] },
            ],
          },
        ],
      },
    }),
    CHROME,
  )

  assert.match(html, /✓/)
  assert.match(html, /d88d541/)
  // The open one stays hollow: a plan that marks everything done proves nothing.
  assert.match(html, /○/)
  assert.match(html, /1 fechada/)
})

test('a product run with no plan says so instead of rendering an empty page', () => {
  assert.match(productRunView(page(), CHROME), /não tem <code>sprints\.yaml<\/code>/)
})

test('the coding view puts one column per unit, and shows what was refused', () => {
  const html = codingRunView(
    page({
      run: {
        main: '01_coding',
        units: [
          { id: 'S1', branch: 'staging/U1', ref: 'staging-U1', issue: '284', estado: 'pr_aberto', ahead: 3, last: { hash: 'a', at: Date.now(), subject: 'fix(x): algo', task: null } },
          { id: 'S3', branch: 'staging/U3', ref: null, issue: '286', estado: 'rodando', ahead: 0, last: null },
        ],
        prs: [{ number: '291', ref: 'staging-U1', state: 'OPEN', draft: false, review: '', checks: { ok: 2, failed: 1, pending: 0 }, url: '' }],
      },
      batch: {
        refused: [{ id: 'S5', issue: '288', porQue: 'pnpm --filter broker-web não casa pacote nenhum' }],
        parked: [{ id: 'S6', issue: '289', porQue: 'espera duas decisões' }],
      },
    }),
    CHROME,
  )

  assert.match(html, /S1/)
  assert.match(html, /#291/)
  // The unit whose declared branch does not exist is the state that cost the most to find.
  assert.match(html, /o branch declarado não existe/)
  // Refusals and parked sprints, with the reason — written the day it happened, never shown.
  assert.match(html, /recusadas · 1/)
  assert.match(html, /broker-web/)
  assert.match(html, /parqueadas · 1/)
})

test('the qa view puts the clean-tree control ABOVE the verdict', () => {
  const html = qaRunView(
    page({
      run: { main: '03_qa', id: '999_qa' },
      summary: '# 999_qa\n\n## O gate já falha no `staging` LIMPO\n\nUma worktree solta.\n\n- U1 passou\n',
      reproFiles: ['178.md'],
    }),
    CHROME,
  )

  const controlAt = html.indexOf('alert-warning')
  const verdictAt = html.indexOf('U1 passou')
  assert.ok(controlAt > 0 && verdictAt > controlAt, 'o controle tem que vir ANTES do veredito')
  assert.match(html, /repro\/178\.md/)
})

test('the call stack renders only when the drawing has a diagram', () => {
  const markdown = '# um desenho\n\n```mermaid\ngraph TD\n  A-->B\n```\n\ntexto\n'
  assert.deepEqual(mermaidBlocks(markdown), ['graph TD\n  A-->B'])
  assert.match(callstackBlock('features/x.md', markdown), /<pre lang="mermaid"/)
  // Prose with no diagram renders nothing at all, rather than an empty card.
  assert.equal(callstackBlock('features/x.md', '# só texto\n'), '')

  // A pointer at a file that is NOT there is a finding, not an absence: run 980 pointed at
  // a drawing a refactor had moved, and the section vanishing is how nobody noticed.
  const dead = callstackBlock('features/foi_movido.md', null)
  assert.match(dead, /aponta pro vazio/)
  assert.match(dead, /features\/foi_movido\.md/)
})

test('markdownLite covers what this house writes, and turns mermaid into a diagram', () => {
  const html = markdownLite('## um título\n\n- um item\n\n> uma citação\n\n```mermaid\ngraph TD\n```\n')

  assert.match(html, /<h2[^>]*>um título<\/h2>/)
  assert.match(html, /<li>um item<\/li>/)
  assert.match(html, /blockquote/)
  // A local file has no `body_html`, so the fence becomes the same tag the shell boots.
  assert.match(html, /<pre lang="mermaid"/)
})

test('inline marks render instead of printing themselves', () => {
  // The first screenshot showed `**Gate que falha**` literally on screen.
  assert.match(inline('**forte**'), /<strong[^>]*>forte<\/strong>/)
  assert.match(inline('um `comando`'), /<code[^>]*>comando<\/code>/)
  assert.match(inline('[issue #294](https://github.com/a/b/issues/294)'), /<a class="link link-primary" href="https:\/\/github/)
  // Bold INSIDE a code span stays literal: the span wins, or `**mypy**` in a shell line
  // comes out bolded and wrong.
  assert.ok(!inline('`**mypy**`').includes('<strong'))
  // And escaping still happens first.
  assert.match(inline('<script>'), /&lt;script&gt;/)
})

test('a bold mark that spans a line break still renders — the file is hard-wrapped', () => {
  // Measured on the QA summary: `**` opened on one line and closed on the next, so four
  // pairs of asterisks printed themselves on screen. Consecutive lines are ONE paragraph.
  const html = markdownLite('o motivo é um só: **`galgal.kernel` não tem\nmarca `py.typed`.** A U3 não errou\n')

  assert.match(html, /<strong[^>]*>/)
  assert.ok(!html.includes('**'), 'nenhum asterisco cru pode sobrar')
  // And a blank line still ends the paragraph, which is the only thing that should.
  assert.equal((markdownLite('um\n\ndois\n').match(/<p /g) ?? []).length, 2)
})

test('a pipe table becomes a table — it was rendering as rows of pipes', () => {
  const html = markdownLite('| PR | veredito |\n|---|---|\n| #291 | **não aprova** |\n')

  assert.match(html, /<table/)
  assert.match(html, /<th[^>]*>PR<\/th>/)
  assert.match(html, /<td[^>]*>#291<\/td>/)
  assert.match(html, /<strong[^>]*>não aprova<\/strong>/)
  // Six columns must never widen the page.
  assert.match(html, /overflow-x-auto/)
})

test('a long document is cut at its headings, first section open', () => {
  const doc = '# título\n\nintro\n\n## primeira\n\ncorpo um\n\n## segunda\n\ncorpo dois\n'
  const cut = sections(doc)

  assert.equal(cut.sections.length, 2)
  assert.equal(cut.intro, 'intro')

  const html = docSections(doc)
  // `<details>` and not a script: only nonce'd code runs in a webview.
  assert.equal((html.match(/<details/g) ?? []).length, 2)
  assert.equal((html.match(/ open>/g) ?? []).length, 1, 'só a primeira abre')
  // A page of nine closed rows looks broken; an index makes the length navigable.
  assert.match(docIndex(doc), /2 seções/)
  assert.match(docIndex(doc), /href="#primeira-0"/)

  // One section is not a document with sections: it renders plain.
  assert.ok(!docSections('# só\n\ncorpo\n').includes('<details'))
})

test('escape covers the five, not just `<` — the pane error body used to leak `"` and `&`', () => {
  // `gh/pane.ts` hand-rolled `message.replace(/</g, '&lt;')` in both error bodies. That
  // string is the `gh` process's own output — data from OUTSIDE — so a message carrying
  // a quote or an ampersand reached the panel unescaped. Both call `escape()` now.
  const { escape } = require('../out/webview/shell.js')

  assert.equal(escape('<img src=x>'), '&lt;img src=x&gt;')
  // The three the `<`-only version let through:
  assert.equal(escape('gh: "repo" & co'), 'gh: &quot;repo&quot; &amp; co')
  assert.equal(escape("it's"), 'it&#39;s')

  // The order matters: escaping `&` after `<` would double-encode the `&lt;` it just
  // wrote, and the pane would print the entity instead of the character.
  assert.equal(escape('a < b & c'), 'a &lt; b &amp; c')

  // A realistic `gh` failure, which is the payload this actually protects.
  const real = 'HTTP 404: Not Found (https://api.github.com/repos/a&b/issues/1) — try `gh auth status`'
  assert.ok(!escape(real).includes('&b/'), 'o & cru não sobra')
  assert.ok(!escape(real).includes('<'), 'nada de tag')
})
