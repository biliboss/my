//! The pieces of `teams` that are logic rather than a call to herdr: the `--watch`
//! grammar, the refusals `up` makes before spending a workspace, the
//! duplicate-subscription check, and the room — which channel a team talks in, who
//! is behind on it, and when a message wakes anybody.
//!
//! NOTHING HERE STARTS AN AGENT. Everything past the refusals is one herdr round
//! trip after another, and a test that pays for four panes to assert a shape is a
//! test nobody runs twice.
//!
//! The lineup store is the REAL one (`~/.me/teams`) under a name nothing else
//! uses, written and swept in the same test. It is machine state, not repo state —
//! same reason `~/.me/me.db` lives out there.
//!
//! AND `MY_HOME` IS NOT TOUCHED HERE, deliberately: `src/tasks/model.ts` freezes
//! `RAIZ` off it at IMPORT time, `bun test` runs a package's files in one process,
//! and repointing the house for the room tests would repoint it for every teams
//! file loaded after this one. The room rules are proved through the pure halves
//! `check.ts` and `watch.ts` expose for exactly that reason.

import { afterEach, expect, test } from "bun:test";

import { check, countIn, unreadRooms } from "./check.ts";
import { type Stored, channelOf, forget, mint, stored, write } from "./model.ts";
import { target, up } from "./up.ts";
import { wake } from "./watch.ts";

const A = "zz-test-team-a";
const B = "zz-test-team-b";
const lineup = (name: string, project: string) => ({
	name,
	listens: { monitors: { watches: "project_tasks" as const, project }, kinds: [] },
	roles: ["coding"],
	assembled_at: "2026-08-20T00:00:00Z",
	paused: false,
});

afterEach(() => {
	forget(A);
	forget(B);
});

test("target() parses the four arms and refuses a sprint with no sprint", () => {
	expect(target("inbox:my-v1")).toEqual({ watches: "inbox", feed: "my-v1" });
	expect(target("project_tasks:my-v1")).toEqual({ watches: "project_tasks", project: "my-v1" });
	expect(target("all_sprint_tasks:my-v1")).toEqual({ watches: "all_sprint_tasks", project: "my-v1" });
	expect(target("sprint_tasks:my-v1/999_x")).toEqual({ watches: "sprint_tasks", project: "my-v1", sprint: "999_x" });
	expect(target("sprint_tasks:my-v1")).toHaveProperty("erro");
	expect(target("nonsense:my-v1")).toHaveProperty("erro");
	expect(target("inbox")).toHaveProperty("erro");
});

test("the minted name comes off the first role, which is also the first cell", () => {
	expect(mint({ listens: lineup(A, "p").listens, roles: ["coding", "qa"] })).toBe("plantao-coding");
	expect(mint({ name: "plantao-rota", listens: lineup(A, "p").listens, roles: ["qa"] })).toBe("plantao-rota");
});

test("up() refuses before it spends a workspace", async () => {
	const sub = lineup(A, "my-v1").listens;

	// A duplicate role would be collapsed by `Team.members` AFTER two agents had
	// been paid for — the runtime invariant the contract names.
	const dupe = await up({ name: A, listens: sub, roles: ["coding", "coding"] });
	expect(dupe).toMatchObject({ ok: false, reason: "ambiguous" });

	const empty = await up({ name: A, listens: sub, roles: [] });
	expect(empty).toMatchObject({ ok: false, reason: "unsupported" });

	const tabs = await up({ name: A, listens: sub, roles: ["coding"], layout: "tabs" });
	expect(tabs).toMatchObject({ ok: false, reason: "unsupported" });

	// None of the three reached herdr, so none of them wrote a lineup.
	expect(stored().some((s) => s.name === A)).toBe(false);

	write(lineup(A, "my-v1"));
	const taken = await up({ name: A, listens: sub, roles: ["coding"] });
	expect(taken).toMatchObject({ ok: false, reason: "ambiguous" });
});

test("check() catches two teams watching one queue, and only when they really match", () => {
	write(lineup(A, "my-v1"));
	write(lineup(B, "my-v1"));
	expect(check().filter((f) => f.says.includes(A)).length).toBe(1);

	// Same monitor, different kinds: two teams that split a queue by kind are NOT
	// the same watch, and reporting them would make the check noise.
	write({ ...lineup(B, "my-v1"), listens: { ...lineup(B, "my-v1").listens, kinds: ["bug"] } });
	expect(check().filter((f) => f.says.includes(A)).length).toBe(0);

	// And kinds in a different ORDER are the same watch.
	write({ ...lineup(A, "my-v1"), listens: { ...lineup(A, "my-v1").listens, kinds: ["bug"] } });
	write({ ...lineup(B, "my-v1"), listens: { ...lineup(B, "my-v1").listens, kinds: ["bug"] } });
	expect(check().filter((f) => f.says.includes(A)).length).toBe(1);
});

