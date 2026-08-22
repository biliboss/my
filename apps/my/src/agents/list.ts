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
//! `agents.list.all()` (@packages/interfaces/agents.ts `View.all`) lives HERE: this module already
//! does the one join it needs — the herdr-raw agent joined with the NAME family
//! the `-N` suffix encodes. `View.check` is `./check.ts`, DELIBERATELY a separate
//! file — this one imports herdr statically for `agents.list.all()`, which taints it async
//! (see `check.ts`'s header for the measurement), and `agents.list.check()` must stay
//! `require()`-able synchronously for `house.ts` to find it.
//!
//! depends_on: src/herdr/agents/list.ts · src/agents/clone.ts
//! impacts:    src/agents/view.ts · src/agents/start.ts · src/agents/control.ts · src/agents/check.ts
//!
//! O domínio mora em `@my/agents`; aqui fica só o que a CLI imprime.

import { Command } from "commander";

import { list as vivos } from "@my/herdr/agents/list";
import { list as listWorkspaces } from "@my/herdr/workspaces/list";
import { fmtOf, out } from "@my/shared/gh";

import { agents } from "@my/agents";

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
      const { base, n } = agents.clone.nomeDoClone(a.title)
      return { ...a, nome: a.title, base: agents.clone.baseCurta(base), n, eu: a.pane === meuPane }
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

// SEM `await` no top level, de propósito: `src/shared/house.ts` descobre `agents.list.check()`
// dando `require()` síncrono neste módulo, e Bun trata QUALQUER `await` de topo —
// mesmo dentro de um `if` que nunca roda ao ser importado — como módulo ASSÍNCRONO,
// e devolve uma Promise em vez do objeto de exports. `check` sumia (typeof
// undefined) sem erro nenhum. MEDIDO 20/08 contra `src/tools/check.ts`, que tem o
// mesmo `await process.exit(...)` e por isso aparece com 0 em `house.coverage()`
// apesar de rodar limpo por `my tools check`. `.then` em vez de `await` é a mesma
// chamada sem a palavra que fecha a porta.

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
