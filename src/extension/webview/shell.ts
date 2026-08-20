//! The SHELL every view is served in: the document, the CSP, the theme, the bridge.
//!
//! One file so no view repeats a security decision. A view returns the `<main>` and
//! nothing else — the meta tags, the stylesheet, the nonce and the button bridge are
//! decided here, once, and a mistake in them is a mistake in one place.
//!
//! FULL WIDTH on purpose. This is a developer tool, and the reader has a 27" screen with
//! a diff on it: a 48rem column centred in the middle wastes the two thirds where the
//! detail lives. The layout is fluid and the only cap is on line length inside prose,
//! which is a readability limit rather than a layout one.

/** Anything interpolated into an attribute or a text node goes through here. */
export function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface ShellOptions {
  title: string
  /** The compiled stylesheet, already through `asWebviewUri`. */
  styleUri: string
  /** The bundled mermaid, already through `asWebviewUri`. Omit to skip diagram support. */
  mermaidUri?: string
  /** CSP nonce for the two inline scripts (bridge and mermaid boot). */
  nonce: string
  /** The webview's own CSP source. */
  cspSource: string
  /**
   * Set ONLY by the dev server (`npm run dev`), never by the extension.
   *
   * A browser injects none of the `--vscode-*` variables the views are built on, so the
   * dev loop supplies them from `dev/macos.css` — macOS light by default, dark on
   * `?theme=dark`. Inside the editor this stays undefined and the real theme wins.
   */
  devTheme?: 'light' | 'dark'
}

/**
 * The CSP, and why each line is what it is.
 *
 * `img-src https:` because avatars and pasted screenshots live on GitHub's CDN, and an
 * issue with a screenshot is exactly the one someone opens a pane for. `style-src`
 * allows inline because mermaid writes inline styles into the SVG it generates. Scripts
 * need the nonce, so GitHub's own HTML — which arrives with no nonce — can never run,
 * even though it is already sanitised upstream.
 */
function csp(options: ShellOptions): string {
  return [
    `default-src 'none'`,
    `img-src ${options.cspSource} https: data:`,
    `style-src ${options.cspSource} 'unsafe-inline'`,
    `font-src ${options.cspSource} https: data:`,
    `script-src 'nonce-${options.nonce}'`,
  ].join('; ')
}

/**
 * Mermaid, rendered by us.
 *
 * GitHub returns the diagram as SOURCE — measured: `<pre lang="mermaid" aria-label="Raw
 * mermaid code">` inside a `js-render-enrichment-target` div, because github.com renders
 * it client-side. So a pane that only prints `body_html` shows the code of every diagram
 * this house writes into its issues. 3.4 MB of mermaid ships with the extension; it never
 * touches the network, which is the only way it could work under this CSP at all.
 *
 * And it is only INCLUDED when the page actually has a diagram: 3.5 MB of script on a
 * view with no mermaid in it is a tax paid for nothing.
 */
function mermaidBoot(uri: string, nonce: string): string {
  return `
<script nonce="${nonce}" src="${escape(uri)}"></script>
<script nonce="${nonce}">
  const blocks = document.querySelectorAll('pre[lang="mermaid"]')
  for (const block of blocks) {
    const holder = document.createElement('div')
    holder.className = 'mermaid my-3 flex justify-center'
    holder.textContent = block.textContent
    block.replaceWith(holder)
  }
  if (blocks.length && window.mermaid) {
    const dark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast')
    window.mermaid.initialize({
      startOnLoad: false,
      // The editor's theme decides, because a light diagram on a dark pane is the one
      // thing worse than no diagram.
      theme: dark ? 'dark' : 'default',
      fontFamily: 'var(--vscode-font-family)',
      securityLevel: 'strict',
    })
    window.mermaid.run({ querySelector: '.mermaid' })
  }
</script>`
}

export function shell(body: string, options: ShellOptions): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp(options)}">
<link rel="stylesheet" href="${escape(options.styleUri)}">
${options.devTheme ? '<link rel="stylesheet" href="/dev/macos.css">' : ''}
<title>${escape(options.title)}</title>
</head>
<body class="bg-base-100 text-base-content font-sans${options.devTheme === 'dark' ? ' vscode-dark' : ''}">
${body}
<script nonce="${options.nonce}">
  // The only bridge: buttons talk back to the extension. Under this CSP the page cannot
  // navigate anywhere by itself, so the host does it.
  // In the dev server there is no host to talk to, and a missing bridge must not take the
  // page down with it — the design is the point there, not the actions.
  const api = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null
  for (const button of document.querySelectorAll('[data-do]')) {
    button.addEventListener('click', () => api?.postMessage({ do: button.dataset.do, arg: button.dataset.arg }))
  }
</script>
${options.mermaidUri && body.includes('lang="mermaid"') ? mermaidBoot(options.mermaidUri, options.nonce) : ''}
${options.devTheme ? `<script nonce="${options.nonce}" src="/dev/live.js"></script>` : ''}
</body>
</html>`
}
