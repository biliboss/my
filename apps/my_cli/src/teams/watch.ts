#!/usr/bin/env bun
//! Wakes the teams when their queue gains something, or when their room does. It
//! never assigns.
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
//! AND ONLY A FREE MEMBER IS WOKEN — on the QUEUE. Interrupting somebody mid-claim
//! to tell them about a queue they cannot take from is noise with a cost, the
//! interrupt lands in the middle of an edit.
//!
//! THE ROOM IS THE OTHER HALF, and it plays by the opposite rule on purpose: a
//! member with a claim IS woken by its channel. A queue nudge says "take MORE
//! work", which is noise to somebody mid-edit; a line in the room is normally
//! ABOUT the work they are already holding, and the answer they are blocked on.
//! One channel per project with one manager writing into it is the shape the fleet
//! actually ran on, and the whole point is that the handoff costs no human.
//!
//! depends_on: src/teams/model.ts · src/teams/list.ts · src/chat/read.ts ·
//!             src/chat/store.ts · src/herdr/panes/send.ts
//! impacts:    —

import { Command } from "commander";

import type { TeamsSystem } from "@biliboss/interfaces/teams.ts";
import { inbox } from "../chat/read.ts";
import { getCursor } from "../chat/store.ts";
import { send } from "@biliboss/herdr/panes/send";
import { type Team, channelOf, queueOf } from "./model.ts";
import { all } from "./list.ts";

const DEFAULT_EVERY_S = 60;

/** WHAT EACH PASS HAS TO REMEMBER, and neither half can be derived from disk: the
 *  queue has no cursor at all, and the room's cursor belongs to the MEMBER — only
 *  it moves that, and only after it has read. */
export type Seen = { queue: Map<string, Set<string>>; room: Map<string, number> };
export const nothingSeenYet = (): Seen => ({ queue: new Map(), room: new Map() });

/** `why` because the two wakes cost different things: a queue nudge can wait for
 *  the member to be free, a message cannot. */
export type Woken = { team: string; role: string; fresh: number; why: "queue" | "room" };

/** What a nudge says. It names the count and the verb, and nothing else — a wake
 *  that summarises the work has already made the decision the member exists to
 *  make. */
const nudge = (t: Team, role: string, fresh: number) =>
	`${fresh} new item(s) on your queue. \`my teams claim ${t.name} ${role} --next\` when you are free.`;

const ping = (channel: string, me: string, fresh: number) =>
	`${fresh} new message(s) for you in \`${channel}\`. \`my chat read ${channel} --mine ${me}\` to take them, \`my chat say ${channel} <to> "…"\` to answer, and \`--seen <seq>\` when you are done.`;

/** WHAT IS WAITING FOR ONE MEMBER IN ITS ROOM: its chat inbox — after its cursor,
 *  addressed to it or to `all` — minus what it wrote itself. A broadcast lands in
 *  the sender's own inbox too, and waking an agent about its own message is the
 *  cheapest way to build a loop. */
export const pending = (channel: string, me: string) => inbox(channel, me).filter((m) => m.from !== me);

/** ONLY WHAT IS NEW SINCE THE LAST PASS. The first sight of a member returns
 *  `fresh: 0` — the same silence the queue opens with, for the same reason: a
 *  watcher started on a room holding eleven unread lines would open by shouting
 *  about a conversation from last week.
 *
 *  THE BASELINE IS A `seq` AND IT MOVES WHETHER THE MEMBER READS OR NOT. `watch`
 *  never touches a cursor — only the member does, after reading — so a baseline
 *  that waited for the cursor would nudge about the same line every 60 seconds
 *  forever. `upto` is what the caller records; it never goes back, because the
 *  cursor floor rises as the member reads and the waiting seqs rise as it does
 *  not. */
export function wake(waiting: { seq: number }[], cursor: number, before?: number): { fresh: number; upto: number } {
	const upto = waiting.reduce((mx, m) => Math.max(mx, m.seq), cursor);
	return { fresh: before === undefined ? 0 : waiting.filter((m) => m.seq > before).length, upto };
}

/** ONE PASS. Returns who was woken, so `--once` can say something and the loop can
 *  print a line only when something happened. */
export async function pass(seen: Seen, quiet = false): Promise<Woken[]> {
	const woken: Woken[] = [];
	for (const t of await all()) {
		if (t.paused) continue;

		const now = queueOf(t.listens);
		const before = seen.queue.get(t.name);
		seen.queue.set(t.name, new Set(now));
		// First sight of this team: record and say nothing. See the header.
		if (before) {
			const fresh = now.filter((w) => !before.has(w));
			const free = Object.entries(t.members).find(([, m]) => !m.claim);
			if (fresh.length && free) {
				const [role, member] = free;
				if (!quiet) await send(member.pane, nudge(t, role, fresh.length));
				woken.push({ team: t.name, role, fresh: fresh.length, why: "queue" });
			}
		}

		// PER MEMBER, not per team: the room addresses people, and the one free member
		// the queue half picks is the wrong recipient for a question aimed at the qa.
		const channel = channelOf(t);
		for (const [role, member] of Object.entries(t.members)) {
			const key = `${t.name}/${role}`;
			const { fresh, upto } = wake(pending(channel, member.agent), getCursor(channel, member.agent), seen.room.get(key));
			seen.room.set(key, upto);
			if (!fresh) continue;
			if (!quiet) await send(member.pane, ping(channel, member.agent, fresh));
			woken.push({ team: t.name, role, fresh, why: "room" });
		}
	}
	return woken;
}

/** `Teams.watch()` (@packages/interfaces/teams.ts): the loop, and the handle that stops
 *  it. Returned rather than kept, because otherwise the only off switch is killing
 *  the process that also keeps the teams. */
export async function watch(everyS = DEFAULT_EVERY_S): Promise<TeamsSystem.Entities.Watch> {
	const seen = nothingSeenYet();
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
		.description("Wake a team when its queue or its room gains something. Never assigns.")
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

	const seen = nothingSeenYet();
	// The baseline pass, always silent — `--once` from a hook still has to learn
	// what was already there before it can call anything new.
	await pass(seen, true);
	if (opts.once) {
		const woken = await pass(seen, opts.dry);
		for (const w of woken) console.log(`${w.team}/${w.role} ← ${w.fresh} new on the ${w.why}`);
		return 0;
	}

	console.log(`watching ${seen.queue.size} team(s) every ${everyS}s — Ctrl-C to stop`);
	for (;;) {
		await Bun.sleep(everyS * 1000);
		for (const w of await pass(seen, opts.dry))
			console.log(`${new Date().toISOString()} ${w.team}/${w.role} ← ${w.fresh} new on the ${w.why}`);
	}
}

if (import.meta.main) main(process.argv.slice(2)).then((code) => process.exit(code));
