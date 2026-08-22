#!/usr/bin/env bun
//! `my inbox process` — the item became something, and this says WHAT.
//!
//!     my inbox process specialized_skills --became 01_projects/inbox-v1/
//!     my inbox process specialized_skills --became "sprints/001_x/" --to 01_projects/via-nextjs/inbox
//!
//! `Inbox.process` made runnable: the answer is written INSIDE the
//! item's own `CONTEXT.md` and the whole folder moves into `archive/`. Request and
//! answer travel together — no second file to keep in sync, and nothing to link.
//!
//! Valid from `ready` and from `backlog` both: most of what gets answered on sight
//! was never pulled, and forcing a pull first would be ceremony.
//!
//! WHY THIS IS A VERB. Writing two lines of markdown was never the expensive part —
//! REFUSING is. Answering an item twice, naming an item that is not there, or
//! landing on an `archive/` folder that already exists are all silent when a human
//! does them in an editor. Those three guards are the reason this file exists.
//!
//! It does not do the work and does not decide what the item becomes: `--became` is
//! the caller's answer, and this only records it.
//!
//! depends_on: src/inbox/layout.ts · src/inbox/system_inbox.ts · 01_projects/inbox-v1/docs/03_system_design_processamento.md
//! impacts:    src/inbox/drop.ts · 00_inbox/CONTEXT.md

import { Command } from "commander";
import { appendFileSync } from "node:fs";
import { join, relative } from "node:path";
import { inboxAt, locate, moveTo } from "./layout.ts";
import type { Inbox } from "./system_inbox.ts";

export function command(): Command {
  return new Command("process")
    .description("O item virou alguma coisa: escreve dentro dele e move pra archive/.")
    .argument("<name>", "o NOME do item — a pasta dele, ex.: `specialized_skills`")
    .requiredOption("-b, --became <destino>", "onde o trabalho passou a morar: um run, uma sprint, um projeto, uma nota")
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
  // Answering twice is the failure a human editor never catches: the second answer
  // would sit under the first, and only one of them shipped.
  if (item.answered) {
    console.error(`o item ${name} já foi respondido (\`#${item.answered}\`) — registro não se reescreve`);
    return 1;
  }

  // Typed off the aggregate's own signature: a rename in `system_inbox.ts` fails
  // here instead of drifting.
  const became: Parameters<Inbox["process"]>[1] = opts.became;
  // The answer goes in BEFORE the move: if the move fails, the item is still where it
  // was, carrying the answer — the other order loses the answer instead.
  appendFileSync(item.file, `\n\`#processed\` · virou ${became}\n`);

  let dir: string;
  try {
    dir = moveTo(item, inbox.dir, "archive");
  } catch (e) {
    console.error(`${(e as Error).message} — registro congelado, não se sobrescreve`);
    return 1;
  }

  console.log(relative(process.cwd(), join(dir, "CONTEXT.md")));
  console.log(`(item ${name}: \`${item.state}\` → \`archive\`, virou ${became})`);
  return 0;
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
