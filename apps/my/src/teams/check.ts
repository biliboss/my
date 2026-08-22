#!/usr/bin/env bun
//! What is rotten about the teams — and it exits 1 when it finds anything.
//!
//!     my teams check
//!     my teams check --tsv        one line per finding, for awk
//!
//! FOUR QUESTIONS, and the disk of NOW answers all four:
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
//!   a member not reading its room  its cursor is still at zero in a channel that
//!                                 already holds messages. `up` briefs every
//!                                 member in that room, so this is a handoff going
//!                                 into the void — and it looks exactly like a
//!                                 quiet team from outside.
//!
//! SYNCHRONOUS AND DISK-ONLY, and that is a refusal, not an oversight. The
//! contract's `check()` also wants "no claim without a LIVE owner" and "work held
//! by nobody while a team is idle" — both need herdr, both need `await`, and
//! `house.check()` finds checks by `require()`ing modules synchronously. A check
//! that answered those would stop being findable by the runner, which is worth
//! more than two findings. `my teams list` shows the live half.
//!
//! `src/chat/store.ts` IS SAFE TO IMPORT HERE and every other path into the fleet
//! is not: the chat store is 100% synchronous — plain `node:fs` and `home/paths.ts`
//! — which is the same reason `src/chat/check.ts` reads it directly instead of
//! calling `who()`.
//!
//! depends_on: src/teams/model.ts · src/tasks/claim.ts · src/chat/store.ts ·
//!             src/shared/findings.ts
//! impacts:    src/shared/house.ts

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { allMessages, getCursor } from "../chat/store.ts";
import { emit } from "../shared/findings.ts";
import { crachaDe } from "../tasks/claim.ts";
import { pastasDeTask, rel } from "../tasks/model.ts";
import { STORE, type Stored, channelOf, memberName, slugOf, stored } from "./model.ts";

export type Finding = { path: string; says: string };

/** A subscription flattened to a string — the natural key a team is answerable
 *  for. Kinds sorted, because the same two kinds in two orders is the same watch. */
const key = (s: Stored) => `${JSON.stringify(s.listens.monitors)}|${[...s.listens.kinds].sort().join(",")}`;

/** HOW MANY MESSAGES A ROOM HOLDS, by FILTERING the channel — never the largest
 *  `seq` in it. `seq` is a GLOBAL address across the whole TSV and does not
 *  restart per channel (@src/chat/store.ts), so the biggest `seq` of a room also
 *  counts every line every OTHER room wrote in between. Measured 21/08 against 569
 *  real lines: the channel `pm` held 32 messages and that arithmetic said 569. A
 *  single-channel test never catches it — the two numbers agree until a second
 *  channel exists. */
export const countIn = (msgs: { channel: string }[], channel: string): number =>
	msgs.filter((m) => m.channel === channel).length;

/** A MEMBER THAT HAS NEVER OPENED ITS OWN ROOM. `my chat check` calls the same
 *  shape NO READER, asked from the CHANNEL's side, off `Channel.members`; this
 *  asks it from the LINEUP's side, where the member is expected whether or not
 *  anybody registered it — which is exactly the team assembled before the join
 *  existed, the one nothing else can see.
 *
 *  PURE, and the two readings are handed in rather than imported. `MY_HOME` decides
 *  where the chat file lives and `src/tasks/model.ts` freezes `RAIZ` off the same
 *  env at IMPORT time, so a test that repointed the house to prove this one rule
 *  would repoint it for every teams test loaded after it — `bun test` runs a
 *  package's files in one process, and `check()` below wires the real store. */
export function unreadRooms(
	lineups: Stored[],
	holds: (channel: string) => number,
	cursor: (channel: string, who: string) => number,
): Finding[] {
	const findings: Finding[] = [];
	for (const s of lineups) {
		const channel = channelOf(s);
		const count = holds(channel);
		// An empty room is not a silent one: there is nothing to be behind on.
		if (!count) continue;
		for (const role of new Set(s.roles)) {
			const me = memberName(s.name, role);
			if (cursor(channel, me) > 0) continue;
			findings.push({
				path: `.my_chat.tsv#${channel}`,
				says: `${me} has never read a line of \`${channel}\`, which holds ${count} message(s) — the team is being told things in a room nobody in it opens`,
			});
		}
	}
	return findings;
}

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

	// 4. A member not reading its own room.
	const msgs = allMessages();
	findings.push(...unreadRooms(lineups, (channel) => countIn(msgs, channel), getCursor));

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
