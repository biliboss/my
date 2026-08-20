//! The body GitHub already rendered.
//!
//! It goes in RAW, and that is a decision with a reason: `body_html` is sanitised by
//! GitHub before it leaves the API, it carries task lists, tables, code blocks, mentions
//! and mermaid SOURCE, and no script in it can run under our CSP because it has no
//! nonce. Rendering markdown ourselves would be reimplementing the one thing the API
//! gives away — measured at 13 373 characters for a single issue.

export function ghBody(html: string, extra = ''): string {
  return `<div class="gh-body ${extra}">${html || '<p><em>sem corpo</em></p>'}</div>`
}