test("the room defaults to the team NAME, and `--channel` puts two teams in one project room", () => {
	const solo = lineup(A, "my-v1");
	expect(channelOf(solo)).toBe(A);

	// The shape the fleet actually ran on: one channel per PROJECT, several teams
	// reading it. Without the override each team would mint a room of its own and
	// the handoff would have nowhere to land.
	const shared = { ...solo, listens: { ...solo.listens, channel: "soulperuibe" } };
	expect(channelOf(shared)).toBe("soulperuibe");
	expect(channelOf({ ...lineup(B, "my-v1"), listens: { ...lineup(B, "my-v1").listens, channel: "soulperuibe" } })).toBe("soulperuibe");
});

test("check(): a member that never opened its room is a finding, one per member, and an empty room is not", () => {
	const team: Stored = { ...lineup(A, "my-v1"), roles: ["coding", "qa"] };
	const holds = (channel: string) => (channel === A ? 7 : 0);
	const neverRead = () => 0;

	const both = unreadRooms([team], holds, neverRead);
	expect(both).toHaveLength(2);
	expect(both.map((f) => f.path)).toEqual([`.my_chat.tsv#${A}`, `.my_chat.tsv#${A}`]);
	expect(both[0]!.says).toContain(`${A}-coding`);
	expect(both[0]!.says).toContain("holds 7 message(s)");
	expect(both[1]!.says).toContain(`${A}-qa`);

	// One of the two read it: only the other is behind.
	const one = unreadRooms([team], holds, (_c, who) => (who === `${A}-coding` ? 3 : 0));
	expect(one.map((f) => f.says.split(" ")[0])).toEqual([`${A}-qa`]);

	// An empty room is not a silent one — there is nothing to be behind on.
	expect(unreadRooms([team], () => 0, neverRead)).toEqual([]);

	// And the finding follows the OVERRIDE, not the team name.
	const shared: Stored = { ...team, listens: { ...team.listens, channel: "soulperuibe" } };
	expect(unreadRooms([shared], (c) => (c === "soulperuibe" ? 2 : 0), neverRead).map((f) => f.path)).toEqual([
		".my_chat.tsv#soulperuibe",
		".my_chat.tsv#soulperuibe",
	]);
});

test("check(): the room's message count FILTERS the channel — it is never the largest global `seq`", () => {
	// `seq` is a global address across the whole TSV and does not restart per
	// channel, so `pm`'s largest seq is 4 while `pm` holds 2 messages. A
	// single-channel fixture can never tell the two apart.
	const msgs = [
		{ channel: "pm", seq: 1 },
		{ channel: "other", seq: 2 },
		{ channel: "other", seq: 3 },
		{ channel: "pm", seq: 4 },
		{ channel: "other", seq: 5 },
	];
	expect(countIn(msgs, "pm")).toBe(2);
	expect(countIn(msgs, "other")).toBe(3);
	expect(countIn(msgs, "nobody")).toBe(0);
});

test("watch(): the first sight of a room wakes nobody, and the baseline moves even when nothing is read", () => {
	const waiting = [{ seq: 4 }, { seq: 7 }];

	// First sight: two lines already waiting, and it says nothing about either.
	const first = wake(waiting, 0);
	expect(first).toEqual({ fresh: 0, upto: 7 });

	// A second pass with nothing new stays silent — this is the pass that would
	// otherwise re-nudge the same line every 60 seconds, since `watch` never moves
	// a cursor and this member has not read.
	expect(wake(waiting, 0, first.upto)).toEqual({ fresh: 0, upto: 7 });

	// One new line, and only that one is counted.
	expect(wake([...waiting, { seq: 9 }], 0, first.upto)).toEqual({ fresh: 1, upto: 9 });

	// The member read everything: nothing waiting, and the cursor holds the
	// baseline so the next pass does not re-announce what it just read.
	expect(wake([], 9, first.upto)).toEqual({ fresh: 0, upto: 9 });
});
