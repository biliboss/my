#!/usr/bin/env bun
//! O que está torto no `chat` — `House.check()` acha isto POR FORMA
//! (@src/shared/house.ts), então nenhum registro é preciso.
//!
//! DUAS PERGUNTAS, as mesmas que o contrato promete em `View.check()`
//! (@src/interfaces/chat.ts:110): nenhuma mensagem sem `from`, e nenhum
//! `answers` apontando pra um `seq` que não existe.
//!
//!     my chat check
//!
//! depends_on: src/chat/store.ts

import { allMessages } from "./store.ts";

export type Finding = { path: string; says: string };

export function check(): Finding[] {
	const all = allMessages();
	const seqs = new Set(all.map((m) => m.seq));
	const achados: Finding[] = [];
	for (const m of all) {
		const path = `.my_chat.tsv#${m.seq}`;
		if (!m.from) achados.push({ path, says: "mensagem sem `from`" });
		if (m.answers !== undefined && !seqs.has(m.answers)) {
			achados.push({ path, says: `\`answers\` aponta pro seq #${m.answers}, que não existe` });
		}
	}
	return achados;
}

export function main(argv: string[]): number {
	const achados = check();
	for (const a of achados) console.log(`${a.path}\t${a.says}`);
	if (!argv.includes("--json") && achados.length === 0) console.log("chat: nada torto");
	return achados.length ? 1 : 0;
}

if (import.meta.main) process.exitCode = main(Bun.argv.slice(2));
