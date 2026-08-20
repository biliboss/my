#!/usr/bin/env bun
//! `my herdr agents cli` — o ÚNICO verbo desta casa pro herdr.
//!
//!     my herdr agents cli                              os vivos, com nome
//!     my herdr agents cli :ab alice +bruno             duas colunas, um agente em cada
//!     my herdr agents cli :ab a +b /c +d               2x2
//!     my herdr agents cli :ab alice --send "olá"       dispara e já manda o pedido
//!     my herdr agents cli alice "roda os testes"       fala com um agente
//!     my herdr agents cli alice                        lê a tela dele
//!     my herdr agents cli kill :ab                     fecha o workspace inteiro
//!
//! POR QUE UM VERBO SÓ. Antes eram quatro — `workspaces`, `tabs`, `panes`,
//! `agents` — e os três primeiros expunham a dificuldade do herdr pra quem só
//! queria dois agentes lado a lado: criar workspace, criar aba, partir pane,
//! descobrir o id de cada um, e então subir o binário. Cinco comandos e quatro ids
//! decorados pra uma coisa que é uma frase.
//!
//! A regra que sobrou: **a CLI fala NOME de agente, nunca id de pane.** O id
//! continua existindo — ele é o vocabulário do herdr e está em `src/herdr/` — mas
//! ninguém precisa dele pra trabalhar. Quem quiser o id, `my herdr agents cli` mostra.
//!
//! A DSL DO LAYOUT. `+` põe ao lado, `/` põe embaixo, e os dois são relativos ao
//! ÚLTIMO pane criado, não ao primeiro: `a +b /c` deixa `c` embaixo de `b`, e é o
//! que faz a expressão composta ler da esquerda pra direita como a tela se monta.
//!
//! `|` seria o símbolo óbvio pra "ao lado" e está fora: o shell come o pipe antes
//! de o `just` ver, e uma DSL que exige aspas deixa de ser uma frase.
//!
//! depends_on: src/herdr/agents/roster.ts · src/herdr/agents/start.ts · src/herdr/panes/split.ts · src/shared/argv.ts
//! impacts:    src/cli/my.ts

import { close as closeWorkspace } from '../workspaces/close.ts'
import { create as createWorkspace } from '../workspaces/create.ts'
import { resolve } from '../workspaces/resolve.ts'
import { read } from '../panes/read.ts'
import { send, submit } from '../panes/send.ts'
import { split } from '../panes/split.ts'
import { startWhenReady } from './start.ts'
import { forget, paneOf, remember, roster } from './roster.ts'
import { value } from '../../shared/argv.ts'

/** Um agente da expressão, e como ele se posiciona em relação ao anterior. */
type Spot = { name: string; where: 'root' | 'right' | 'down' }

/**
 *  `alice +bruno /carla` → três agentes, o segundo ao lado do primeiro, o terceiro
 *  embaixo do segundo.
 *
 *  O sigil vem COLADO no nome de propósito: solto (`alice + bruno`) o shell manda
 *  três argumentos e a expressão fica indistinguível de uma lista com um `+` no
 *  meio, que é uma DSL que se digita errado com facilidade.
 */
export function parseLayout(words: string[]): { ok: true; spots: Spot[] } | { ok: false; error: string } {
  const spots: Spot[] = []
  for (const word of words) {
    const sigil = word[0]
    const name = sigil === '+' || sigil === '/' ? word.slice(1) : word
    if (!name) return { ok: false, error: `\`${word}\` não nomeia agente nenhum` }
    if (!/^[a-z][a-z0-9_-]{0,29}$/.test(name)) {
      // O herdr aceita `[a-z0-9_-]` até 32 caracteres começando por letra. Recusar
      // aqui é melhor que recusar lá: o erro dele chega depois de o workspace já
      // existir, e aí sobra um workspace vazio na tela.
      return { ok: false, error: `nome inválido: \`${name}\` — minúsculas, dígitos, \`-\` e \`_\`, começando por letra` }
    }
    if (spots.some((s) => s.name === name)) return { ok: false, error: `\`${name}\` aparece duas vezes` }
    if (!spots.length && (sigil === '+' || sigil === '/')) {
      return { ok: false, error: `o primeiro agente não leva sigil — ele é o pane raiz` }
    }
    spots.push({ name, where: !spots.length ? 'root' : sigil === '/' ? 'down' : 'right' })
  }
  return spots.length ? { ok: true, spots } : { ok: false, error: 'nenhum agente na expressão' }
}

