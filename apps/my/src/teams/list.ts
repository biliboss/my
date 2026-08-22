#!/usr/bin/env bun
//! The teams that are up, and what each is holding, watching and waiting on.
//!
//!     my teams list                          every team, one line each
//!     my teams list plantao-coding           one team, its members, its queue
//!     my teams list --queue                  only the queues
//!     my teams list --pressure               waiting vs listening vs idle, per kind
//!     my teams list --json | --jsonl | --tsv
//!
//! `View` (@packages/interfaces/teams.ts) lives here: `all`, `find`, `idle`, `subs`,
//! `queue`, `next`, `wip`, `pressure`, `unserved`. They are ALL the same two reads
//! — the lineups on disk and herdr's live list — sliced differently, and splitting
//! them into nine files would be nine copies of one join.
//!
//! THE JOIN LIVES HERE AND NOT IN `model.ts`, and it is the reason `check()` is a
//! third file: this module imports herdr, herdr is async all the way down, and Bun
//! turns any module whose graph holds a top-level `await` into a Promise —
//! `require()`ing it for a `check()` then finds nothing, silently. Measured 20/08
//! against this very file; `src/agents/list.ts` carries the same note in its footer.
//!
//! depends_on: src/teams/model.ts · src/agents/list.ts · src/herdr/workspaces/list.ts · src/shared/gh.ts
//! impacts:    src/teams/watch.ts · src/teams/up.ts · src/teams/down.ts · src/teams/claim.ts

import { Command } from "commander";

import type { TeamsSystem } from "@my/interfaces/teams.ts";
import { agents } from "@my/agents";

const fleet = () => agents.list.all();
import { list as liveWorkspaces } from "@my/herdr/workspaces/list";
import { fmtOf, out } from "@my/shared/gh";
import { type Member, type Team, type TeamName, heldBy, isIdle, memberName, queueOf, stored, storedOf } from "./model.ts";

/** A LINEUP PLUS A LIVE WORKSPACE IS A TEAM; a lineup alone is a leftover, and
 *  `main()` below prints those separately so they can be swept.
 *
 *  Two herdr calls for the whole list, never two per team: the reads are outside
 *  the loop, so twelve teams cost the same round trips as one. */
export async function all(): Promise<Team[]> {
	const [live, agents] = await Promise.all([liveWorkspaces(), fleet()]);
	if (!live.ok) return [];
	const byLabel = new Map(live.workspaces.map((w) => [w.label, w]));

	return stored().flatMap((s) => {
		const ws = byLabel.get(s.name);
		if (!ws) return [];
		const held = heldBy(s.listens);

		const members: Record<string, Member> = {};
		for (const role of new Set(s.roles)) {
			const name = memberName(s.name, role);
			// The pane prefix is what proves the agent is in THIS team's workspace: a
			// name is ours to mint and a stale roster entry can outlive the pane.
			const a = agents.list.find((x) => x.name === name && x.pane.startsWith(`${ws.id}:`));
			if (!a) continue;
			members[role] = {
				agent: a.name,
				session: a.runtime.session ?? "",
				runtime: a.runtime,
				launch: a.launch,
				pane: a.pane,
				claim: held.get(name),
			};
		}

		return [
			{
				name: s.name,
				listens: s.listens,
				members,
				position: ws.number,
				layout: s.layout ?? "grid",
				assembled_at: s.assembled_at,
				paused: s.paused,
			},
		];
	});
}

export const find = async (name: TeamName): Promise<Team | undefined> =>
	(await all()).find((t) => t.name === name);

export const idle = async (): Promise<Team[]> => (await all()).filter(isIdle);

export const subs = (team: TeamName): TeamsSystem.ValueObjects.Subscription | undefined =>
	storedOf(team)?.listens;

export const queue = (team: TeamName): TeamsSystem.ValueObjects.WorkPath[] => {
	const s = storedOf(team);
	return s ? queueOf(s.listens) : [];
};

/** ARRIVAL ORDER today, and a method rather than `queue()[0]` because tomorrow it
 *  is the addressed one first — same signature, one body changed. */
export const next = (team: TeamName): TeamsSystem.ValueObjects.WorkPath | undefined => queue(team)[0];

export async function wip(): Promise<Record<TeamName, number>> {
	const w: Record<TeamName, number> = {};
	for (const t of await all()) w[t.name] = Object.values(t.members).filter((m) => m.claim).length;
	return w;
}

