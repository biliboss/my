#!/usr/bin/env bun
//! Os kinds e quantos recursos cada um tem; com um kind, as páginas dele.
//!
//!   my resources list                 os kinds, com a contagem e pra que serve cada um
//!   my resources list references       o vocabulário do sistema
//!   my resources list notes
//!
//! O KIND É ABERTO de propósito: a pasta que alguém criar amanhã em `03_resources/`
//! aparece aqui como ela mesma, sem ninguém inscrevê-la. `KINDS` no contrato descreve os
//! cinco conhecidos — a frase ao lado de cada um é o que impede uma nota de ser
//! arquivada como regra.
//!
//! depends_on: src/resources/store.ts · src/interfaces/resources.ts

import { KINDS, printNames, store } from "./store.ts";

export function main(argv: string[]): number {
	const kind = argv.find((a) => !a.startsWith("-"));
	if (kind) return printNames(store.list(kind));

	const counts = new Map<string, number>();
	for (const r of store.list()) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
	for (const [k, n] of [...counts].sort())
		console.log(`${String(n).padStart(4)}  ${k.padEnd(12)} ${(KINDS as Record<string, string>)[k] ?? ""}`);
	return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
