#!/usr/bin/env bun
//! Abre um canal — `Chat.open` (@packages/interfaces/chat.ts). Não é obrigatório
//! antes de `say`: `say` registra o canal sozinho na primeira mensagem. Isto
//! existe pra declarar `members` de antemão, quando alguém quer que `to: "all"`
//! signifique algo antes da primeira linha ser escrita.
//!
//! CHAVE NATURAL É O NOME: abrir um canal que já existe devolve o que já existia
//! — nunca duplica, nunca sobrescreve `members`.
//!
//!     my chat open plantao-coding qa-workflow coding-workflow gabriel
//!
//! depends_on: src/chat/store.ts

import type { ChatSystem } from "@biliboss/interfaces/chat.ts";
import { registerChannel, type Channel } from "./store.ts";

export function open(name: ChatSystem.ValueObjects.ChannelName, members: ChatSystem.ValueObjects.Addressee[] = []): Channel {
	return registerChannel(name, members);
}

export function main(argv: string[]): number {
	const [name, ...members] = argv;
	if (name === undefined) {
		console.error("usage: open <canal> [membro...]");
		return 2;
	}
	const c = open(name, members);
	console.log(`${c.name}\t${c.members.join(",")}\t${c.created_at}`);
	return 0;
}

if (import.meta.main) process.exitCode = main(Bun.argv.slice(2));
