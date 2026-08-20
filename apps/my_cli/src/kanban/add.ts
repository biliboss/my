#!/usr/bin/env bun
//! Confirma o rastreio de uma task já existente num board — labels e a primeira
//! entrada de `.kanban/moves/`. RECUSA quando a task mora noutro board: não existe
//! verbo nesta casa que troque o DONO de uma task, só o nome (`my kanban rename`).
//!
//!     my kanban add 999_001_slug my-teams-v1
//!     my kanban add 999_001_slug my-teams-v1 bug,p1
//!
//! depends_on: src/kanban/model.ts
//! impacts:    —

import { add } from "./model.ts";

export function main(argv: string[]): number {
	const [task, board, labels] = argv;
	if (!task || !board) return console.error("uso: my kanban add <task> <board> [labels,separadas,por,vírgula]"), 1;
	try {
		const c = add(task, board, labels ? labels.split(",").filter(Boolean) : []);
		console.log(`${c.board}#${c.task}  (${c.column}/)  labels: ${c.labels.join(", ") || "—"}`);
		return 0;
	} catch (e) {
		return console.error((e as Error).message), 1;
	}
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
