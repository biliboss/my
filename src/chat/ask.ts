#!/usr/bin/env bun
//! Fala e ESPERA — `Chat.ask` (@src/interfaces/chat.ts). Uma pergunta e um
//! recado não podem ler igual num canal: a resposta carrega `answers`, e
//! `unanswered.ts` é o que isso compra.
//!
//! BLOQUEIA de propósito, sem timeout — o contrato não declara um: `ask` é pra
//! quem vai FICAR esperando (um script, uma sessão parada), não pra sondagem. Quem
//! quer "pergunta sem bloquear" usa `say.ts`; quem quer bloquear com teto de
//! tempo tinha `my agents read --wait --timeout`, e isso virou `listen.ts`.
//!
//!     my chat ask plantao-coding qa-workflow "a #179 já foi?"
//!
//! depends_on: src/chat/store.ts · src/chat/say.ts

import type { ChatSystem } from "../interfaces/chat.ts";
import { allMessages, type Msg, whoAmI } from "./store.ts";
import { say } from "./say.ts";

const POLL_MS = 300;

export async function ask(
	channel: ChatSystem.ValueObjects.ChannelName,
	to: ChatSystem.ValueObjects.Addressee,
	question: string,
): Promise<Msg> {
	const asked = say(channel, to, question);
	const me = whoAmI();
	for (;;) {
		const reply = allMessages().find((m) => m.channel === channel && m.answers === asked.seq && m.to === me);
		if (reply) return reply;
		await Bun.sleep(POLL_MS);
	}
}

export async function main(argv: string[]): Promise<number> {
	const [channel, to, ...rest] = argv;
	if (channel === undefined || !to || rest.length === 0) {
		console.error('usage: ask <canal> <para> "<pergunta>"   (BLOQUEIA até responderem)');
		return 2;
	}
	const reply = await ask(channel, to, rest.join(" "));
	console.log(`#${reply.seq}  ${reply.from}: ${reply.text}`);
	return 0;
}

if (import.meta.main) process.exitCode = await main(Bun.argv.slice(2));
