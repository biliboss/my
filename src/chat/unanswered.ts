#!/usr/bin/env bun
//! As perguntas abertas de um canal — `View.unanswered` (@packages/interfaces/src/chat.ts).
//! Hoje é a única razão pra alguém rolar um canal na mão; isto responde direto.
//!
//! UMA MENSAGEM CONTA COMO PERGUNTA quando ela mesma não é resposta de ninguém
//! (não carrega `answers`) e nenhuma outra mensagem do canal responde ela (nenhum
//! `answers` aponta pro `seq` dela). Uma `NOTE`/aviso sem resposta também sai
//! nesta lista — o contrato não distingue pergunta de aviso na FORMA, só o
//! `answers` de quem respondeu diferencia os dois na prática.
//!
//!     my chat unanswered plantao-coding
//!
//! depends_on: src/chat/store.ts

import type { ChatSystem } from "@biliboss/interfaces/chat.ts";
import { allMessages, type Msg } from "./store.ts";

export function unanswered(channel: ChatSystem.ValueObjects.ChannelName): Msg[] {
	const all = allMessages().filter((m) => m.channel === channel);
	const respondidas = new Set(all.map((m) => m.answers).filter((s): s is number => s !== undefined));
	return all.filter((m) => m.answers === undefined && !respondidas.has(m.seq));
}

const show = (m: Msg) => console.log(`#${m.seq}  ${m.at.slice(11, 19)}  \x1b[1m${m.from}\x1b[0m → ${m.to}\n  ${m.text}`);

export function main(argv: string[]): number {
	const channel = argv[0];
	if (channel === undefined) {
		console.error("usage: unanswered <canal>");
		return 2;
	}
	for (const m of unanswered(channel)) show(m);
	return 0;
}

if (import.meta.main) process.exitCode = main(Bun.argv.slice(2));
