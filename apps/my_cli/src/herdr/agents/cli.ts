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


if (import.meta.main) process.exit(await main(process.argv.slice(2)))
