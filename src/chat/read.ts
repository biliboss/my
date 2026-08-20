#!/usr/bin/env bun
//! Lê um canal inteiro, do jeito que um humano lê — `View.read`
//! (@packages/interfaces/src/chat.ts). NUNCA consome nada: ver `seen.ts` pra mover cursor.
//!
//!     my chat read plantao-coding                # tudo, oldest first
//!     my chat read plantao-coding --thread 022    # só aquele assunto
//!     my chat read plantao-coding --n 20          # só as últimas 20
//!
//! Absorve `src/agents/chat.ts` sem `--monitor` — a parte que fica na tela
//! chamando de novo é `listen.ts`, que é o verbo difícil de verdade.
//!
//! depends_on: src/chat/store.ts
//! impacts:    src/agents/chat.ts

import type { ChatSystem } from "@biliboss/interfaces/chat.ts";
import { allMessages, type Msg } from "./store.ts";

export function read(channel: ChatSystem.ValueObjects.ChannelName, thread?: ChatSystem.ValueObjects.Thread): Msg[] {
	return allMessages().filter((m) => m.channel === channel && (!thread || m.thread === thread));
}

const show = (m: Msg) => console.log(`#${m.seq}  ${m.at.slice(11, 19)}  \x1b[1m${m.from}\x1b[0m → ${m.to}\n  ${m.text}`);

const at = (argv: string[], flag: string) => {
	const i = argv.indexOf(flag);
	return i > -1 ? argv[i + 1] : undefined;
};

export function main(argv: string[]): number {
	const channel = argv.find((a) => !a.startsWith("-"));
	if (channel === undefined) {
		console.error("usage: read <canal> [--thread <id>] [--n <N>]");
		return 2;
	}
	const thread = at(argv, "--thread");
	const n = Number(at(argv, "--n") ?? Infinity);
	for (const m of read(channel, thread).slice(-n)) show(m);
	return 0;
}

if (import.meta.main) process.exitCode = main(Bun.argv.slice(2));
