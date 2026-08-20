//! Sobe um agente interativo.
//!
//!     my herdr agents start revisor --workspace cockpit --cwd ~/src/me --prompt "afira a #178"
//!     my herdr agents start qa --pane w3K:p4 --prompt "afira a #178" \
//!       --system @02_areas/00_workflows/00_main/03_qa/references/qa_issue_proof.md
//!     my herdr agents start revisor --workspace cockpit --prompt "..." --model opus --effort high
//!
//! Dois caminhos, e a diferença é quem já tem o pane:
//!
//!   `--workspace`  abre uma ABA no workspace e usa o pane raiz dela.
//!   `--pane`       usa um pane que já existe — é o que o `00_compare` precisa,
//!                  porque lá os dois panes vêm de um `split` e não de duas abas.
//!
//! O herdr **verifica**: espera até detectar aquele agente pronto pra input, e
//! sucesso quer dizer que a coisa subiu — não que um comando foi digitado. O que
//! também quer dizer que a falha comum é timeout, e argv errado é
//! indistinguível de start lento: binário que morre numa flag desconhecida nunca
//! chega a ser detectado.
//!
//! Quando o binário falha, A ABA FICA DE PÉ de propósito: ela segura o que ele
//! imprimiu antes de morrer, que é a única evidência do porquê.
//!
//! Os defaults estão escritos aqui e não num arquivo de config: existe UM tipo
//! de agente nesta casa hoje, e chave de config com um valor só é um segundo
//! lugar pra procurar a mesma string.
//!
//! **`--cwd` NÃO vai pro herdr, vai pro PANE.** `herdr agent start` não tem essa
//! flag: quem tem é `tab create` e `workspace create`. O agente herda o cwd de
//! onde o shell está — e em 17/08 um agente de QA subiu na pasta do `zenit2`
//! porque o pane raiz veio de um workspace criado sem cwd. Com `--pane` o cwd já
//! está decidido por quem abriu o pane, e passar `--cwd` ali é mentira: por isso
//! o par é recusado.
//!
//! **`--prompt` é OBRIGATÓRIO.** Agente que sobe sem pedido fica num prompt
//! vazio esperando alguém lembrar dele, e o custo aparece como pane parado que
//! ninguém sabe se terminou ou nunca começou. Se o trabalho não cabe numa frase
//! agora, ele não estava pronto pra virar agente.
//!
//! **`--dangerously-skip-permissions` é o default**, e não é descuido: um agente
//! da frota roda sem humano na frente, e prompt de permissão num pane que
//! ninguém olha é o mesmo que travar. O portão desta casa é a cerca do
//! `policy.ts` — qual pane pode ser tocado — e não um diálogo por chamada.
//!
//! `--prompt` e `--system` aceitam `@caminho`, e os dois fazem coisas
//! DIFERENTES com ele. `--prompt @f` lê o arquivo e manda o texto: é o pedido, e
//! ele é de agora. `--system @f` manda um PONTEIRO pro caminho e deixa o agente
//! ler — porque referência colada no argv é uma segunda cópia congelada no
//! instante do start, e porque o argv não aguenta: 77 linhas do
//! `qa_issue_proof` fizeram o herdr recusar com `agent arguments cannot be
//! encoded safely for the target shell` (17/08).
//!
//! depends_on: src/herdr/run.ts · src/herdr/tabs/create.ts · src/shared/argv.ts · 02_areas/00_workflows/04_experimental/01_review_loop/CONTEXT.md · src/herdr/policy.ts
//! impacts:    02_areas/00_workflows/04_experimental/00_compare/run.ts · 02_areas/00_workflows/04_experimental/01_review_loop/run.ts · src/herdr/agents/cli.ts

import { readFileSync } from 'node:fs'
import { HERDR_TIMEOUT_MS, result } from '../run.ts'
import { create as createTab } from '../tabs/create.ts'
import { send as sendToPane } from '../panes/send.ts'
import { fence } from '../policy.ts'
import { upstream, type Fail } from '../../shared/result.ts'
import { value } from '../../shared/argv.ts'

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
    '--dangerously-skip-permissions',
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
  for (let i = 0; ; i++) {
    const out = await start(name, opts)
    if (out.ok || i >= tries || !out.error.includes('not an available shell')) return out
    await Bun.sleep(1000)
  }
}

if (import.meta.main) {
  const name = Bun.argv[2]
  if (!name) {
    console.error('usage: start <name> (--workspace <id|label> | --pane <id>) --prompt <text|@file> [--system <text|@file>] [--cwd <path>] [--tab <label>] [--model <m>] [--effort <e>]')
    process.exit(2)
  }
  // `startWhenReady` e nao `start`: o pane recem-criado ainda nao e um shell no
  // instante em que o script chega nele, e so ESTE erro e retentado. A funcao
  // existia desde sempre e o CLI nao usava — medido em 17/08, o terceiro agente
  // da frota falhou com `not an available shell` num pane criado 8s antes.
  const out = await startWhenReady(name, {
    workspace: value('workspace'),
    pane: value('pane'),
    tab: value('tab'),
    kind: value('kind'),
    model: value('model'),
    effort: value('effort'),
    cwd: value('cwd'),
    prompt: value('prompt'),
    system: value('system'),
  })
  console.log(JSON.stringify(out))
  process.exit(out.ok ? 0 : 1)
}
