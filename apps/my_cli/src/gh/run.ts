//! The ONE place this house shells out to `gh` — from the Bun side.
//!
//!     const r = await ghJson<Row[]>(['pr', 'list', '--repo', repo, '--json', 'number'])
//!     if (!r.ok) throw new Error(`gh pr list ${repo}: ${r.error}`)
//!
//! Written in the mould of @src/herdr/run.ts, and for the same reason: five `gh`
//! shellouts lived in four files, none of them passed a `timeout`, and the 503
//! lesson existed in only two of the five.
//!
//! Three policies, in one place:
//!
//! 1. **A TIMEOUT, always.** A hung `gh` had no ceiling anywhere — the same hole
//!    that wedged the herdr router twice in ten minutes (10/08). 15 000 ms, and
//!    the number is MEASURED: eight calls on 19/08 (`pr list` ×5, `issue list` ×3,
//!    across `biliboss/me` and `mktvirtual/mukutu-mono`) ranged 0.34 s–0.63 s. The
//!    ceiling is ~24× the worst peak on purpose, and that is not slack for its own
//!    sake: `gh` also refreshes a token and resolves DNS, so a legitimate cold call
//!    is nothing like a warm one. This number exists to kill a HUNG process, never
//!    to enforce a latency budget — and the herdr header records what picking the
//!    tight number off a warm sample cost (3000 ms became its own outage).
//!
//! 2. **RETRY on 5xx**, three attempts, backing off 1 s · 2 s. Measured 17/08:
//!    `HTTP 503: No server is currently available` made two sprints come out
//!    `unknown`, on different runs each time. Third-party infra falling over is not
//!    an answer. Our own timeout retries too — a wedged call is exactly the case a
//!    second attempt fixes.
//!
//! 3. **NEVER throws.** A timeout, a missing binary and a 404 all come back as
//!    `{ ok: false, error }`, so a caller has one shape to branch on. Callers that
//!    want to throw still do, with their own message — the runner does not decide
//!    that for them.
//!
//! NOT importable from `src/extension/`: this uses `Bun.spawn`, and the extension
//! is deliberately Bun-free (it runs under `tsc`/node in the extension host). The
//! same policy lives there in @src/extension/gh/run.ts, which is node-only by
//! necessity, not by drift — the two headers point at each other.
//!
//! depends_on: —
//! impacts:    src/gh/issues.ts · src/gh/prs.ts · src/extension/gh/run.ts

/** ~24× the worst of eight measured calls (0.34s–0.63s, 19/08). See the header:
 *  this kills a hung process, it does not police latency. */
export const GH_TIMEOUT_MS = 15_000

export const GH_RETRIES = 3

export type GhResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** The failures worth trying again: GitHub's own 5xx, and a call that hung.
 *
 *  NOT 4xx — a 404 or a bad flag answers the same way three times, and retrying it
 *  only makes the user wait 3 s to read the same message. */
const RETRIABLE = /HTTP 5\d\d|timeout|timed out/i

export async function gh(
  args: string[],
  { timeoutMs = GH_TIMEOUT_MS, retries = GH_RETRIES }: { timeoutMs?: number; retries?: number } = {},
): Promise<GhResult<string>> {
  let last = 'gh never ran'
  for (let attempt = 0; attempt < retries; attempt++) {
    let erro: string
    try {
      const child = Bun.spawn(['gh', ...args], { stdout: 'pipe', stderr: 'pipe', timeout: timeoutMs })

      // The streams are drained CONCURRENTLY with `exited`, never after it: `gh issue
      // list --limit 400` is well past a 64 KB pipe buffer, and awaiting exit first
      // deadlocks the moment the child fills it.
      const finished = (async () => {
        const [texto, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()])
        await child.exited
        return { texto, stderr }
      })()

      // And the whole thing is raced against our OWN clock, because `timeout:` alone is
      // not enough — MEASURED while closing this task: a fake `gh` that shells out to
      // `sleep 300` was killed on schedule and the call still hung for two minutes,
      // because the GRANDCHILD kept the stdout pipe open and the stream read never
      // resolved. Bun kills the child it spawned, not the tree under it. Without this
      // race the timeout is decoration on exactly the case it exists for.
      const late = Symbol('late')
      const race = await Promise.race([finished, Bun.sleep(timeoutMs + 500).then(() => late)])
      if (race === late) {
        child.kill(9)
        erro = `gh ${args[0] ?? ''} timed out after ${timeoutMs}ms`
      } else {
        const { texto, stderr } = race as { texto: string; stderr: string }
        if (child.exitedDueToTimeout) erro = `gh ${args[0] ?? ''} timed out after ${timeoutMs}ms`
        else if (child.exitCode !== 0) erro = stderr.trim() || `gh exited ${child.exitCode}`
        else return { ok: true, data: texto }
      }
    } catch (failure) {
      // A missing `gh` lands here, and it is NOT retriable — three attempts at a
      // binary that does not exist is three times the same answer, slower.
      return { ok: false, error: failure instanceof Error ? failure.message : String(failure) }
    }

    last = erro
    if (!RETRIABLE.test(erro) || attempt === retries - 1) return { ok: false, error: erro }
    await Bun.sleep(1000 * (attempt + 1))
  }
  return { ok: false, error: last }
}

/** The same call, parsed. A `gh` that answers 0 with something that is not JSON is
 *  a failure like any other — before this, every site did `JSON.parse` inline and
 *  a truncated body threw a SyntaxError with no mention of `gh`. */
export async function ghJson<T>(
  args: string[],
  opts?: { timeoutMs?: number; retries?: number },
): Promise<GhResult<T>> {
  const out = await gh(args, opts)
  if (!out.ok) return out
  try {
    return { ok: true, data: JSON.parse(out.data) as T }
  } catch {
    return { ok: false, error: `gh printed no JSON: ${out.data.slice(0, 200)}` }
  }
}
