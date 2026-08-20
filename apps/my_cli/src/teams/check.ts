#!/usr/bin/env bun
//! What is rotten about the teams — and it exits 1 when it finds anything.
//!
//!     my teams check
//!     my teams check --tsv        one line per finding, for awk
//!
//! THREE QUESTIONS, and the disk of NOW answers all three:
//!
//!   two teams, one subscription   two plantões sharing a window, answerable for
//!                                 neither — the contract's own words. Both get
//!                                 woken, both reach for the same item, and the
//!                                 loser paid for a workspace to lose a race.
//!   a badge nobody owns           `.doing/claim.json` naming a team that has no
//!                                 lineup. The team went down holding work, and
//!                                 the queue has been short by one ever since.
//!   a lineup that will not parse   a team nothing can describe. Every read here
//!                                 skips it silently so the rest keeps working;
//!                                 this is the one place that says it out loud.
//!
//! SYNCHRONOUS AND DISK-ONLY, and that is a refusal, not an oversight. The
//! contract's `check()` also wants "no claim without a LIVE owner" and "work held
//! by nobody while a team is idle" — both need herdr, both need `await`, and
//! `house.check()` finds checks by `require()`ing modules synchronously. A check
//! that answered those would stop being findable by the runner, which is worth
//! more than two findings. `my teams list` shows the live half.
//!
//! depends_on: src/teams/model.ts · src/tasks/claim.ts · src/shared/findings.ts
//! impacts:    src/shared/house.ts

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { emit } from "../shared/findings.ts";
import { crachaDe } from "../tasks/claim.ts";
import { pastasDeTask, rel } from "../tasks/model.ts";
import { STORE, type Stored, slugOf, stored } from "./model.ts";

export type Finding = { path: string; says: string };

/** A subscription flattened to a string — the natural key a team is answerable
 *  for. Kinds sorted, because the same two kinds in two orders is the same watch. */
const key = (s: Stored) => `${JSON.stringify(s.listens.monitors)}|${[...s.listens.kinds].sort().join(",")}`;

export function check(): Finding[] {
	const findings: Finding[] = [];
	const lineups = stored();

	// 1. Two plantões on one queue.
	const byKey = new Map<string, string[]>();
	for (const s of lineups) byKey.set(key(s), [...(byKey.get(key(s)) ?? []), s.name]);
	for (const [, names] of byKey) {
		if (names.length > 1)
			findings.push({
				path: join(STORE, `${names[0]}.json`),
				says: `${names.join(" and ")} watch the same queue — both get woken, both reach for the same item, and one of them paid for a workspace to lose the race`,
			});
	}

	// 2. A badge naming a team that no longer exists.
	const known = new Set(lineups.map((s) => s.name));
	for (const slug of new Set(lineups.map((s) => slugOf(s.listens.monitors)))) {
		for (const dir of pastasDeTask(slug)) {
			const c = crachaDe(dir);
			if (c?.team && !known.has(c.team))
				findings.push({
					path: rel(dir),
					says: `held by \`${c.team}\` since ${c.at}, and that team has no lineup — it went down holding this, and the queue has been short by one ever since`,
				});
		}
	}

	// 3. A lineup nothing can read.
	if (existsSync(STORE)) {
		for (const f of readdirSync(STORE).filter((f) => f.endsWith(".json"))) {
			try {
				JSON.parse(readFileSync(join(STORE, f), "utf8"));
			} catch (err) {
				findings.push({
					path: join(STORE, f),
					says: `unreadable lineup — every read skips it silently: ${err instanceof Error ? err.message : String(err)}`,
				});
			}
		}
	}

	return findings;
}

export function main(argv: string[] = Bun.argv.slice(2)): number {
	const findings = check();
	return emit(argv, {
		json: { lineups: stored().length },
		findings,
		cols: (f) => [f.path, f.says],
		human: () => {
			for (const f of findings) console.log(`✗ ${f.path}\n  ${f.says}`);
			console.log(`${stored().length} lineup(s) · ${findings.length} finding(s)`);
		},
	});
}

if (import.meta.main) process.exit(main());
