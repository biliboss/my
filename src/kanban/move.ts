#!/usr/bin/env bun
//! Move um card de coluna. RECUSA quando a coluna de destino está no limite.
//!
//!     my kanban move 999_001_slug in_progress
//!
//! depends_on: src/kanban/model.ts
//! impacts:    —

import { move } from "./model.ts";

export function main(argv: string[]): number {
	const [task, to] = argv;
	if (!task || !to) return console.error("uso: my kanban move <task> <coluna>"), 1;
	try {
		const c = move(task, to);
		console.log(`${c.board}#${c.task}  → ${c.column}/`);
		return 0;
	} catch (e) {
		return console.error((e as Error).message), 1;
	}
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
