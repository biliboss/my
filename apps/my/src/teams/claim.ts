#!/usr/bin/env bun
//! A member takes work off its queue — and lets go of it.
//!
//!     my teams claim plantao-coding coding 01_projects/my-v1/sprints/999_x/tasks/001_y
//!     my teams claim plantao-coding coding --next          take the head of the queue
//!     my teams claim plantao-coding coding --release       let go of what it holds
//!     my teams claim plantao-coding coding --release --force
//!
//! THE SAME LOCK `my teams claim` USES — `<work>/.doing/`, created with `mkdirSync`
//! WITHOUT `recursive`, which fails EEXIST and is atomic on the filesystem. One
//! sentinel for the whole house: a second one beside it would be a second answer to
//! "who has this", and the second answer is always the stale one.
//!
//! WHAT THIS ADDS OVER `my teams claim` is `team` and `role` in the badge, and NOT
//! moving the folder. `tasks` pulls the folder into `in_progress/` because a task
//! has a place; a team claims a WorkPath, which may be an inbox item that has no
//! `in_progress/` to be pulled into. The badge is the whole record.
//!
//! `release` TAKES THE CLAIM, NOT THE WORK, and that is the ABA race written into a
//! signature: a `release(work)` arriving late — the member died, somebody recovered
//! the item, a new member took it — would erase a holder that never asked to be
//! released. Matching `claim.at` against the badge makes the late call a no-op.
//!
//! THE CEILING OF THAT GUARD: `at` is second-granular (`agora()`), so it separates
//! two acquisitions of the same path only if they are more than a second apart.
//! Nothing narrower is reachable today — the lock is held between them — and a real
//! counter would need a record of our own, which this design refuses.
//!
//! depends_on: src/teams/model.ts · src/teams/list.ts · src/shared/work/claim.ts · src/shared/work/model.ts
//! impacts:    src/teams/watch.ts · src/teams/check.ts

import { Command } from "commander";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Fail, TeamsSystem } from "@my/interfaces/teams.ts";
import { CRACHA, TRAVA, crachaDe, ehMinha, identidade } from "../shared/work/claim.ts";
import { RAIZ } from "../shared/work/model.ts";
import { type Claim, type Member, type TeamName, type WorkPath, memberName, queueOf, storedOf } from "./model.ts";
import { find } from "./list.ts";

const abs = (work: WorkPath) => join(RAIZ, work);

/** TAKE IT. Lock first, badge second — the lock is what decides the race, and a
 *  badge written before it would be the loser's badge on the winner's work. */
export async function claim(work: WorkPath, team: TeamName, role: string): Promise<Member | Fail> {
	const dir = abs(work);
	if (!existsSync(dir)) return { ok: false, reason: "not_found", error: `no such work: ${work}` };

	const t = await find(team);
	if (!t) return { ok: false, reason: "not_found", error: `\`${team}\` is not up — \`my teams list\`` };
	if (!t.members[role]) return { ok: false, reason: "not_found", error: `\`${team}\` has no \`${role}\` — it has ${Object.keys(t.members).join(", ") || "nobody"}` };
	if (t.paused) return { ok: false, reason: "blocked", error: `\`${team}\` is paused — it finishes what it holds and takes nothing new` };

	const me = identidade({ team, role, agent: memberName(team, role) });
	try {
		mkdirSync(join(dir, TRAVA));
	} catch {
		const holder = crachaDe(dir);
		// Already mine is CONTINUATION, not collision: a member that restarted and
		// reached for its own work should keep it, not be told a stranger has it.
		if (!ehMinha(holder, me))
			return {
				ok: false,
				reason: "blocked",
				error: `${work} is held by ${holder?.agent ?? holder?.claude_session ?? "somebody"} since ${holder?.at ?? "?"}`,
			};
	}
	writeFileSync(join(dir, TRAVA, CRACHA), `${JSON.stringify(me, null, 2)}\n`);

	return { ...t.members[role]!, claim: { work, at: me.at } };
}

/** LET GO — and refuse a stale generation. `force` is for the one case the guard
 *  cannot cover: the holder is dead and cannot release its own. */
export function release(c: Claim, force = false): { ok: true; work: WorkPath } | Fail {
	const dir = abs(c.work);
	const lock = join(dir, TRAVA);
	if (!existsSync(lock)) return { ok: true, work: c.work };

	const holder = crachaDe(dir);
	if (holder && holder.at !== c.at && !force)
		return {
			ok: false,
			reason: "blocked",
			error: `${c.work} is on generation ${holder.at}, your claim is from ${c.at} — somebody else holds it now\n  if you KNOW they are dead: --force`,
		};

	rmSync(lock, { recursive: true, force: true });
	return { ok: true, work: c.work };
}

/** WHO HOLDS IT. A team and not a member, per contract — the member is inside it,
 *  carrying the claim. */
export async function owner(work: WorkPath): Promise<TeamsSystem.Entities.Team | undefined> {
	const c = crachaDe(abs(work));
	if (!c?.team) return undefined;
	return await find(c.team);
}

export function command(): Command {
	return new Command("claim")
		.description("The member takes work off its queue, or lets go of it.")
		.argument("<team>", "the team")
		.argument("<role>", "which member")
		.argument("[work]", "the work path; omit with --next or --release")
		.option("--next", "take the head of the team's queue")
		.option("--release", "let go of what this member holds")
		.option("--force", "with --release: even if the badge is somebody else's")
		.option("--json", "the member, for jq");
}

export async function main(argv: string[]): Promise<number> {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (err) {
		return (err as { exitCode?: number }).exitCode ?? 1;
	}
	const [team, role, arg] = cmd.args as [string, string, string | undefined];
	const opts = cmd.opts();

	if (opts.release) {
		const t = await find(team!);
		const held = t?.members[role!]?.claim;
		if (!held) return console.log(`${team}/${role} holds nothing`), 0;
		const out = release(held, opts.force);
		if (!out.ok) return console.error(`✗ ${out.error}`), 1;
		return console.log(`${role} let go of ${out.work}`), 0;
	}

	let work = arg;
	if (opts.next) {
		const s = storedOf(team!);
		if (!s) return console.error(`✗ no team called \`${team}\``), 1;
		work = queueOf(s.listens)[0];
		if (!work) return console.error(`the queue is dry — nothing for ${team} to take`), 1;
	}
	if (!work) return console.error("pass a work path, or --next"), 1;

	const out = await claim(work, team!, role!);
	if ("ok" in out && out.ok === false) return console.error(`✗ ${out.error}`), 1;
	const member = out as Member;
	if (opts.json) console.log(JSON.stringify(member, null, 2));
	else console.log(`${member.agent} holds ${member.claim!.work} since ${member.claim!.at}`);
	return 0;
}

if (import.meta.main) main(process.argv.slice(2)).then((code) => process.exit(code));
