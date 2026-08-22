#!/usr/bin/env bun
//! Todo pane em que o herdr vê um agente rodando.
//!
//!     my herdr agents list
//!
//! "Agente" aqui é o do HERDR: um pane com um agente interativo dentro,
//! `claude` ou outro. Uma palavra, um significado — ela já era do herdr em toda
//! outra ferramenta desta máquina.
//!
//! Esta é a metade VIVA da frota. A outra — o que os runs declaram em
//! `agentes[]` — NÃO TEM MAIS LEITOR: o `fleet.ts` que as cruzava morreu com o
//! `src/sandbox/` em 17/08. O número que importa (agente vivo sem linha em run
//! nenhum é ÓRFÃO) hoje não é calculado por ninguém — na primeira vez que ele
//! doer de novo, o lugar dele é aqui, não numa segunda pasta.
//!
//! depends_on: src/herdr/run.ts
//! impacts: src/herdr/agents/roster.ts

import { list } from "@my/herdr/agents/list";

if (import.meta.main) {
  const out = await list()
  if (!out.ok) {
    console.error(`✗ ${out.error}`)
    process.exit(1)
  }
  for (const a of out.agents) console.log(`${a.pane.padEnd(10)} ${a.agent.padEnd(8)} ${a.status.padEnd(8)} ${a.title.slice(0, 42)}`)
}
