#!/usr/bin/env bun
//! A FROTA como ela está agora — e quem é clone de quem.
//!
//!     my agents list             a frota inteira, o clone indentado sob a origem
//!     my agents list --mine      só esta aba
//!     my agents list --tsv       uma linha por agente, pro awk
//!
//! `my herdr agents list` continua existindo e é a leitura CRUA do herdr — um
//! pane, um programa, um status. Este aqui é a mesma lista com o que só a família
//! `agents` sabe: o `-N` no fim de um nome é um CLONE (`my agents clone`), e a
//! origem dele é o irmão de mesma base. Sem isso, doze panes chamados quase a
//! mesma coisa são doze linhas planas, e descobrir quem saiu de quem é ler título
//! por título.
//!
//! Nada de dado novo em disco: a árvore sai do NOME, que já é o que o `/rename`
//! escreveu. Um registro paralelo de "quem clonou quem" seria a segunda fonte, e
//! ela envelheceria no primeiro pane fechado à mão.
//!
//! `all()` (@packages/interfaces/agents.ts `View.all`) lives HERE: this module already
//! does the one join it needs — the herdr-raw agent joined with the NAME family
//! the `-N` suffix encodes. `View.check` is `./check.ts`, DELIBERATELY a separate
//! file — this one imports herdr statically for `all()`, which taints it async
//! (see `check.ts`'s header for the measurement), and `check()` must stay
//! `require()`-able synchronously for `house.ts` to find it.
//!
//! depends_on: src/herdr/agents/list.ts · src/agents/clone.ts
//! impacts:    src/agents/view.ts · src/agents/start.ts · src/agents/control.ts · src/agents/check.ts

import { Command } from 'commander'
import { list as vivos, type Agent } from "@biliboss/herdr/agents/list"
import { roster } from "@biliboss/herdr/agents/roster"
import { list as listWorkspaces } from "@biliboss/herdr/workspaces/list"
import { baseCurta, nomeDoClone } from './clone.ts'
import { fmtOf, out } from '../shared/gh.ts'
import type { AgentSystem } from '@biliboss/interfaces/agents.ts'

type Linha = Agent & { nome: string; base: string; n: number; eu: boolean }

/** herdr's own program name → the contract's `Engine.cli` discriminator. Not in
 *  the map means `other`: an enum this house does not close against a CLI it has
 *  not met — see `AgentSystem.ValueObjects.Engine.Other`. */
const CLI: Record<string, 'claude-code' | 'pi' | 'codex' | 'gemini'> = {
  claude: 'claude-code',
  pi: 'pi',
  codex: 'codex',
  gemini: 'gemini',
}

/** One herdr-raw agent → the contract's `Entity.Agent`. Exported: `start.ts`,
 *  `clone.ts` and `control.ts` all hand back the entity a mutation just produced,
 *  and this is the one place that knows the shape. */
export function toEntity(a: Agent, rosterName: string | undefined, siblings: Agent[]): AgentSystem.Entities.Agent {
  const cli = CLI[a.agent]
  const runtime: AgentSystem.ValueObjects.Runtime.Any = cli
    ? { cli, session: a.session }
    : { cli: 'other', name: a.agent, session: a.session }

  // O PAI: mesmo `tab`, mesma `base` de nome, o `n` imediatamente ABAIXO do
  // deste — é a mesma árvore que `main()` já desenha na CLI, só que devolvida
  // como fato em vez de indentação.
  const { base, n } = nomeDoClone(a.title)
  let parent: string | undefined
  if (n > 0) {
    const candidatos = siblings
      .filter((s) => s.tab === a.tab && s.pane !== a.pane)
      .map((s) => ({ s, x: nomeDoClone(s.title) }))
      .filter((c) => baseCurta(c.x.base) === baseCurta(base) && c.x.n < n)
      .sort((x, y) => y.x.n - x.x.n)
    parent = candidatos[0]?.s.title
  }

  return {
    name: rosterName ?? a.title,
    runtime,
    // `worktree` é o único campo de `launch` que herdr entrega de graça (o
    // `cwd` do pane); modelo/effort/permission não são reconstruíveis sem ler a
    // tela — `launch: {}` além disso é uma resposta REAL ("tudo no default"),
    // não um stub, porque todo campo de `Launch` já é opcional no contrato.
    launch: { engine: cli ? { cli } : { cli: 'other', name: a.agent }, worktree: a.launchCwd },
    pane: a.pane,
    parent,
  }
}

