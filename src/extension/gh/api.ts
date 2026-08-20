//! One issue, as GitHub itself renders it.
//!
//! `gh api` with `Accept: application/vnd.github.html+json` answers `body_html` — the
//! body already turned into HTML by GitHub, sanitised, with task lists, mentions, code
//! blocks and tables intact. Measured on `mktvirtual/mukutu-mono#178`: 13 373
//! characters. That is why this extension has no markdown dependency and does not need
//! one: writing a renderer would be reimplementing the only part the API gives away.
//!
//! `gh` and not `fetch`: half these issues live in private repos, and the CLI is the
//! one thing here that is already authenticated. A webview has no credential at all.
//!
//! No `vscode` import, so the parsing is reachable from `node --test`.

import { ghAsync } from './run.js'
import { log, whyFailed } from '../log.js'

export interface IssueComment {
  author: string
  avatar: string | null
  createdAt: string
  bodyHtml: string
}

export interface IssueDetail {
  repo: string
  number: number
  title: string
  state: string
  author: string
  avatar: string | null
  createdAt: string
  url: string
  labels: { name: string; color: string }[]
  assignees: string[]
  bodyHtml: string
  comments: IssueComment[]
  /** True when the content is a fixture: the sandbox never talks to GitHub. */
  fixture?: boolean
}

/** Whatever `gh api` answers, before it is trusted. */
interface RawIssue {
  number?: number
  title?: string
  state?: string
  body_html?: string
  html_url?: string
  created_at?: string
  user?: { login?: string; avatar_url?: string }
  labels?: { name?: string; color?: string }[]
  assignees?: { login?: string }[]
}

interface RawComment {
  user?: { login?: string; avatar_url?: string }
  created_at?: string
  body_html?: string
}

/**
 * Both payloads into one shape.
 *
 * Every field is optional on the way in and defaulted on the way out: an issue with no
 * body, no labels and no assignees is a real issue, and a pane that throws on it would
 * fail exactly when someone is opening a fresh one.
 */
export function toIssueDetail(repo: string, raw: RawIssue, rawComments: RawComment[] = []): IssueDetail {
  return {
    repo,
    number: raw.number ?? 0,
    title: raw.title ?? '(sem título)',
    state: raw.state ?? 'unknown',
    author: raw.user?.login ?? 'alguém',
    avatar: raw.user?.avatar_url ?? null,
    createdAt: raw.created_at ?? '',
    url: raw.html_url ?? `https://github.com/${repo}/issues/${raw.number ?? ''}`,
    labels: (raw.labels ?? [])
      .filter((label) => label.name)
      .map((label) => ({ name: label.name as string, color: label.color ?? '888888' })),
    assignees: (raw.assignees ?? []).map((who) => who.login).filter((login): login is string => Boolean(login)),
    bodyHtml: raw.body_html ?? '',
    comments: rawComments.map((comment) => ({
      author: comment.user?.login ?? 'alguém',
      avatar: comment.user?.avatar_url ?? null,
      createdAt: comment.created_at ?? '',
      bodyHtml: comment.body_html ?? '',
    })),
  }
}

const HTML_ACCEPT = 'Accept: application/vnd.github.html+json'

/** `gh api <path>`, promisified. Rejects with stderr, which is what a human can act on. */
function ghApi(path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Through the runner (`gh/run.ts`), which owns the timeout, the 5xx retry and the
    // 5 MB buffer. This site had no timeout and no retry — a hung `gh api` left the
    // pane on "carregando…" forever, with nothing to cancel it.
    void ghAsync(['api', path, '-H', HTML_ACCEPT]).then((out) => {
      if (!out.ok) return reject(new Error(out.error))
      try {
        resolve(JSON.parse(out.stdout))
      } catch {
        reject(new Error('`gh api` devolveu algo que não é JSON'))
      }
    })
  })
}

/** The issue and its comments, in two calls — the API keeps them apart. */
export async function fetchIssue(repo: string, number: string): Promise<IssueDetail> {
  const issue = (await ghApi(`repos/${repo}/issues/${number}`)) as RawIssue
  // A thread is a separate resource; an issue with none answers `[]`, not an error.
  const comments = (await ghApi(`repos/${repo}/issues/${number}/comments`)) as RawComment[]
  return toIssueDetail(repo, issue, Array.isArray(comments) ? comments : [])
}

export interface CheckRun {
  name: string
  status: string
  conclusion: string
}

export interface PullDetail extends Omit<IssueDetail, 'fixture'> {
  ref: string
  base: string
  draft: boolean
  review: string
  additions: number
  deletions: number
  changedFiles: number
  checks: CheckRun[]
}

interface RawPullDetail extends RawIssue {
  head?: { ref?: string; sha?: string }
  base?: { ref?: string }
  draft?: boolean
  additions?: number
  deletions?: number
  changed_files?: number
}

/**
 * One PR, with its checks named.
 *
 * The tree already knows the ROLLUP (`3 ok, 1 falhou`); the pane exists for the next
 * question, which is WHICH one failed. That answer lives on the head commit, not on the
 * PR, so it takes a third call — and it is worth exactly one call, because a red PR with
 * no name attached is a click into GitHub anyway.
 */
export async function fetchPull(repo: string, number: string): Promise<PullDetail> {
  const raw = (await ghApi(`repos/${repo}/pulls/${number}`)) as RawPullDetail
  const comments = (await ghApi(`repos/${repo}/issues/${number}/comments`)) as RawComment[]

  let checks: CheckRun[] = []
  if (raw.head?.sha) {
    try {
      const runs = (await ghApi(`repos/${repo}/commits/${raw.head.sha}/check-runs`)) as {
        check_runs?: { name?: string; status?: string; conclusion?: string }[]
      }
      checks = (runs.check_runs ?? []).map((run) => ({
        name: run.name ?? '?',
        status: run.status ?? '',
        conclusion: run.conclusion ?? '',
      }))
    } catch (failure) {
      // A PR whose checks cannot be read is still a PR worth showing — the body and the
      // review are the other two thirds of the answer.
      //
      // Logged all the same: `checks = []` renders identically to a PR that has no CI
      // configured, so without this line a rate limit or a token without `repo` scope
      // looks like a deliberate absence of checks.
      log().warn(`gh api check-runs ${repo}@${raw.head.sha.slice(0, 7)}: ${whyFailed(failure)} — the PR draws with no checks`)
      checks = []
    }
  }

  const detail = toIssueDetail(repo, raw, Array.isArray(comments) ? comments : [])
  return {
    ...detail,
    ref: raw.head?.ref ?? '?',
    base: raw.base?.ref ?? '?',
    draft: Boolean(raw.draft),
    // `reviewDecision` is a GraphQL field; the REST payload does not carry it, so the row
    // keeps that answer and the pane says what it can see.
    review: '',
    additions: raw.additions ?? 0,
    deletions: raw.deletions ?? 0,
    changedFiles: raw.changed_files ?? 0,
    checks,
  }
}
