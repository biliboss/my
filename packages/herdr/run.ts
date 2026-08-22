//! The one place THIS PACKAGE shells out to herdr — the multiplexer where the
//! fleet lives. It carries the timeout and `--remote`, and everything under
//! `packages/herdr/` goes through it.
//!
//! It is not yet the only shellout in the monorepo: `apps/my` and `apps/my-wall`
//! each run their own `execFile("herdr", ...)` in `app/api/agents/route.ts`, with
//! no timeout and no remote. Extracting this package is what makes fixing those
//! an import instead of a third copy.
//!
//!     bun run src/herdr/run.ts workspace list
//!     my herdr workspaces list --remote fonseca-vps
//!
//! IT IS ALSO THE ONE PLACE THAT KNOWS ABOUT THE OTHER BOX. `--remote <host>` is
//! stripped by the router into `MY_HERDR_HOST` (@src/cli/core/router.ts) and read
//! here, so every verb that already calls `run()` speaks to the VPS with no flag
//! of its own. The alternative — a `--remote` declared on each of the fifteen
//! subverbs — is one decision written fifteen times, and the sixteenth verb is
//! born without it.
//!
//! herdr owns the sessions, workspaces, tabs and panes; its CLI prints one JSON
//! envelope per call. Every shellout goes through `run()` here, never through
//! `Bun.spawn` at a call site — the timeout is the whole point.
//!
//! Two lessons copied from `~/src/agency/scripts/herdr.ts`, both already paid for:
//!
//! 1. NEVER call herdr without a timeout. That router wedged twice in ten
//!    minutes (10/08) because one hung child froze the single JS thread. Hence
//!    async `Bun.spawn` and not the `spawnSync` that the old `fleet.ts`
//!    still uses — one hung `herdr agent list` there hangs the whole script.
//! 2. 9000ms, and the number is MEASURED. The first value was 3000ms, picked
//!    off a stale sample, and became its own outage. Fresh samples ranged
//!    0.78s–3.63s; 9000ms is ~2.5x the worst peak.
//!
//! Never throws. A timeout, a missing binary and a dead server all come back as
//! `{ ok: false }`, so a caller has one shape to branch on.
//!
//! depends_on: —
//! impacts:    src/herdr/workspaces/list.ts · src/herdr/tabs/list.ts · src/herdr/panes/read.ts · src/herdr/agents/list.ts · src/herdr/tabs/focus.ts · src/herdr/tabs/rename.ts · src/herdr/tabs/create.ts · src/herdr/tabs/close.ts · src/herdr/agents/start.ts · src/herdr/workspaces/focus.ts · src/herdr/workspaces/create.ts · src/herdr/workspaces/close.ts · src/herdr/panes/split.ts · src/herdr/panes/send.ts

export const HERDR_TIMEOUT_MS = 9000

/** O MESMO comando, na caixa de lá. O `ssh` acrescenta handshake e latência de
 *  rede a cada chamada, e 9000ms foi medido contra um herdr LOCAL — apertar o
 *  remoto no teto do local transformaria rede lenta em "servidor morto", que é
 *  a leitura errada mais cara que este módulo pode devolver. */
export const HERDR_REMOTE_TIMEOUT_MS = 30_000

/** QUAL CAIXA, e ela é UMA por processo.
 *
 *  Vem de `MY_HERDR_HOST`, que o roteador escreve quando alguém passa
 *  `--remote <host>` (@src/cli/core/router.ts) — assim TODO verbo que já chama
 *  `run()` fala remoto sem ganhar uma flag própria. Uma flag por verbo seria a
 *  mesma decisão escrita em quinze lugares, e o décimo sexto nasceria sem ela.
 *
 *  IDS DE PANE SÃO POR HOST, e nada avisa: `w1D:p3` aqui e `w1D:p3` na VPS são
 *  panes diferentes em máquinas diferentes. Por isso o host é do PROCESSO e não
 *  de uma chamada — misturar local e remoto no mesmo comando é como um id
 *  resolve na caixa errada. */
