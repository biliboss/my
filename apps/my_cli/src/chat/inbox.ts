#!/usr/bin/env bun
//! O que chegou pra MIM, depois do meu cursor — `View.inbox`
//! (@packages/interfaces/chat.ts). Endereçado, ao contrário de `read.ts`: é o que um
//! agente que acordou lê em vez de reler um canal que divide com três outros.
//!
//! NÃO avança cursor nenhum — o contrato é explícito (`chat.ts:187`): `seen`
//! nunca é efeito de leitura. É exatamente o bug medido em `src/agents/read.ts`
//! que este sistema existe pra matar.
//!
//!     my chat inbox plantao-coding qa-workflow
//!     my chat inbox plantao-coding qa-workflow --since 12
//!
//! depends_on: src/chat/store.ts
//! impacts:    src/chat/listen.ts

import type { ChatSystem } from "@biliboss/interfaces/chat.ts";
import { allMessages, getCursor, type Msg } from "./store.ts";

export function inbox(
	channel: ChatSystem.ValueObjects.ChannelName,
	me: ChatSystem.ValueObjects.Addressee,
	since?: ChatSystem.ValueObjects.Cursor,
): Msg[] {
	const cursor = since ?? getCursor(channel, me);
	return allMessages().filter((m) => m.channel === channel && m.seq > cursor && (m.to === me || m.to === "all"));
}

const show = (m: Msg) => console.log(`#${m.seq}  ${m.at.slice(11, 19)}  \x1b[1m${m.from}\x1b[0m → ${m.to}\n  ${m.text}`);

export function main(argv: string[]): number {
	const [channel, me, ...rest] = argv;
	if (channel === undefined || !me) {
		console.error("usage: inbox <canal> <eu> [--since <seq>]");
		return 2;
	}
	const i = rest.indexOf("--since");
	const since = i > -1 ? Number(rest[i + 1]) : undefined;
	for (const m of inbox(channel, me, since)) show(m);
	return 0;
}

if (import.meta.main) process.exitCode = main(Bun.argv.slice(2));
