#!/usr/bin/env bun
//! Digita num pane — a chamada mais poderosa da casa.
//!
//!     bun run src/herdr/panes/send.ts w3K:p2 "my check all"
//!     bun run src/herdr/panes/send.ts w3K:p2 "rm -rf algo" --no-enter
//!
//! Um pane parado num prompt de shell RODA o que cair nele, e a cerca do
//! workspace é a única contenção que existe. É por isso que este arquivo checa
//! ela e o `read.ts` não.
//!
//! DUAS chamadas ao herdr, porque ele separa: `send-text` recebe string literal
//! e `send-keys` recebe NOME de tecla — `send-keys <pane> "echo oi" enter`
//! responde `unsupported key echo oi`, que é a primeira coisa que todo mundo
//! tenta.
//!
//! O Enter separado e opcional é a metade segura deste verbo: digitar SEM
//! submeter engatilha o comando pra um humano ler antes de rodar.
//!
//! E ele NÃO dorme antes de bater o Enter: ele CONFIRMA, lendo o pane. O porquê
//! está no comentário de `send`, e custou duas vezes.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts · src/shared/argv.ts
//! impacts:    src/inbox/capture.ts

import { send } from "@biliboss/herdr/panes/send";
import { has } from "@biliboss/shared/argv";

if (import.meta.main) {
  const [pane, text] = Bun.argv.slice(2)
  if (!pane || !text) {
    console.error('usage: send.ts <pane-id> <text> [--no-enter]')
    process.exit(2)
  }
  const out = await send(pane, text, { enter: !has('no-enter') })
  console.log(out.ok ? `${out.pane}${out.enter ? ' ⏎' : ' (staged)'}` : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