/** THE FOUR COUNTS ARE MEANINGLESS APART, which is why they come back together:
 *  five waiting is fine with three idle teams and an emergency with none. */
export async function pressure(): Promise<TeamsSystem.ValueObjects.Pressure[]> {
	const teams = await all();
	const rows = new Map<string, TeamsSystem.ValueObjects.Pressure>();
	for (const t of teams) {
		const waiting = queueOf(t.listens).length;
		// A team with no declared kinds is answerable for everything in its target,
		// and `""` is how that reads on screen: one row, not a row per kind it never
		// named.
		for (const kind of t.listens.kinds.length ? t.listens.kinds : [""]) {
			const row = rows.get(kind) ?? { kind, waiting: 0, listening: 0, idle: 0 };
			row.waiting += waiting;
			row.listening += 1;
			row.idle += isIdle(t) ? 1 : 0;
			rows.set(kind, row);
		}
	}
	return [...rows.values()];
}

/** Kinds sitting in a watched queue that NO team declared — the silent failure of
 *  a pull system, and from the outside identical to an idle machine. */
export async function unserved(): Promise<TeamsSystem.ValueObjects.Inbox.WorkKind[]> {
	const heard = new Set((await all()).flatMap((t) => t.listens.kinds));
	const seen = new Set(stored().flatMap((s) => s.listens.kinds));
	return [...seen].filter((k) => !heard.has(k));
}

export function command(): Command {
	return new Command("list")
		.description("The teams that are up — members, claims, queues.")
		.argument("[team]", "one team instead of all of them")
		.option("--queue", "only the queues")
		.option("--pressure", "waiting vs listening vs idle, per kind")
		.option("--json", "everything, for jq")
		.option("--jsonl", "one team per line")
		.option("--tsv", "one team per line, for awk");
}

export async function main(argv: string[]): Promise<number> {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (err) {
		return (err as { exitCode?: number }).exitCode ?? 1;
	}
	const name = cmd.args[0];
	const opts = cmd.opts();
	const fmt = fmtOf(argv);

	if (opts.pressure) {
		const rows = await pressure();
		out(fmt, rows, (r) => [r.kind, r.waiting, r.listening, r.idle], (r) => `${(r.kind || "*").padEnd(14)} ${r.waiting} waiting · ${r.listening} listening · ${r.idle} idle`);
		return 0;
	}

	const teams = name ? [await find(name)].filter((t): t is Team => Boolean(t)) : await all();
	if (name && !teams.length) return console.error(`✗ \`${name}\` is not up — the lineups on disk: ${stored().map((s) => s.name).join(", ") || "none"}`), 1;

	if (opts.queue) {
		const rows = teams.flatMap((t) => queue(t.name).map((work) => ({ team: t.name, work })));
		out(fmt, rows, (r) => [r.team, r.work], (r) => `${r.team.padEnd(20)} ${r.work}`);
		return 0;
	}

	const rows = teams.map((t) => ({
		team: t.name,
		position: t.position,
		roles: Object.keys(t.members),
		holding: Object.entries(t.members).filter(([, m]) => m.claim).map(([r, m]) => `${r}:${m.claim!.work}`),
		waiting: queue(t.name).length,
		paused: t.paused,
	}));

	if (fmt !== "human") {
		out(fmt, rows, (r) => [r.team, r.position, r.roles.join(","), r.holding.join(","), r.waiting], (r) => JSON.stringify(r));
		return 0;
	}

	for (const r of rows) {
		console.log(`${String(r.position).padStart(2)} ${r.team.padEnd(20)} ${r.roles.join(" ").padEnd(18)} ${r.waiting} waiting${r.paused ? " · paused" : ""}`);
		for (const h of r.holding) console.log(`     └─ ${h}`);
	}
	const orphans = stored().filter((s) => !rows.some((r) => r.team === s.name));
	if (orphans.length) console.log(`${orphans.length} lineup(s) with no workspace: ${orphans.map((o) => o.name).join(", ")} — \`my teams down <name>\``);
	if (!rows.length && !orphans.length) console.log("no teams up — `my teams up <role...> --watch <target>`");
	return 0;
}

if (import.meta.main) main(process.argv.slice(2)).then((code) => process.exit(code));
