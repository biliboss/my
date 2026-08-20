//! `teams` — the vocabulary on disk, and the join that says which teams are UP.
//!
//! A TEAM EXISTS BECAUSE A HERDR WORKSPACE EXISTS. What this file keeps under
//! `~/.me/teams/` is only the LINEUP — what the team listens for, which roles it
//! was assembled with, how it is drawn. Whether it is alive is asked of herdr on
//! every read. An index of existence would be wrong the first time somebody
//! closes a window by hand, and that is exactly the case the contract calls out
//! (@packages/interfaces/teams.ts, `View`).
//!
//! `<team>-<role>` IS THE MEMBER'S AGENT NAME — `plantao-coding-qa`. One string
//! finds the member in the roster, in herdr's pane list and in the lineup, which
//! is the same trick `TeamName` already plays as the workspace label. Nothing
//! parses it back apart: `claim` writes `team` and `role` into the badge, because
//! a team name may itself contain a dash.
//!
//! THE STORE IS OUTSIDE THE REPO, like `~/.me/me.db`: which teams are up on THIS
//! machine is not a decision worth versioning, and two machines sharing the file
//! would fight over a window neither can see.
//!
//! NOTHING HERE TOUCHES HERDR, and that is load-bearing rather than tidy: every
//! path into herdr is async, Bun turns a module with any top-level `await` in its
//! graph into a Promise, and `house.check()` finds a system's `check()` by
//! `require()`ing it SYNCHRONOUSLY. `src/teams/check.ts` imports this file, so a
//! single herdr import here would make `teams` vanish from the coverage table with
//! no error at all — measured 20/08, which is how this split came to exist. The
//! join with the live workspaces lives in `./list.ts`.
//!
//! depends_on: src/interfaces/teams.ts · src/tasks/model.ts · src/tasks/claim.ts
//! impacts:    src/teams/list.ts · src/teams/up.ts · src/teams/down.ts ·
//!             src/teams/claim.ts · src/teams/watch.ts · src/teams/check.ts

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

import { join } from "node:path";

import { store } from "../home/paths.ts";
import type { TeamsSystem } from "@biliboss/interfaces/teams.ts";
import { type Cracha, crachaDe } from "../tasks/claim.ts";
import { BACKLOG, TASKS, agora, ler, pastasDeTask, placeDe, rel, sprintDe } from "../tasks/model.ts";

export type Team = TeamsSystem.Entities.Team;
export type Member = TeamsSystem.Entities.Member;
export type Lineup = TeamsSystem.ValueObjects.Lineup;
export type Subscription = TeamsSystem.ValueObjects.Subscription;
export type WorkPath = TeamsSystem.ValueObjects.WorkPath;
export type TeamName = TeamsSystem.ValueObjects.TeamName;
export type Claim = TeamsSystem.ValueObjects.Claim;

/** What this system found rotten. Same two fields every other system writes —
 *  `house.check()` reads the SHAPE, so owning a check costs no import. */
export type Finding = { path: string; says: string };

export const STORE = store("teams");
const FILE = (name: string) => join(STORE, `${name}.json`);

/** The lineup as written, plus the two facts herdr has nowhere to keep: when the
 *  team went up, and whether it is taking new work. */
export type Stored = Lineup & { name: TeamName; assembled_at: string; paused: boolean };

export function stored(): Stored[] {
	if (!existsSync(STORE)) return [];
	return readdirSync(STORE)
		.filter((f) => f.endsWith(".json"))
		.flatMap((f) => {
			try {
				return [JSON.parse(readFileSync(join(STORE, f), "utf8")) as Stored];
			} catch {
				// An unreadable lineup is a team nobody can describe. Skipping it here
				// keeps every read working; `check()` is what reports it.
				return [];
			}
		});
}

export const storedOf = (name: TeamName): Stored | undefined => stored().find((s) => s.name === name);

export function write(s: Stored): void {
	mkdirSync(STORE, { recursive: true });
	writeFileSync(FILE(s.name), `${JSON.stringify(s, null, 2)}\n`);
}

export const forget = (name: TeamName): void => rmSync(FILE(name), { force: true });

export const memberName = (team: TeamName, role: string) => `${team}-${role}`;

/** The name minted when the lineup omits one — `plantao-coding`, off the first
 *  role, which is also the first cell it will be drawn in. */
export const mint = (l: Lineup): TeamName => l.name ?? `plantao-${l.roles[0] ?? "team"}`;

// ─── THE QUEUE ──────────────────────────────────────────────────────────────

/** THE FOUR TARGETS DIFFER IN INTENT AND IN ONE FIELD, never in where the work
 *  lives: all of it is a task folder under `01_projects/<slug>/`. */
export const slugOf = (m: TeamsSystem.ValueObjects.MonitorTarget.Any): string =>
	m.watches === "inbox" ? m.feed : m.project;

/** WHAT A TEAM COULD PULL RIGHT NOW: the work in its column, in its sprint if it
 *  scoped one, matching its kinds, and NOT already held.
 *
 *  `kinds` is matched against the item's `labels` — a kind is what a request
 *  NEEDS, and a label is the only field on a task that carries that today. Empty
 *  `kinds` means everything in the target, which is the contract's own default. */
export function queueOf(sub: Subscription): WorkPath[] {
	const m = sub.monitors;
	const column = m.watches === "inbox" ? BACKLOG : TASKS;
	const kinds = sub.kinds ?? [];
	return pastasDeTask(slugOf(m))
		.filter((dir) => placeDe(dir) === column)
		.filter((dir) => !existsSync(join(dir, ".doing")))
		.filter((dir) => {
			if (m.watches === "sprint_tasks") return sprintDe(ler(dir)) === m.sprint;
			if (m.watches === "all_sprint_tasks") return Boolean(sprintDe(ler(dir)));
			return true;
		})
		.filter((dir) => {
			if (!kinds.length) return true;
			const raw = ler(dir).pedido.labels;
			const labels = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
			return kinds.some((k) => labels.includes(k));
		})
		.map(rel);
}

/** Every badge under a team's target, held or not — the read behind `owner`,
 *  `stuck` and the `claim` field of a member. Bounded by the project on purpose:
 *  scanning `01_projects/` whole would make a team's view depend on how busy its
 *  neighbours are. */
export function badges(sub: Subscription): { work: WorkPath; cracha: Cracha }[] {
	return pastasDeTask(slugOf(sub.monitors))
		.map((dir) => ({ work: rel(dir), cracha: crachaDe(dir) }))
		.filter((b): b is { work: WorkPath; cracha: Cracha } => Boolean(b.cracha));
}

/** Who holds what, keyed by the AGENT NAME on the badge — the half of the join
 *  that needs no herdr. `./list.ts` hangs it on the live members. */
export const heldBy = (sub: Subscription): Map<string, Claim> =>
	new Map(
		badges(sub)
			.filter((b) => b.cracha.agent)
			.map((b) => [b.cracha.agent!, { work: b.work, at: b.cracha.at }]),
	);

/** A team is IDLE when nobody in it holds anything. Not "the workspace says
 *  idle": herdr's status is about the pane's last output, and a member waiting on
 *  a human still holds the work. */
export const isIdle = (t: Team) => Object.values(t.members).every((m) => !m.claim);

export { agora };
