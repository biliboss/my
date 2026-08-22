#!/usr/bin/env bun
//! Como o board FLUI — um subcomando por COISA MEDIDA, igual a `my system metrics`.
//!
//!     my kanban metrics flow [--by <grupo>]
//!     my kanban metrics throughput [<dias>]
//!     my kanban metrics forecast <cards>
//!     my kanban metrics goal <cards> <YYYY-MM-DD>
//!     my kanban metrics aging
//!     my kanban metrics rework
//!     my kanban metrics efficiency
//!
//! TODOS lidos de `.kanban/moves/`, que só existe a PARTIR de hoje — nenhum card
//! fechado antes desta task tem história de coluna. `sample: 0` (ou `days: 3650`,
//! o teto da simulação) É a resposta honesta pra isso, não um bug: é o MESMO buraco
//! que @packages/interfaces/tasks.ts já documentou pra `Metrics.measure`, e a resposta é
//! a mesma — não inventar história que não foi gravada.
//!
//! depends_on: src/kanban/model.ts
//! impacts:    —

import * as k from "./model.ts";

export function main(argv: string[]): number {
	const [which, ...rest] = argv;
	switch (which) {
		case "flow": {
			const byAt = rest.indexOf("--by");
			console.log(JSON.stringify(k.flow(byAt === -1 ? undefined : rest[byAt + 1]), null, 2));
			return 0;
		}
		case "throughput":
			console.log(JSON.stringify(k.throughput(Number(rest[0] ?? 30))));
			return 0;
		case "forecast": {
			const n = Number(rest[0]);
			if (!Number.isInteger(n)) return console.error("uso: my kanban metrics forecast <n cards>"), 1;
			console.log(JSON.stringify(k.forecast(n), null, 2));
			return 0;
		}
		case "goal": {
			const n = Number(rest[0]);
			const by = rest[1];
			if (!Number.isInteger(n) || !by) return console.error("uso: my kanban metrics goal <n cards> <YYYY-MM-DD>"), 1;
			console.log(JSON.stringify(k.goal(n, by), null, 2));
			return 0;
		}
		case "aging":
			console.log(JSON.stringify(k.aging(), null, 2));
			return 0;
		case "rework":
			console.log(JSON.stringify(k.rework(), null, 2));
			return 0;
		case "efficiency": {
			const byAt = rest.indexOf("--by");
			console.log(JSON.stringify(k.efficiency(byAt === -1 ? undefined : rest[byAt + 1]), null, 2));
			return 0;
		}
		default:
			console.error("um de: flow · throughput · forecast · goal · aging · rework · efficiency");
			return 1;
	}
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
