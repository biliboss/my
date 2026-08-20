#!/usr/bin/env bun
//! Apelido fino de `my chat read` (+ `my chat listen` pro `--monitor`). FICA —
//! `my agents chat --monitor` está citado em `cc_bus.md` e no CONTEXT.md dos
//! workflows como a tela do humano (@CLAUDE.md: a chamada antiga não pode
//! quebrar).
//!
//! `--who` do jeito velho filtrava `from OU to`, sem endereçamento nenhum —
//! `chat --monitor` é a tela do HUMANO, que quer ver a frota inteira conversar,
//! e `Chat.listen` do contrato é endereçado (`to === me`). Os dois têm público
//! diferente por desenho (@src/interfaces/chat.ts:121), então o `--monitor`
//! velho NÃO vira `listen`: continua um poll direto no disco, igual sempre foi,
//! só que lendo `store.allMessages()` em vez do `.my_agents_chat.tsv` que
//! morreu.
//!
//!     my agents chat                  # as últimas 20 linhas, todo mundo
//!     my agents chat --monitor        # e fica na tela, mostrando o que chega
//!     my agents chat --n 60           # mais fundo
//!     my agents chat --who qa-workflow  # só o que ele mandou ou recebeu
//!
//! Canal sempre `""` — ver `src/agents/send.ts`.
//!
//! depends_on: src/chat/read.ts · src/chat/store.ts

import { read } from "../chat/read.ts";
import { allMessages, type Msg } from "../chat/store.ts";

const show = (m: Msg) => console.log(`\x1b[2m${m.at.slice(11, 19)}\x1b[0m  \x1b[1m${m.from}\x1b[0m → ${m.to}\n  ${m.text}`);

const at = (argv: string[], flag: string) => {
	const i = argv.indexOf(flag);
	return i > -1 ? argv[i + 1] : undefined;
};

export async function main(argv: string[]): Promise<number> {
	const who = at(argv, "--who");
	const n = Number(at(argv, "--n") ?? 20);
	const mine = (m: Msg) => !who || m.from === who || m.to === who;

	for (const m of read("").filter(mine).slice(-n)) show(m);

	if (!argv.includes("--monitor")) return 0;

	// A posição é a CONTAGEM DE MENSAGENS, não bytes — mesma regra do `chat.ts`
	// velho: o arquivo só cresce por linha inteira, e contar linhas sobrevive a
	// um write parcial.
	let seenTotal = allMessages().length;
	console.log("\x1b[2m— monitorando; ctrl-c para sair —\x1b[0m");
	let stopped = false;
	process.once("SIGINT", () => {
		stopped = true;
	});
	while (!stopped) {
		await Bun.sleep(2000);
		const all = allMessages().filter((m) => m.channel === "");
		if (all.length > seenTotal) {
			for (const m of all.slice(seenTotal).filter(mine)) show(m);
			seenTotal = all.length;
		}
	}
	return 0;
}

if (import.meta.main) process.exitCode = await main(Bun.argv.slice(2));
