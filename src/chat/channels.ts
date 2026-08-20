#!/usr/bin/env bun
//! Lista os canais conhecidos — `View.channels` (@src/interfaces/chat.ts). Um
//! canal existe pra este verbo quando `open.ts` o registrou OU quando `say.ts`
//! escreveu nele pela primeira vez (find-or-create em `store.ts:registerChannel`,
//! chave natural = nome).
//!
//!     my chat channels
//!
//! depends_on: src/chat/store.ts

import { listChannels } from "./store.ts";

export function main(argv: string[]): number {
	for (const c of listChannels()) {
		console.log(`${c.name || "(sem nome)"}\t${c.members.join(",")}\t${c.created_at}`);
	}
	return 0;
}

if (import.meta.main) process.exitCode = main(Bun.argv.slice(2));
