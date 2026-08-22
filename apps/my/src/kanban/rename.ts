#!/usr/bin/env bun
//! Um board troca de nome — reusa `my projects rename` inteiro, porque Board É o
//! projeto e a varredura de citação já existe lá.
//!
//!     my kanban rename me-validate my_check_v1
//!
//! depends_on: src/kanban/model.ts · src/projects/rename.ts
//! impacts:    —

import { rename } from "./model.ts";

export function main(argv: string[]): number {
	const [from, to] = argv;
	if (!from || !to) return console.error("uso: my kanban rename <antigo> <novo>"), 1;
	try {
		rename(from, to);
		return 0;
	} catch (e) {
		return console.error((e as Error).message), 1;
	}
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
