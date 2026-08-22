#!/usr/bin/env bun
//! Declara uma label num board, ou redefine ela — nome já existente, sobrescreve.
//!
//!     my kanban label my-teams-v1 bug
//!     my kanban label my-teams-v1 p1 --group priority --color red --description "trava release"
//!
//! depends_on: src/kanban/model.ts
//! impacts:    —

import { label } from "./model.ts";

export function main(argv: string[]): number {
	const [board, name, ...flags] = argv;
	if (!board || !name) return console.error("uso: my kanban label <board> <nome> [--group g] [--color c] [--description d]"), 1;
	const val = (f: string) => {
		const i = flags.indexOf(f);
		return i === -1 ? undefined : flags[i + 1];
	};
	try {
		const b = label(board, { name, group: val("--group"), color: val("--color"), description: val("--description") });
		console.log(`${b.name}: ${b.labels.map((l) => (l.group ? `${l.name}[${l.group}]` : l.name)).join(", ")}`);
		return 0;
	} catch (e) {
		return console.error((e as Error).message), 1;
	}
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
