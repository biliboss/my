#!/usr/bin/env bun
//! CLONA a sessão que está rodando agora: parte o pane, retoma a MESMA sessão ao
//! lado, e a bifurca com um nome novo.
//!
//!     my agents clone                  clona ESTA sessão → `<nome>-1`
//!     my agents clone --from-clone     clona o ÚLTIMO clone → `<nome>-2`, `-3`, …
//!     my agents clone --ratio 0.4      quanto da tela o clone recebe (padrão 0.4)
//!
//! A sequência, e cada passo tem uma razão:
//!
//!   1. `herdr pane split --direction right` — o clone nasce À DIREITA, 40% da
//!      largura: quem clona continua trabalhando na coluna grande.
//!   2. `claude --dangerously-skip-permissions -r <id> --fork-session` — MESMA
//!      sessão (todo o contexto já lido), e a bifurcação acontece na ABERTURA.
//!   3. `/rename <nome>-<n>` — o nome é o que o `herdr pane list` mostra, e é
//!      como um humano acha o clone entre doze panes.
//!
//! O `/fork` DIGITADO foi a primeira versão, e ele falha de dois jeitos medidos
//! em 20/08: quando a sessão de origem está TRABALHANDO (o caso normal — quem
//! clona está no meio de uma tarefa), o TUI responde `session waiting` e a
//! bifurcação fica pendente; e a reconfirmação do Enter do `send` chega a
//! submeter a mesma barra mais de uma vez, o que deixou QUATRO `/fork` na tela
//! de um clone só. `--fork-session` faz a mesma coisa no argv, antes de existir
//! TUI pra esperar — e um flag não pode ser digitado duas vezes.
//!
//! POR QUE ISTO EXISTE, e é o ponto todo: `my herdr agents start` sobe um agente
//! VAZIO, e aí alguém tem que montar o contexto de fora — `--system @arquivo`
//! apontando pro contrato, `--prompt` com a instrução, e depois mais uma ou duas
//! mensagens porque o agente não sabe o que já foi decidido nesta conversa. Todo
//! trabalho desta sessão precisou disso hoje. O clone pula os três: ele ABRE
//! dentro do contexto — o que foi lido, o que foi medido, o que foi decidido e
//! por quê já estão lá. Um agente novo custa um header escrito à mão; um clone
//! custa uma linha.
//!
//! O que o clone NÃO substitui: agente com contrato DIFERENTE do desta sessão
//! (um worker de fila, um revisor). Pra esse, o `--system` continua sendo o
//! caminho — clonar seria dar a ele um contexto que ele não deveria ter.
//!
//! SÓ RODA DENTRO DO HERDR, e recusa fora: sem `HERDR_PANE_ID` não existe pane
//! pra partir, e o comando não tem como saber onde se colocaria. Recusar é a
//! resposta honesta — abrir uma janela solta seria fazer outra coisa com o mesmo
//! nome.
//!
//! `--from-clone` é o que faz uma FRENTE: o segundo clone nasce do PANE do
//! primeiro (parte ele, e a numeração continua de onde parou).
//!
//! Com `--fork-session` o `herdr pane list` passa a reportar o id NOVO do clone
//! (medido: `55db237e…` num pane que retomou `49980cb7…`), e é isso que faz o
//! `--from-clone` retomar de fato a sessão do clone. Com o `/fork` digitado isso
//! não acontecia: o herdr seguia mostrando o id retomado.
//!
//! O TETO existe e é o mesmo da fila (`my meta resources queue_is_a_folder`):
//! um clone que roda a mesma instrução do original também sabe clonar, e em
//! 20/08 três clones viraram cinco panes sem ninguém pedir. `--max` recusa a
//! partir do quarto.
//!
//! `clone(name, as)` — `Agents.clone` (@packages/interfaces/agents.ts), abaixo, é o
//! MESMO mecanismo apontado pra qualquer agente do roster em vez de só o pane de
//! quem chama: onde `main()` acima parte a PRÓPRIA sessão (`HERDR_PANE_ID`), a
//! função resolve `name` pelo roster e parte O PANE DELE. Reusa `esperaTUI` — só
//! ela, exportada abaixo — porque o resto (recusa fora do herdr, `/rename`
//! digitado, o teto) é sobre a sessão de QUEM CHAMA, que não existe neste
//! segundo caminho.
//!
//! depends_on: src/herdr/panes/split.ts · src/herdr/panes/send.ts · src/herdr/panes/read.ts · src/herdr/run.ts · src/herdr/agents/roster.ts · src/agents/list.ts
//! impacts:    src/herdr/agents/start.ts

