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
//!
//! O domínio mora em `@my/chat`; aqui fica só o que a CLI imprime.

import * as chat from "@my/chat";
const { say, ask, read, inbox, unanswered, seen, listen, check, allMessages, listChannels, registerChannel, show, busPath, now, whoAmI } = chat as any;

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

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
