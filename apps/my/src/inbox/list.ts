#!/usr/bin/env bun
//! `my inbox list` — o que existe numa inbox, e há quanto tempo está parado.
//!
//!     my inbox list                      # os três estados, com contagem
//!     my inbox list backlog              # só o que está esperando
//!     my inbox list --stale 3            # o que ninguém toca há 3 dias
//!     my inbox list --to 01_projects/via-nextjs/inbox
//!
//! Os leitores de `Inbox` (`items`, `backlog`, `ready`, `archived`, `next`,
//! `stale`, `counts`) atendidos por um verbo só: cada um é uma pergunta de uma
//! linha, e um subverbo por pergunta seria seis arquivos dizendo a mesma coisa com
//! um filtro diferente.
//!
//! O `--stale` é o que a página não conseguia responder. Enquanto item era seção de
//! um `CONTEXT.md`, o `mtime` era da PÁGINA: tocar um pedido fazia os vinte e um
//! lerem como modificados. Com pasta por item a pergunta é do disco.
//!
//! Nada aqui indexa. Três pastas e um nome que ordena por chegada já são a
//! resposta, e índice seria a segunda verdade que envelhece na primeira vez que
//! alguém mover uma pasta na mão.
//!
//! depends_on: src/inbox/layout.ts · src/inbox/system_inbox.ts
//! impacts:    00_inbox/CONTEXT.md

import { Command } from "commander";
import { statSync } from "node:fs";
import { inboxAt, items } from "./layout.ts";
import type { InboxSystem } from "./system_inbox.ts";

const STATES = ["ready", "backlog", "archive"] as const;
const DIA = 86_400_000;

export function command(): Command {
  return new Command("list")
    .description("O que tem na inbox: por estado, com a idade de cada item.")
    .argument("[state]", "backlog · ready · archive. Omitido, mostra os três")
    .option("-s, --stale <dias>", "só o que ninguém toca há N dias")
    .option("-t, --to <inbox>", "a inbox. Omitida, é a da casa (`00_inbox/`)");
}

/** Há quantos dias ninguém toca nisto. Do `mtime` da PASTA do item — que só existe
 *  como pergunta desde que o item virou pasta. */
const idade = (dir: string) => Math.floor((Date.now() - statSync(dir).mtimeMs) / DIA);

export function main(argv: string[]): number {
  const cmd = command().exitOverride();
  try {
    cmd.parse(argv, { from: "user" });
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1;
  }
  const [state] = cmd.args as [InboxSystem.ValueObjects.ItemState | undefined];
  const opts = cmd.opts();

  if (state && !STATES.includes(state as (typeof STATES)[number])) {
    console.error(`estado desconhecido: ${state} — use ${STATES.join(" · ")}`);
    return 1;
  }

  let inbox: ReturnType<typeof inboxAt>;
  try {
    inbox = inboxAt(opts.to);
  } catch (e) {
    console.error((e as Error).message);
    return 1;
  }

  const stale = opts.stale ? Number(opts.stale) : undefined;
  if (stale !== undefined && Number.isNaN(stale)) {
    console.error(`--stale espera um número de dias, veio "${opts.stale}"`);
    return 1;
  }

  let total = 0;
  for (const s of state ? [state] : STATES) {
    const achados = items(inbox.dir, s)
      .map((item) => ({ item, dias: idade(item.dir) }))
      .filter((i) => stale === undefined || i.dias >= stale);
    if (!achados.length && state === undefined && stale !== undefined) continue;

    console.log(`\n${s}  (${achados.length})`);
    for (const { item, dias } of achados) {
      // A data vem do frontmatter, não do nome — o nome não carrega mais carimbo.
      const dia = item.created_at.slice(0, 10);
      console.log(`  ${item.name.padEnd(46)} ${dia}${dias >= 1 ? `   ${dias}d parado` : ""}`);
    }
    total += achados.length;
  }

  if (!total) console.log(stale === undefined ? "vazia" : `nada parado há ${stale} dia(s)`);
  return 0;
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