import { Command } from 'commander'
import { result } from "@biliboss/herdr/run"
import { read } from "@biliboss/herdr/panes/read"
import { send } from "@biliboss/herdr/panes/send"
import { split } from "@biliboss/herdr/panes/split"
import { list as liveAgents } from "@biliboss/herdr/agents/list"
import { remember, roster } from "@biliboss/herdr/agents/roster"
import type { AgentSystem, Fail } from '@biliboss/interfaces/agents.ts'

type Pane = {
  pane_id: string
  tab_id: string
  terminal_title_stripped?: string
  agent_session?: { value?: string }
}

const morre = (msg: string): never => {
  console.error(msg)
  process.exit(1)
}

/** O sufixo `-N` do nome de um clone, e o nome sem ele. `worker` → base
 *  `worker`, n 0; `worker-2` → base `worker`, n 2. */
export function nomeDoClone(titulo: string): { base: string; n: number } {
  const m = titulo.trim().match(/^(.*?)-(\d+)$/)
  return m ? { base: m[1]!.trim(), n: Number(m[2]) } : { base: titulo.trim(), n: 0 }
}

/** O nome CURTO que vai pro `/rename`, tirado do título do pane.
 *
 *  O título de uma sessão do Claude é a primeira frase do pedido — "Setup
 *  study_bloom project with bloom standalone" — e mandar isso inteiro num
 *  `/rename` dentro de um pane de 16% de largura quebra a linha em quatro, e a
 *  confirmação do `send` não acha o texto que ela mesma digitou (medido 20/08).
 *  Três palavras e 24 caracteres é o que cabe no pane mais estreito que este
 *  comando cria, e continua endereçando: ninguém procura o clone pela frase
 *  inteira, procura pelo começo dela mais o número. */
export function baseCurta(titulo: string): string {
  return titulo
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join('-')
    .replace(/[^\w-]/g, '')
    .slice(0, 24)
    .replace(/-+$/, '')
}

/** O próximo número livre entre os panes irmãos — não `n+1` cego.
 *
 *  Dois clones disparados na mesma aba com `n+1` nasceriam os dois `-1`, e aí o
 *  nome deixa de endereçar. Olhar os irmãos é a única fonte que já existe. */
export function proximoN(base: string, titulos: string[]): number {
  const usados = titulos
    .map((t) => nomeDoClone(t))
    .filter((x) => x.base === base && x.n > 0)
    .map((x) => x.n)
  return usados.length ? Math.max(...usados) + 1 : 1
}

async function panes(): Promise<Pane[]> {
  const out = await result(['pane', 'list'])
  if (!out.ok) morre(`herdr não respondeu: ${out.error}`)
  return (out.result?.panes ?? []) as Pane[]
}

/** Quanto se espera o TUI do Claude abrir antes de digitar a primeira barra.
 *  Confirmado lendo a tela, não por sleep — retomar sessão longa demora. */
export const TUI_MS = 60_000

export async function esperaTUI(pane: string): Promise<boolean> {
  const fim = Date.now() + TUI_MS
  do {
    const tela = await read(pane, { lines: 12 })
    // O sinal tem que sobreviver à LARGURA. Um clone de clone fica com ~16% da
    // tela, e ali a barra de status vira `⏵⏵ ·` — procurar "bypass permissions"
    // ou "shift+tab" falhava com o TUI já pintado (medido 20/08, 60s de espera
    // por uma tela que estava pronta). O `⏵⏵` é o primeiro caractere da barra e
    // é o último a ser cortado.
    if (tela.ok && /⏵⏵|bypass permissions|shift\+tab|\? for shortcuts/i.test(tela.text)) return true
    await Bun.sleep(500)
  } while (Date.now() < fim)
  return false
}

