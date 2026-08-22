#!/usr/bin/env bun
//! As abas do herdr, achatadas.
//!
//!     bun run src/herdr/tabs/list.ts          todas
//!     bun run src/herdr/tabs/list.ts w3K      só as de um workspace
//!
//! Um id de aba é SEMPRE `<workspace>:<tab>` — `w1R:t2` — então o id carrega o
//! pai e nada aqui precisa ser informado de qual workspace é. É esse fato que
//! deixa a superfície inteira plana.
//!
//! Sem cerca: ler não muda nada, e um workspace bloqueado é exatamente o que
//! alguém quer OLHAR sem tocar.
//!
//! depends_on: src/herdr/run.ts
//! impacts:    src/herdr/tabs/CONTEXT.md

import { list } from "@my/herdr/tabs/list";

if (import.meta.main) {
  const out = await list(Bun.argv[2])
  if (!out.ok) {
    console.error(`✗ ${out.error}`)
    process.exit(1)
  }
  for (const t of out.tabs) console.log(`${t.id.padEnd(10)} ${t.label.padEnd(24)} ${t.status.padEnd(8)} ${t.panes}p`)
}
