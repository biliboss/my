#!/usr/bin/env bun
//! Wakes the teams when their queue gains something. It never assigns.
//!
//!     my teams watch                     every team, until Ctrl-C
//!     my teams watch --every 30          poll seconds (default 60)
//!     my teams watch --once              one pass, then exit — what a hook calls
//!
//! WAKING AND ASSIGNING ARE DIFFERENT ACTS, and keeping them apart is the whole
//! design: a woken member reads its own queue and helps itself, so "the team is
//! senior, it pulls" survives an automatic trigger. Assign here and every member
//! becomes a worker waiting to be told, which is the shape this replaced — 13 of
//! 20 requests sat 3 days because the trigger was a human (20/08).
//!
//! A SECOND WATCHER ON ONE QUEUE IS REFUSED. Claims stop duplicate WORK; nothing
//! stops duplicate WAKE-UPS, and two nudges 200ms apart is a member interrupted
//! mid-thought for the item it already saw.
//!
//! ONLY NEW WORK WAKES ANYBODY. The first pass records what is already waiting and
//! nudges nobody: a watcher started on a queue with eleven items would otherwise
//! open by shouting eleven times about work that has been sitting there for days.
//!
//! AND ONLY A FREE MEMBER IS WOKEN. Interrupting somebody mid-claim to tell them
//! about a queue they cannot take from is noise with a cost — the interrupt lands
//! in the middle of an edit.
//!
//! depends_on: src/teams/model.ts · src/teams/list.ts · src/herdr/panes/send.ts
//! impacts:    —

import { Command } from "commander";

import type { TeamsSystem } from "@biliboss/interfaces/teams.ts";
import { send } from "../herdr/panes/send.ts";
import { type Team, queueOf } from "./model.ts";
import { all } from "./list.ts";

const DEFAULT_EVERY_S = 60;

/** What a nudge says. It names the count and the verb, and nothing else — a wake
 *  that summarises the work has already made the decision the member exists to
 *  make. */
const nudge = (t: Team, role: string, fresh: number) =>
	`${fresh} new item(s) on your queue. \`my teams claim ${t.name} ${role} --next\` when you are free.`;

/** ONE PASS. Returns who was woken, so `--once` can say something and the loop can
 *  print a line only when something happened. */
export async function pass(seen: Map<string, Set<string>>, quiet = false): Promise<{ team: string; role: string; fresh: number }[]> {
	const woken: { team: string; role: string; fresh: number }[] = [];
	for (const t of await all()) {
		if (t.paused) continue;
		const now = queueOf(t.listens);
		const before = seen.get(t.name);
		seen.set(t.name, new Set(now));
		// First sight of this team: record and say nothing. See the header.
		if (!before) continue;

		const fresh = now.filter((w) => !before.has(w));
		if (!fresh.length) continue;

		const free = Object.entries(t.members).find(([, m]) => !m.claim);
		if (!free) continue;

		const [role, member] = free;
		if (!quiet) await send(member.pane, nudge(t, role, fresh.length));
		woken.push({ team: t.name, role, fresh: fresh.length });
	}
	return woken;
}

/** `Teams.watch()` (@packages/interfaces/teams.ts): the loop, and the handle that stops
 *  it. Returned rather than kept, because otherwise the only off switch is killing
 *  the process that also keeps the teams. */
export async function watch(everyS = DEFAULT_EVERY_S): Promise<TeamsSystem.Entities.Watch> {
	const seen = new Map<string, Set<string>>();
	const teams = await all();
	let live = true;
	const tick = async () => {
		while (live) {
			await pass(seen);
			await Bun.sleep(everyS * 1000);
		}
	};
	void tick();
	return {
		watching: teams.map((t) => t.listens.monitors),
		// Teams stay up: this ends only the waking, so it is safe mid-flight.
		stop: () => {
			live = false;
		},
	};
}

export function command(): Command {
	return new Command("watch")
		.description("Wake a team when its queue gains something. Never assigns.")
		.option("--every <seconds>", `poll interval (default ${DEFAULT_EVERY_S})`)
		.option("--once", "one pass, then exit — for a hook")
		.option("--dry", "say who WOULD be woken, and nudge nobody");
}

export async function main(argv: string[]): Promise<number> {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (err) {
		return (err as { exitCode?: number }).exitCode ?? 1;
	}
	const opts = cmd.opts();
	const everyS = Number(opts.every ?? DEFAULT_EVERY_S);

	const seen = new Map<string, Set<string>>();
	// The baseline pass, always silent — `--once` from a hook still has to learn
	// what was already there before it can call anything new.
	await pass(seen, true);
	if (opts.once) {
		const woken = await pass(seen, opts.dry);
		for (const w of woken) console.log(`${w.team}/${w.role} ← ${w.fresh} new`);
		return 0;
	}

	console.log(`watching ${seen.size} team(s) every ${everyS}s — Ctrl-C to stop`);
	for (;;) {
		await Bun.sleep(everyS * 1000);
		for (const w of await pass(seen, opts.dry)) console.log(`${new Date().toISOString()} ${w.team}/${w.role} ← ${w.fresh} new`);
	}
}

if (import.meta.main) main(process.argv.slice(2)).then((code) => process.exit(code));