export function command(): Command {
  return new Command('clone')
    .description('Parte o pane, retoma ESTA sessão ao lado e a bifurca com nome novo.')
    .option('--from-clone', 'clona o último CLONE em vez desta sessão — é assim que se faz o terceiro agente')
    .option('--ratio <n>', 'quanto da largura (ou altura, com --down) fica com quem clona; o clone leva o resto', '0.6')
    .option('--down', 'empilha em vez de partir ao lado — é o que salva o clone do clone, que senão nasce com 16% de largura')
    .option('--max <n>', 'quantos clones deste agente cabem na aba; acima disso recusa', '3')
    .option('--json', 'a linha do clone, pro jq')
}

export async function main(argv: string[]): Promise<number> {
  const cmd = command().exitOverride()
  try {
    cmd.parse(argv, { from: 'user' })
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1
  }
  const opts = cmd.opts()

  // A RECUSA que o pedido pede em primeiro lugar: fora do herdr não há pane.
  const meuPane = process.env.HERDR_PANE_ID
  if (!meuPane) morre('my agents clone só roda DENTRO do herdr — sem HERDR_PANE_ID não existe pane pra partir')

  const todos = await panes()
  const eu = todos.find((p) => p.pane_id === meuPane)
  if (!eu) morre(`o herdr não conhece o pane ${meuPane} — a sessão está fora da árvore dele`)

  // De QUEM se clona: desta sessão, ou do último clone dela. No segundo caso a
  // sessão retomada é a do CLONE (já bifurcada), que é o que faz o terceiro
  // agente herdar o contexto do segundo em vez do original.
  // O número sai ANTES do encurtamento: `…standalone-1` encurtado primeiro vira
  // três palavras do começo e o `-1` some, e aí o segundo clone renasce `-1`.
  const curto = (titulo: string) => {
    const x = nomeDoClone(titulo)
    return { base: baseCurta(x.base), n: x.n }
  }
  const base = curto(process.env.MY_AGENT ?? eu!.terminal_title_stripped ?? 'agent').base
  const irmaos = todos.filter((p) => p.tab_id === eu!.tab_id)
  const rotulo = (p: Pane) => {
    const x = curto(p.terminal_title_stripped ?? '')
    return x.n ? `${x.base}-${x.n}` : x.base
  }
  const n = proximoN(base, irmaos.map(rotulo))

  // O TETO. Um clone carrega a MESMA instrução do original — inclusive "clone
  // você também" —, e em 20/08 isso virou cinco panes numa aba sem ninguém pedir.
  // Contar os irmãos é a checagem mais barata que existe, e ela é do lado de
  // quem cria: quem já nasceu não se desfaz sozinho.
  const vivos = irmaos.filter((p) => curto(p.terminal_title_stripped ?? '').base === base && curto(p.terminal_title_stripped ?? '').n > 0).length
  if (vivos >= Number(opts.max))
    morre(`já existem ${vivos} clones de \`${base}\` nesta aba (teto ${opts.max}) — feche um com \`herdr pane close <id>\` ou suba o teto com --max`)

  let origem = eu!
  if (opts.fromClone) {
    const clones = irmaos
      .map((p) => ({ p, x: curto(p.terminal_title_stripped ?? '') }))
      .filter((c) => c.x.base === base && c.x.n > 0)
      .sort((a, b) => a.x.n - b.x.n)
    if (!clones.length) morre(`--from-clone, mas não existe clone de \`${base}\` nesta aba — rode \`my agents clone\` primeiro`)
    origem = clones[clones.length - 1]!.p
  }

  const sessao = opts.fromClone ? origem.agent_session?.value : (process.env.CLAUDE_CODE_SESSION_ID ?? origem.agent_session?.value)
  if (!sessao) morre(`não achei o session id de ${origem.pane_id} — sem ele o clone abriria uma sessão VAZIA, que não é um clone`)

  const nome = `${base}-${n}`
  const partido = await split(origem.pane_id, { direction: opts.down ? 'down' : 'right', ratio: Number(opts.ratio), focus: false })
  if (!partido.ok) morre(`não parti o pane: ${partido.error}`)
  const novo = partido.pane

  const abriu = await send(novo, `claude --dangerously-skip-permissions -r ${sessao} --fork-session`)
  if (!abriu.ok) morre(`o pane ${novo} nasceu mas não recebeu o comando: ${abriu.error}`)

  if (!(await esperaTUI(novo)))
    morre(`o Claude não subiu em ${novo} em ${TUI_MS / 1000}s — o pane está lá; termine à mão com \`/fork\` e \`/rename ${nome}\``)

  // Só o `/rename` é digitado: a bifurcação já veio no argv. Uma barra só também
  // é uma barra só pra dar errado.
  for (const barra of [`/rename ${nome}`]) {
    // `window: 24` porque a barra abre o menu de autocomplete do Claude e ele
    // empurra a linha digitada pra cima; ler só seis linhas recusa um texto que
    // está na tela.
    const r = await send(novo, barra, { window: 24 })
    if (!r.ok) morre(`\`${barra}\` não entrou em ${novo}: ${r.error}\n  o pane está de pé; termine à mão`)
    await Bun.sleep(1_500)
  }

  const linha = { pane: novo, nome, de: origem.pane_id, sessao }
  console.log(opts.json ? JSON.stringify(linha) : `${nome} em ${novo} — clone de ${origem.pane_id} (sessão ${sessao.slice(0, 8)})`)
  return 0
}