async function spawn(label: string, words: string[], opts: { model?: string; effort?: string; send?: string; cwd?: string }) {
  const parsed = parseLayout(words)
  if (!parsed.ok) return fail(parsed.error)

  const cwd = opts.cwd ?? process.cwd()
  const ws = await createWorkspace(label, { cwd })
  if (!ws.ok) return fail(ws.error)

  // O pane raiz da aba que o `workspace create` JÁ abriu — pedir uma segunda aba
  // deixa a primeira vazia pendurada na tela.
  const panes: string[] = [ws.pane]
  for (const spot of parsed.spots.slice(1)) {
    // Relativo ao ÚLTIMO, que é o que faz a expressão ler da esquerda pra direita.
    const out = await split(panes.at(-1)!, { direction: spot.where === 'down' ? 'down' : 'right', cwd })
    if (!out.ok) return fail(out.error)
    panes.push(out.pane)
  }

  const started = await Promise.all(
    parsed.spots.map((spot, i) =>
      startWhenReady(spot.name, {
        pane: panes[i]!,
        model: opts.model,
        effort: opts.effort,
        args: ['--permission-mode', 'acceptEdits'],
      }),
    ),
  )
  for (const [i, out] of started.entries()) {
    // O pane fica de pé de propósito: ele segura o que o binário imprimiu antes de
    // morrer, que é a única evidência do porquê.
    if (!out.ok) return fail(`${parsed.spots[i]!.name} não subiu: ${out.error} — ${panes[i]}`)
    remember(parsed.spots[i]!.name, panes[i]!)
  }

  if (opts.send) {
    // Todo o texto primeiro, uma espera, e só então os Enter: com N panes o Enter
    // imediato não registra (medido em 17/08 — ver `panes/send`).
    for (const p of panes) {
      const typed = await send(p, opts.send, { enter: false })
      if (!typed.ok) return fail(typed.error)
    }
    await Bun.sleep(2000)
    for (const p of panes) {
      const pressed = await submit(p)
      if (!pressed.ok) return fail(pressed.error)
    }
  }

  console.log(parsed.spots.map((s, i) => `${s.name.padEnd(16)} ${panes[i]}`).join('\n'))
  return 0
}

async function list() {
  const all = await roster()
  if (!all.length) {
    console.log('nenhum agente vivo')
    return 0
  }
  for (const a of all) {
    console.log(`${a.name.padEnd(16)} ${a.pane.padEnd(10)} ${a.agent.padEnd(8)} ${a.status.padEnd(8)} ${a.title.slice(0, 40)}`)
  }
  return 0
}

async function say(name: string, text: string) {
  const pane = await paneOf(name)
  if (!pane) return fail(`não conheço agente \`${name}\` — \`my herdr agents cli\` lista os vivos`)
  const out = await send(pane, text)
  return out.ok ? 0 : fail(out.error)
}

async function show(name: string, lines?: number) {
  const pane = await paneOf(name)
  if (!pane) return fail(`não conheço agente \`${name}\` — \`my herdr agents cli\` lista os vivos`)
  const out = await read(pane, { lines })
  if (!out.ok) return fail(out.error)
  process.stdout.write(out.text)
  return 0
}

async function kill(label: string) {
  const found = await resolve(label)
  if (!found.ok) return fail(found.error)

  // Os nomes saem do mapa ANTES do fechamento: se o herdr falhar no meio, um nome
  // apontando pra pane morto é pior que nome nenhum — a próxima reconciliação
  // recolocaria os que sobraram.
  const doomed = (await roster()).filter((a) => a.pane.startsWith(`${found.workspace.id}:`))
  forget(doomed.map((a) => a.name))

  const out = await closeWorkspace(found.workspace.id)
  if (!out.ok) return fail(out.error)
  console.log(`✓ ${out.label} (${out.id}) — ${doomed.length} agente(s)`)
  return 0
}

function fail(error: string): number {
  console.error(`✗ ${error}`)
  return 1
}

async function main(argv: string[]): Promise<number> {
  // `argv` e nao o tail do processo: este main recebe a fatia dele, e e por isso
  // que `value()` aceita o array como terceiro parametro (ver `shared/argv.ts`).
  const flag = (name: string) => value(name, undefined, argv)
  // As palavras da expressão são o que sobra depois de tirar as flags e os valores
  // delas — senão `--send "olá"` viraria um agente chamado `olá`.
  const words = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'))
  const [first, second] = words

  if (!first) return list()
  if (first === 'kill') {
    if (!second?.startsWith(':')) return fail('`kill` precisa de um `:workspace` — `my herdr agents cli kill :ab`')
    return kill(second.slice(1))
  }
  if (first.startsWith(':')) {
    return spawn(first.slice(1), words.slice(1), {
      model: flag('model'),
      effort: flag('effort'),
      send: flag('send'),
      cwd: flag('cwd'),
    })
  }
  if (second) return say(first, words.slice(1).join(' '))
  return show(first, flag('lines') ? Number(flag('lines')) : undefined)
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)))
