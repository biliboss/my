#!/usr/bin/env bun
//! O que o pane está mostrando.
//!
//!     bun run src/herdr/panes/read.ts w3K:p2
//!     bun run src/herdr/panes/read.ts w3K:p2 --lines 40
//!
//! NÃO cercado, de propósito: ler não muda nada, e um workspace bloqueado é
//! exatamente aquele que alguém quer acompanhar sem tocar.
//!
//! Texto puro, e por isso NÃO passa pelo `result()`: esta saída é saída de
//! terminal, não envelope. Embrulhar num campo de string só põe uma camada de
//! escape entre quem chama e o que ele veio ler.
//!
//! depends_on: src/herdr/run.ts · src/shared/argv.ts
//! impacts:    src/herdr/panes/CONTEXT.md

import { read } from "@biliboss/herdr/panes/read";
import { value } from "@biliboss/shared/argv";

if (import.meta.main) {
  const lines = value('lines')
  const out = await read(Bun.argv[2] ?? '', { lines: lines === undefined ? undefined : Number(lines) })
  if (!out.ok) {
    console.error(`✗ ${out.error}`)
    process.exit(1)
  }
  process.stdout.write(out.text)
}