const fail = (error: string, reason: Fail['reason'] = 'not_found'): Fail => ({ ok: false, error, reason })

/** `Agents.clone(name, as)` — bifurca a sessão de um agente do ROSTER, sem
 *  depender de `HERDR_PANE_ID`: parte O PANE DELE (não o de quem chama),
 *  `--fork-session` pra dentro do novo, espera o TUI, renomeia, e lembra `as` no
 *  roster. `claude-code` apenas — o mesmo limite de `caps()`: só ele foi medido
 *  com `--fork-session`. */
export async function clone(name: string, as: string): Promise<AgentSystem.Entities.Agent | Fail> {
  const rec = (await roster()).find((a) => a.name === name)
  if (!rec) return fail(`não conheço agente \`${name}\` — \`my agents list\` mostra os vivos`)

  const live = await liveAgents()
  const origem = live.ok ? live.agents.find((a) => a.pane === rec.pane) : undefined
  if (!origem) return fail(`o pane de \`${name}\` não está mais na frota do herdr`)
  if (origem.agent !== 'claude') return fail(`\`${origem.agent}\` não tem clone medido nesta casa — só claude-code`, 'unsupported')
  if (!origem.session) return fail(`herdr não relatou a sessão de \`${name}\` (agent_session ausente) — sem ela não dá pra bifurcar`, 'unsupported')

  const partido = await split(origem.pane, { direction: 'right', ratio: 0.6, focus: false })
  if (!partido.ok) return { ok: false, error: partido.error, reason: 'herdr' }
  const novo = partido.pane

  const abriu = await send(novo, `claude --dangerously-skip-permissions -r ${origem.session} --fork-session`)
  if (!abriu.ok) return { ok: false, error: `o pane ${novo} nasceu mas não recebeu o comando: ${abriu.error}`, reason: 'herdr' }

  if (!(await esperaTUI(novo))) return fail(`o claude não subiu em ${novo} em ${TUI_MS / 1000}s — o pane está lá, mas \`as\` não foi renomeado`, 'herdr')

  const r = await send(novo, `/rename ${as}`, { window: 24 })
  if (!r.ok) return { ok: false, error: `\`/rename ${as}\` não entrou em ${novo}: ${r.error} — o pane está de pé`, reason: 'herdr' }
  await Bun.sleep(1_500)

  remember(as, novo)

  // Lida de novo em vez de montar o fato à mão: `--fork-session` cunha um id
  // NOVO, e só o herdr sabe qual — reler é mais barato que confiar no que a
  // gente mandou como argumento.
  const depois = await liveAgents()
  const novoLive = depois.ok ? depois.agents.find((a) => a.pane === novo) : undefined
  return {
    name: as,
    runtime: { cli: 'claude-code', session: novoLive?.session },
    launch: { engine: { cli: 'claude-code' }, worktree: novoLive?.launchCwd ?? origem.launchCwd, fork: true },
    pane: novo,
    parent: name,
  }
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)))
