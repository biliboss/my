#!/usr/bin/env bun
//! Põe labels num card (substitui a lista inteira). RECUSA duas labels do mesmo
//! grupo — um grupo é exclusivo, é o que faz uma swimlane fazer sentido.
//!
//!     my kanban tag 999_001_slug bug,p1
//!     my kanban tag 999_001_slug ""        # tira todas
//!
//! depends_on: src/kanban/model.ts
//! impacts:    —

import { tag } from "./model.ts";

export function main(argv: string[]): number {
	const [task, labels] = argv;
	if (!task || labels === undefined) return console.error("uso: my kanban tag <task> <labels,separadas,por,vírgula>"), 1;
	try {
		const c = tag(task, labels.split(",").filter(Boolean));
		console.log(`${c.board}#${c.task}  labels: ${c.labels.join(", ") || "—"}`);
		return 0;
	} catch (e) {
		return console.error((e as Error).message), 1;
	}
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
