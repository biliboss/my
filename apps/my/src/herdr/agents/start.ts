#!/usr/bin/env bun
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

import { start, startWhenReady } from "@my/herdr/agents/start";
import { value } from "@my/shared/argv";

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