export const host = (): string | undefined => process.env.MY_HERDR_HOST || undefined

export async function run(
  args: string[],
  timeoutMs?: number,
): Promise<{ ok: boolean; stdout: string; error?: string }> {
  const remote = host()
  // `herdr` por CAMINHO ABSOLUTO no remoto: o `PATH` de uma sessão ssh
  // não-interativa não carrega `~/.local/bin`, e o `command not found` que volta
  // parece herdr fora do ar. `-o BatchMode=yes` porque um prompt de senha aqui
  // travaria o processo até o timeout, sem nada legível na saída.
  const argv = remote ? ['ssh', '-o', 'BatchMode=yes', remote, 'herdr', ...args] : ['herdr', ...args]
  const limit = timeoutMs ?? (remote ? HERDR_REMOTE_TIMEOUT_MS : HERDR_TIMEOUT_MS)
  try {
    const child = Bun.spawn(argv, { stdout: 'pipe', stderr: 'pipe', timeout: limit })
    const stdout = await new Response(child.stdout).text()
    await child.exited

    // `exitedDueToTimeout` is newer than the @types/bun this workspace pins.
    if ((child as { exitedDueToTimeout?: boolean }).exitedDueToTimeout) {
      const onde = remote ? ` em ${remote}` : ''
      return { ok: false, stdout: '', error: `herdr ${args.join(' ')}${onde} timed out after ${limit}ms` }
    }
    if (child.exitCode !== 0) {
      const stderr = await new Response(child.stderr).text()
      return { ok: false, stdout: '', error: stderr.trim() || `herdr exited ${child.exitCode}` }
    }
    return { ok: true, stdout }
  } catch (err) {
    return { ok: false, stdout: '', error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 *  herdr reports failures as a JSON envelope — sometimes on stdout with exit 0,
 *  sometimes on stderr with a non-zero exit. Either way the useful part is
 *  `error.message`; without this the caller gets the whole envelope escaped into
 *  a string, which is what `pane wZZ:p9 not found` looked like on first run.
 */
export function envelopeError(output: string): string | undefined {
  try {
    return JSON.parse(output)?.error?.message
  } catch {
    return undefined
  }
}

/**
 *  The `result` object of an envelope, or a failure that says what came instead.
 *
 *  Exit code alone is NOT the verdict: herdr answers 0 with an `error` envelope
 *  for a bad pane id, so both are checked here and nowhere else.
 */
export async function result(
  args: string[],
  timeoutMs?: number,
): Promise<{ ok: true; result: any } | { ok: false; error: string }> {
  const out = await run(args, timeoutMs)
  if (!out.ok) return { ok: false, error: envelopeError(out.error ?? '') ?? out.error ?? 'herdr failed' }

  const failure = envelopeError(out.stdout)
  if (failure) return { ok: false, error: failure }

  try {
    return { ok: true, result: JSON.parse(out.stdout)?.result }
  } catch {
    return { ok: false, error: `herdr printed no JSON: ${out.stdout.slice(0, 200)}` }
  }
}

/**
 *  A call whose only answer is "it worked" — focus, rename, close, send-keys.
 *
 *  It does NOT go through `result()`, and that is the whole reason it exists:
 *  `pane send-keys` prints an EMPTY stdout on success, so demanding JSON turned
 *  a working Enter into `herdr printed no JSON:` — measured 17/08, with the
 *  prompt sitting typed-but-unsubmitted in both panes of a comparison run.
 *
 *  So: no output is success here, and only an `error` envelope is failure.
 */
export async function did(args: string[], timeoutMs?: number): Promise<{ ok: boolean; error?: string }> {
  const out = await run(args, timeoutMs)
  if (!out.ok) return { ok: false, error: envelopeError(out.error ?? '') ?? out.error ?? 'herdr failed' }

  const failure = envelopeError(out.stdout)
  return failure ? { ok: false, error: failure } : { ok: true }
}

if (import.meta.main) {
  const out = await run(Bun.argv.slice(2))
  console.log(out.ok ? out.stdout : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
