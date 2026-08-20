#!/usr/bin/env bun
//! Move o MEU cursor, explicitamente — `Chat.seen` (@packages/interfaces/src/chat.ts).
//! NUNCA é efeito colateral de `read`/`inbox`: um agente que estoura no meio do
//! trabalho tem que achar a MESMA mensagem quando voltar. `listen.ts` chama isto
//! sozinho, só depois que o handler retorna — aqui é a porta pra quem quiser
//! mover na mão.
//!
//!     my chat seen plantao-coding qa-workflow 42
//!
//! depends_on: src/chat/store.ts

import type { ChatSystem } from "@biliboss/interfaces/chat.ts";
import { setCursor } from "./store.ts";

export function seen(
	channel: ChatSystem.ValueObjects.ChannelName,
	me: ChatSystem.ValueObjects.Addressee,
	upto: ChatSystem.ValueObjects.Cursor,
): void {
	setCursor(channel, me, upto);
}

export function main(argv: string[]): number {
	const [channel, me, upto] = argv;
	if (channel === undefined || !me || upto === undefined || Number.isNaN(Number(upto))) {
		console.error("usage: seen <canal> <eu> <upto>");
		return 2;
	}
	seen(channel, me, Number(upto));
	return 0;
}

if (import.meta.main) process.exitCode = main(Bun.argv.slice(2));
