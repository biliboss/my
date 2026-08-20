#!/usr/bin/env bun
//! `my inbox pull` — take a request out of the pile and start working on it.
//!
//!     my inbox pull specialized_skills
//!     my inbox pull specialized_skills --to 01_projects/via-nextjs/inbox
//!     my inbox pull --next                 # the oldest thing in the backlog
//!
//! `backlog → ready`: the item's folder moves to the inbox root, in the open, and
//! the agent's pane is steered with it. THIS is where the waking happens — capture
//! only writes. Deciding to work on something is a separate act from having the
//! idea, and before 20/08 the two were the same act, which is how 13 requests sat
//! parked for 3 days looking exactly like the ones nobody had read.
//!
//! The line that goes to the pane is a numbered READING LIST, and the order is the
//! execution order: the request, then the ramp that routes it. Bare paths read as
//! "open these files". ABSOLUTE paths, never `@` — `@` opens Claude Code's file
//! autocomplete and the Enter that follows picks a suggestion instead of sending.
//! ONE line, never one per file: `send-text` with `\n` SENDS, so a multi-line
//! message becomes N messages, and Claude Code's queue is LIFO — the final
//! instruction would arrive BEFORE the request.
//!
//! depends_on: src/inbox/layout.ts · src/inbox/system_inbox.ts · src/herdr/panes/send.ts
//! impacts:    02_areas/00_workflows/02_system/001_user_prompt/CONTEXT.md

import { Command } from "commander";
import { relative } from "node:path";
import { home } from "../shared/file.ts";
import { send } from "../herdr/panes/send.ts";
import { inboxAt, items, locate, moveTo } from "./layout.ts";
import type { Inbox } from "./system_inbox.ts";

const ROOT = home();
/** Where the wake-up lands today. It is the ADDRESS in an env var instead of in the
 *  model, and `InboxSystem.ValueObjects.AgentName` is where it belongs — the item will
 *  name its agent and this constant goes away. */
const PANE = process.env.INBOX_PANE ?? "w2B:p1";

export function command(): Command {
  return new Command("pull")
    .description("Puxa o item do backlog pro root da inbox e acorda o agente.")
    .argument("[name]", "o NOME do item. Omitido, use --next")
    .option("-n, --next", "o mais antigo do backlog — a fila em ordem de chegada")
    .option("-t, --to <inbox>", "a inbox. Omitida, é a da casa (`00_inbox/`)")
    .option("-q, --quiet", "move sem acordar ninguém");
}

export async function main(argv: string[]): Promise<number> {
  const cmd = command().exitOverride();
  try {
    cmd.parse(argv, { from: "user" });
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1;
  }
  const opts = cmd.opts();
  let [name] = cmd.args;

  let inbox: ReturnType<typeof inboxAt>;
  try {
    inbox = inboxAt(opts.to);
  } catch (e) {
    console.error((e as Error).message);
    return 1;
  }

  if (!name) {
    if (!opts.next) {
      console.error("diga o nome do item, ou --next pro mais antigo do backlog");
      return 1;
    }
    // `items` já vem ordenado por `created_at`: o primeiro é o mais antigo.
    const [first] = items(inbox.dir, "backlog");
    if (!first) {
      console.log("backlog vazio");
      return 0;
    }
    name = first.name;
  }

  const item = locate(inbox.dir, name);
  if (!item) {
    console.error(`nenhum item ${name} em ${inbox.dir}`);
    return 1;
  }
  if (item.state !== "backlog") {
    console.error(`o item ${name} já está em \`${item.state}\` — pull só tira do backlog`);
    return 1;
  }

  // Typed off the aggregate's own signature, like every other verb: the CLI knows
  // `Inbox` and nothing of the internals.
  const pulled: Parameters<Inbox["pull"]>[0] = name;
  const dir = moveTo(item, inbox.dir, "ready");
  console.log(relative(process.cwd(), dir));

  if (opts.quiet) return 0;

  const line =
    `1) ${dir}/CONTEXT.md (o item ${pulled})  ` +
    `2) ${ROOT}/02_areas/00_workflows/02_system/001_user_prompt/CONTEXT.md  ` +
    `— siga as instruções de cada arquivo, NA ORDEM: o pedido, e a rampa que o roteia.`;
  // Pelo caso de uso, nunca por `Bun.$`: @src/herdr/run.ts é o ÚNICO lugar que sai
  // pro herdr, por causa do timeout. E `panes/send.ts` traz a pausa antes do Enter
  // (sem ela, oito de nove panes ficam com o texto digitado e NÃO submetido) e o
  // exit code separado das duas chamadas.
  const sent = await send(PANE, line);
  console.log(
    sent.ok
      ? `(mandado pro pane ${PANE})`
      : `(pane ${PANE} NÃO recebeu — ${sent.error}. O item está em \`ready\` do mesmo jeito)`,
  );
  return 0;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));
