import { readFileSync } from 'node:fs'
import { HERDR_TIMEOUT_MS, result } from '../run.ts'
import { create as createTab } from '../tabs/create.ts'
import { send as sendToPane } from '../panes/send.ts'
import { fence } from '../policy.ts'
import { upstream, type Fail } from "@my/shared/result"
import { value } from "@my/shared/argv"

const DEFAULTS = { kind: 'claude', model: 'opus', effort: 'medium', timeoutMs: 120_000 }

/** `@caminho` lê do disco; qualquer outra coisa é o texto mesmo. */
function text(v: string): string {
  if (!v.startsWith('@')) return v
  const path = v.slice(1).replace(/^~/, process.env.HOME ?? '~')
  return readFileSync(path, 'utf8')
}

/** `--system @arquivo` vira `--append-system-prompt-file <arquivo>`; texto solto
 *  vira `--append-system-prompt <texto>`.
 *
 *  A flag de ARQUIVO existe no `claude` e não aparece no `--help` — medido em
 *  17/08 rodando `claude --append-system-prompt-file /dev/null -p "responda ok"`,
 *  que respondeu `ok`. Ela é o que resolve de vez o limite do argv: colar 77
 *  linhas fazia o herdr recusar com `agent arguments cannot be encoded safely
 *  for the target shell`.
 *
 *  Antes disso este código mandava um PONTEIRO — uma frase dizendo "leia tal
 *  arquivo". Funcionava e era pior: dependia de o agente obedecer uma instrução
 *  de usuário pra carregar o que devia ser instrução de sistema. */
function systemArgs(v: string): string[] {
  if (!v.startsWith('@')) return ['--append-system-prompt', v]
  const path = v.slice(1).replace(/^~/, process.env.HOME ?? '~')
  return ['--append-system-prompt-file', path.startsWith('/') ? path : `${process.cwd()}/${path}`]
}

export type Started = { ok: true; name: string; pane: string; tab?: string; model: string; effort: string; cwd?: string }

export async function start(
  name: string,
  opts: {
    workspace?: string
    pane?: string
    tab?: string
    kind?: string
    model?: string
    effort?: string
    cwd?: string
    /** `--permission-mode` do vendor. Ausente mantém o `--dangerously-skip-permissions`
     *  que esta casa sempre usou — trocar o default calado mudaria o comportamento
     *  de todo agente que já sobe hoje. */
    permission?: string
    prompt?: string
    system?: string
    args?: string[]
  },
): Promise<Started | (Fail & { tab?: string; pane?: string })> {
  let pane = opts.pane
  let tab: string | undefined

  if (!opts.prompt) {
    return { ok: false, reason: 'not_found', error: 'pass --prompt: an agent with no ask is a pane nobody knows the state of' }
  }

  if (pane) {
    // `--cwd` só tem efeito criando o pane. Com um pane pronto ele seria aceito
    // e ignorado, que é pior do que recusar.
    if (opts.cwd) {
      return { ok: false, reason: 'not_found', error: '--cwd only applies when this call creates the pane; with --pane the cwd belongs to whoever opened it' }
    }
    const fenced = fence(pane)
    if (fenced) return fenced
    // Com `--workspace` o `MY_AGENT` entra pelo `--env` da aba; com `--pane` a
    // aba já existe e não dá. Mas o pane AINDA É UM SHELL neste instante — o
    // agente sobe depois — então exportar aqui é a mesma coisa, uma linha antes.
    await sendToPane(pane, `export MY_AGENT=${name}`)
  } else {
    if (!opts.workspace) {
      return { ok: false, reason: 'not_found', error: 'pass --workspace or --pane' }
    }
    // `tabs/create` resolve o workspace por id ou label e checa a cerca, então
    // nada disso se repete aqui.
    // `MY_AGENT` no ambiente do PANE, e não uma flag que o agente lembra de
    // passar: medido em 17/08, o primeiro agente da frota respondeu no barramento
    // assinando `gabriel`, porque `send` cai pro humano quando a variável não
    // existe. Identidade que depende de disciplina do agente é identidade errada.
    const made = await createTab({
      workspace: opts.workspace,
      label: opts.tab ?? name,
      cwd: opts.cwd,
      env: { MY_AGENT: name },
    })
    if (!made.ok) return made
    tab = made.id
    pane = made.pane
  }

  const model = opts.model ?? DEFAULTS.model
  const effort = opts.effort ?? DEFAULTS.effort
  const args = [
    'agent', 'start', name,
    '--kind', opts.kind ?? DEFAULTS.kind,
    '--pane', pane,
    '--timeout', String(DEFAULTS.timeoutMs),
    '--', '--model', model, '--effort', effort,
    ...(opts.permission ? ['--permission-mode', opts.permission] : ['--dangerously-skip-permissions']),
    ...(opts.system ? systemArgs(opts.system) : []),
    ...(opts.args ?? []),
    text(opts.prompt),
  ]

  // A espera do próprio herdr pode chegar no timeout; a nossa tem que DURAR
  // mais, senão reportamos timeout de herdr pra um agente que ainda subia bem.
  const out = await result(args, DEFAULTS.timeoutMs + HERDR_TIMEOUT_MS)
  if (!out.ok) return { ...upstream(out.error), tab, pane }

  return { ok: true, name, pane, tab, model, effort, cwd: opts.cwd }
}

/**
 *  `start`, mas esperando o pane virar shell.
 *
 *  O pane recém-nascido ainda NÃO é um shell no instante em que o script chega
 *  nele — medido em 17/08: `agent target pane w3R:p1 is not an available shell`,
 *  logo depois de um `workspace create` que respondeu ok. Não é bug do herdr: ele
 *  responde a verdade do instante. É corrida entre criar o pane e o shell chegar
 *  no prompt, e a resposta certa é esperar.
 *
 *  Só ESTE erro é retentado. Argv errado retentado dez vezes é dez vezes o mesmo
 *  timeout, e um `agent start` verifica de verdade — cada tentativa custa a espera
 *  inteira.
 */
export async function startWhenReady(
  name: string,
  opts: Parameters<typeof start>[1],
  tries = 10,
): ReturnType<typeof start> {
  let where = opts
  for (let i = 0; ; i++) {
    const out = await start(name, where)
    if (out.ok || i >= tries || !out.error.includes('not an available shell')) return out

    // REUSE THE PANE THE FIRST TRY OPENED. `start` with `--workspace` creates a
    // tab, so retrying with the same options created one MORE every second:
    // measured 22/08, one delegate left twelve tabs in the pool. From here on the
    // retry waits on the pane that already exists.
    if (out.pane) where = { ...opts, workspace: undefined, cwd: undefined, pane: out.pane }
    await Bun.sleep(1000)
  }
}

