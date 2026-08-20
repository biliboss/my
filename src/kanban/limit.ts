#!/usr/bin/env bun
//! Ajusta o limite de uma coluna. `0` levanta o limite.
//!
//!     my kanban limit my-teams-v1 in_progress 3
//!     my kanban limit my-teams-v1 in_progress 0     # levanta
//!
//! depends_on: src/kanban/model.ts
//! impacts:    —

import { limit } from "./model.ts";

export function main(argv: string[]): number {
	const [board, column, n] = argv;
	if (!board || !column || n === undefined) return console.error("uso: my kanban limit <board> <coluna> <n>"), 1;
	if (!Number.isInteger(Number(n))) return console.error(`--limit espera um inteiro, veio: ${n}`), 1;
	try {
		const b = limit(board, column, Number(n));
		console.log(`${b.name}: ${Object.entries(b.limits).map(([c, l]) => `${c}=${l || "∞"}`).join(" · ")}`);
		return 0;
	} catch (e) {
		return console.error((e as Error).message), 1;
	}
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
