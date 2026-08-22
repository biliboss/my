#!/usr/bin/env bun
//! Lê um canal — `View.read` (@packages/interfaces/chat.ts). Absorve `inbox.ts`
//! (`--mine`), `unanswered.ts` (`--open`) e `seen.ts` (`--seen`): mesmo arquivo,
//! um leitor só. NUNCA avança cursor sozinho como efeito de ler — `--seen` é
//! sempre explícito, do jeito que `seen.ts` sempre foi.
//!
//!     my chat read plantao-coding                             # tudo, oldest first
//!     my chat read plantao-coding --thread 022                 # só aquele assunto
//!     my chat read plantao-coding --n 20                       # só as últimas 20
//!     my chat read plantao-coding --mine qa-workflow            # só o meu, depois do meu cursor
//!     my chat read plantao-coding --open                       # perguntas sem resposta
//!     my chat read plantao-coding --mine qa-workflow --seen 42  # lê e marca até #42
//!
//! Absorve `src/agents/chat.ts` sem `--monitor` — a parte que fica na tela
//! chamando de novo é `listen.ts`, que reusa o `show()` daqui.
//!
//! depends_on: src/chat/store.ts
//! impacts:    src/agents/chat.ts · src/agents/read.ts · src/chat/listen.ts · src/chat/index.ts

import type { ChatSystem } from "@biliboss/interfaces/chat.ts";
import { allMessages, getCursor, setCursor, type Msg } from "./store.ts";

export function read(channel: ChatSystem.ValueObjects.ChannelName, thread?: ChatSystem.ValueObjects.Thread): Msg[] {
	return allMessages().filter((m) => m.channel === channel && (!thread || m.thread === thread));
}

/** O que chegou pra MIM, depois do meu cursor — absorve `View.inbox`. NÃO avança
 *  cursor nenhum: `seen()` abaixo é a única porta pra isso, e `listen.ts` é quem
 *  a chama sozinho, só depois que o handler retorna. */
export function inbox(
	channel: ChatSystem.ValueObjects.ChannelName,
	me: ChatSystem.ValueObjects.Addressee,
	since?: ChatSystem.ValueObjects.Cursor,
): Msg[] {
	const cursor = since ?? getCursor(channel, me);
	return allMessages().filter((m) => m.channel === channel && m.seq > cursor && (m.to === me || m.to === "all"));
}

/** Perguntas abertas de um canal — absorve `View.unanswered`. Uma mensagem
 *  conta como pergunta quando ela mesma não é resposta de ninguém (sem
 *  `answers`) e nenhuma outra mensagem do canal a responde (nenhum `answers`
 *  aponta pro `seq` dela). */
export function unanswered(channel: ChatSystem.ValueObjects.ChannelName): Msg[] {
	const all = allMessages().filter((m) => m.channel === channel);
	const answered = new Set(all.map((m) => m.answers).filter((s): s is number => s !== undefined));
	return all.filter((m) => m.answers === undefined && !answered.has(m.seq));
}

/** Move o cursor de `me`, explicitamente — absorve `Chat.seen`. NUNCA um efeito
 *  colateral de ler: aqui é a porta pra quem move na mão, inclusive via
 *  `--seen` nesta CLI. */
export function seen(
	channel: ChatSystem.ValueObjects.ChannelName,
	me: ChatSystem.ValueObjects.Addressee,
	upto: ChatSystem.ValueObjects.Cursor,
): void {
	setCursor(channel, me, upto);
}

export const show = (m: Msg) => console.log(`#${m.seq}  ${m.at.slice(11, 19)}  \x1b[1m${m.from}\x1b[0m → ${m.to}\n  ${m.text}`);

const at = (argv: string[], flag: string) => {
	const i = argv.indexOf(flag);
	return i > -1 ? argv[i + 1] : undefined;
};

export function main(argv: string[]): number {
	const channel = argv.find((a) => !a.startsWith("-"));
	if (channel === undefined) {
		console.error("usage: read <canal> [--thread <id>] [--n <N>] [--mine <eu>] [--open] [--seen <seq>]");
		return 2;
	}
	const thread = at(argv, "--thread");
	const n = Number(at(argv, "--n") ?? Infinity);
	const me = at(argv, "--mine");
	const open = argv.includes("--open");
	const seenAt = at(argv, "--seen");

	let msgs: Msg[];
	if (open) msgs = unanswered(channel).filter((m) => !thread || m.thread === thread);
	else if (me) msgs = inbox(channel, me).filter((m) => !thread || m.thread === thread);
	else msgs = read(channel, thread);

	for (const m of msgs.slice(-n)) show(m);

	if (seenAt !== undefined) {
		if (!me) {
			console.error("--seen precisa de --mine <eu>: de quem é o cursor?");
			return 2;
		}
		seen(channel, me, Number(seenAt));
	}
	return 0;
}

if (import.meta.main) process.exitCode = main(Bun.argv.slice(2));
