#!/usr/bin/env bun
//! Os boards, ou os cards de um — com a coluna, o WIP e quem está bloqueando.
//!
//!     my kanban list                          todos os boards, com o WIP de cada
//!     my kanban list my-teams-v1               os cards do board
//!     my kanban list my-teams-v1 --column doing
//!     my kanban list my-teams-v1 --labels bug,p1
//!     my kanban list --json | --jsonl | --tsv
//!
//! depends_on: src/kanban/model.ts · src/shared/gh.ts
//! impacts:    —

import { fmtOf, out } from "../shared/gh.ts";
import { blocked, board, boards, cards, wip } from "./model.ts";

export function main(argv: string[]): number {
	const [arg] = argv.filter((a) => !a.startsWith("--"));
	const fmt = fmtOf(argv);

	if (!arg) {
		const rows = boards().map((b) => ({ board: b.name, wip: wip(b.name), blocked: blocked(b.name) }));
		if (fmt !== "human") {
			out(
				fmt,
				rows,
				(r) => [r.board, r.blocked.join(",") || ""],
				(r) => `${r.board}\t${r.blocked.join(",")}`,
			);
			return 0;
		}
		for (const r of rows) {
			const cols = Object.entries(r.wip).map(([c, w]) => `${c}=${w.cards}${w.limit ? `/${w.limit}` : ""}`).join(" · ");
			console.log(`${r.board.padEnd(28)} ${cols}${r.blocked.length ? `  ⚠ ${r.blocked.join(",")} acima do limite` : ""}`);
		}
		if (!rows.length) console.log("nenhum board ainda — my kanban open <nome>");
		return 0;
	}

	const val = (f: string) => {
		const i = argv.indexOf(f);
		return i === -1 ? undefined : argv[i + 1];
	};
	if (!board(arg)) return console.error(`nenhum board \`${arg}\` — existem: ${boards().map((b) => b.name).join(", ")}`), 1;
	const labels = val("--labels")?.split(",").filter(Boolean);
	const rows = cards(arg, { column: val("--column"), labels });

	if (fmt !== "human") {
		out(
			fmt,
			rows,
			(r) => [r.board, r.task, r.column, r.service, r.labels.join(",")],
			(r) => `${r.board}\t${r.task}\t${r.column}\t${r.labels.join(",")}`,
		);
		return 0;
	}
	for (const r of rows) console.log(`${r.column.padEnd(11)} ${r.task}${r.labels.length ? `  [${r.labels.join(", ")}]` : ""}`);
	if (!rows.length) console.log("nada aqui");
	return 0;
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
