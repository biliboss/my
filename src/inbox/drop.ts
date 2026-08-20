#!/usr/bin/env bun
//! `my inbox drop` — the item becomes NOTHING, on purpose, and the why is required.
//!
//!     my inbox drop specialized_skills --reason "o herdr já faz isso, e melhor"
//!     my inbox drop specialized_skills --reason "…" --to 01_projects/via-nextjs/inbox
//!
//! `Inbox.drop` made runnable, and it archives exactly like `process`
//! does — a refused request is the most expensive record in the house: the only one
//! that cannot be reconstructed by reading the code afterwards. Deleting the folder
//! throws away precisely that, so a drop WRITES more than a process does, not less.
//!
//! `--reason` is `requiredOption`, and that is the whole point of the verb: a refusal
//! with no why is indistinguishable from someone quietly deleting the request.
//!
//! depends_on: src/inbox/layout.ts · src/inbox/process.ts · src/inbox/system_inbox.ts
//! impacts:    00_inbox/CONTEXT.md

import { Command } from "commander";
import { appendFileSync } from "node:fs";
import { join, relative } from "node:path";
import { inboxAt, locate, moveTo } from "./layout.ts";
import type { Inbox } from "./system_inbox.ts";

export function command(): Command {
  return new Command("drop")
    .description("O item não vira nada — arquiva com o PORQUÊ, que é obrigatório.")
    .argument("<name>", "o NOME do item — a pasta dele, ex.: `specialized_skills`")
    .requiredOption("-r, --reason <porque>", "por que não vira nada. Recusa sem porquê é o mesmo que apagar")
    .option("-t, --to <inbox>", "a inbox. Omitida, é a da casa (`00_inbox/`)");
}

export function main(argv: string[]): number {
  const cmd = command().exitOverride();
  try {
    cmd.parse(argv, { from: "user" });
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1;
  }
  const [name] = cmd.args;
  const opts = cmd.opts();

  let inbox: ReturnType<typeof inboxAt>;
  try {
    inbox = inboxAt(opts.to);
  } catch (e) {
    console.error((e as Error).message);
    return 1;
  }

  const item = locate(inbox.dir, name);
  if (!item) {
    console.error(`nenhum item ${name} em ${inbox.dir}`);
    return 1;
  }
  if (item.answered) {
    console.error(`o item ${name} já foi respondido (\`#${item.answered}\`) — registro não se reescreve`);
    return 1;
  }

  const reason: Parameters<Inbox["drop"]>[1] = opts.reason;
  appendFileSync(item.file, `\n\`#dropped\` — ${reason}\n`);

  let dir: string;
  try {
    dir = moveTo(item, inbox.dir, "archive");
  } catch (e) {
    console.error(`${(e as Error).message} — registro congelado, não se sobrescreve`);
    return 1;
  }

  console.log(relative(process.cwd(), join(dir, "CONTEXT.md")));
  console.log(`(item ${name}: \`${item.state}\` → \`archive\`, não virou nada)`);
  return 0;
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
