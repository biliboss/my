#!/usr/bin/env bun
//! Fala num canal. `Chat.say` do contrato (@src/interfaces/chat.ts) — o único
//! verbo que escreve sem esperar resposta.
//!
//!     my chat say plantao-coding qa-workflow "afira a #179, mesmo contrato"
//!     my chat say plantao-coding all "build quebrou" --thread 022_my_teams
//!     echo "texto longo" | my chat say plantao-coding gabriel -
//!
//! `from` NUNCA é argumento — sai de `MY_AGENT`, e cai pra `gabriel` quando não
//! existe, porque quem digita na sessão principal é ele (mesma regra do
//! `src/agents/send.ts` que este arquivo substitui).
//!
//! depends_on: src/chat/store.ts
//! impacts:    src/chat/ask.ts · src/agents/send.ts

import type { ChatSystem } from "../interfaces/chat.ts";
import { append, type Msg, whoAmI } from "./store.ts";

export function say(
	channel: ChatSystem.ValueObjects.ChannelName,
	to: ChatSystem.ValueObjects.Addressee,
	text: string,
	thread?: ChatSystem.ValueObjects.Thread,
	answers?: ChatSystem.ValueObjects.Cursor,
): Msg {
	return append({ channel, from: whoAmI(), to, text, thread, answers });
}

export async function main(argv: string[]): Promise<number> {
	const [channel, to, ...rest] = argv;
	if (!channel || !to || rest.length === 0) {
		console.error('usage: say <canal> <para> "<texto>" [--thread <id>] [--answers <seq>]   (- lê do stdin)');
		return 2;
	}
	const i = rest.indexOf("--thread");
	const thread = i > -1 ? rest.splice(i, 2)[1] : undefined;
	const j = rest.indexOf("--answers");
	const answers = j > -1 ? Number(rest.splice(j, 2)[1]) : undefined;
	const text = rest[0] === "-" ? await Bun.stdin.text() : rest.join(" ");
	const m = say(channel, to, text, thread, answers);
	console.log(`#${m.seq} → ${to}`);
	return 0;
}

if (import.meta.main) process.exitCode = await main(Bun.argv.slice(2));