/** O QUE `my agents list` MOSTRA, TIPADO (`View.all`). */
export async function all(): Promise<AgentSystem.Entities.Agent[]> {
  const [live, known] = await Promise.all([vivos(), roster()])
  if (!live.ok) return []
  const names = new Map(known.filter((k) => k.name !== '—').map((k) => [k.pane, k.name]))
  return live.agents.map((a) => toEntity(a, names.get(a.pane), live.agents))
}

export function command(): Command {
  return new Command('list')
    .description('A frota viva, com o clone indentado sob a origem dele.')
    .option('--mine', 'só os agentes desta aba')
    .option('--json', 'a lista inteira, pro jq')
    .option('--jsonl', 'um agente por linha')
    .option('--tsv', 'um agente por linha, pro awk')
}

export async function main(argv: string[]): Promise<number> {
  const cmd = command().exitOverride()
  try {
    cmd.parse(argv, { from: 'user' })
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1
  }
  const opts = cmd.opts()

  const out0 = await vivos()
  if (!out0.ok) return console.error(`✗ ${out0.error}`), 1

  // The workspace ID is already on the pane; the LABEL is the half a human reads,
  // and it only exists on the workspace list. A failed join degrades to the id.
  const spaces = await listWorkspaces({ includeHidden: true })
  const labelOf = new Map(spaces.ok ? spaces.workspaces.map((w) => [w.id, w.label]) : [])

  const meuPane = process.env.HERDR_PANE_ID
  const minhaAba = out0.agents.find((a) => a.pane === meuPane)?.tab
  const linhas: Linha[] = out0.agents
    .filter((a) => !opts.mine || a.tab === minhaAba)
    .map((a) => {
      const { base, n } = nomeDoClone(a.title)
      return { ...a, nome: a.title, base: baseCurta(base), n, eu: a.pane === meuPane }
    })

  const fmt = fmtOf(argv)
  if (fmt !== 'human') {
    out(
      fmt,
      linhas,
      (l) => [l.pane, l.status, l.base, String(l.n), l.workspace, labelOf.get(l.workspace) ?? '', l.nome],
      (l) => `${l.pane} ${l.status} ${l.nome}`,
    )
    return 0
  }

  // O clone entra SOB a origem, e a origem é o irmão de mesma base com `n` menor
  // (o original tem `n` 0). Ordenar por base e depois por número põe a família
  // junta sem precisar montar árvore nenhuma.
  const ordem = [...linhas].sort((a, b) => a.base.localeCompare(b.base) || a.n - b.n)
  for (const l of ordem) {
    const marca = l.eu ? '←' : ' '
    const recuo = l.n ? '  └─ ' : ''
    const espaco = labelOf.get(l.workspace) ?? l.workspace
    console.log(`${marca} ${l.pane.padEnd(8)} ${espaco.padEnd(18)} ${l.status.padEnd(8)} ${recuo}${l.nome}`)
  }
  const clones = ordem.filter((l) => l.n).length
  console.log(`${ordem.length} agentes · ${clones} clone(s)${opts.mine ? ' · só esta aba' : ''}`)
  return 0
}

// SEM `await` no top level, de propósito: `src/shared/house.ts` descobre `check()`
// dando `require()` síncrono neste módulo, e Bun trata QUALQUER `await` de topo —
// mesmo dentro de um `if` que nunca roda ao ser importado — como módulo ASSÍNCRONO,
// e devolve uma Promise em vez do objeto de exports. `check` sumia (typeof
// undefined) sem erro nenhum. MEDIDO 20/08 contra `src/tools/check.ts`, que tem o
// mesmo `await process.exit(...)` e por isso aparece com 0 em `house.coverage()`
// apesar de rodar limpo por `my tools check`. `.then` em vez de `await` é a mesma
// chamada sem a palavra que fecha a porta.
if (import.meta.main) main(process.argv.slice(2)).then((code) => process.exit(code))
