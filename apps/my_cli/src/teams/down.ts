#!/usr/bin/env bun
//! Disband a team: close its workspace, drop its lineup.
//!
//!     my teams down plantao-coding
//!     my teams down plantao-coding --force      even holding work
//!
//! A HELD CLAIM REFUSES, and `--force` is what says "I know". Closing a workspace
//! kills the agent mid-edit; the badge it leaves behind says `working` forever,
//! and the next team to look at that queue sees work nobody is doing. Releasing
//! first is one command, and this prints it.
//!
//! THE LINEUP IS DROPPED LAST. If herdr refuses (a blocked workspace, per
//! `policy.ts`), the team is still up and still describable — a lineup deleted
//! before the window closed would leave a workspace nothing can name.
//!
//! depends_on: src/teams/model.ts · src/teams/list.ts · src/herdr/workspaces/close.ts
//! impacts:    —

import { Command } from "commander";

import type { Fail } from "@biliboss/interfaces/teams.ts";
import { close } from "../herdr/workspaces/close.ts";
import { type TeamName, forget, storedOf } from "./model.ts";
import { find } from "./list.ts";

export async function down(name: TeamName, force = false): Promise<{ ok: true; name: TeamName } | Fail> {
	if (!storedOf(name)) return { ok: false, reason: "not_found", error: `no team called \`${name}\` — \`my teams list\`` };

	const team = await find(name);
	const holding = Object.entries(team?.members ?? {}).filter(([, m]) => m.claim);
	if (holding.length && !force)
		return {
			ok: false,
			reason: "blocked",
			error: `${holding.map(([r, m]) => `${r} holds ${m.claim!.work}`).join(", ")}\n  release first: ${holding.map(([r]) => `my teams claim ${name} ${r} --release`).join(" ; ")}\n  or \`--force\` if you know they are dead`,
		};

	// A team whose lineup outlived its workspace is a leftover, and `down` is what
	// sweeps it: no window to close, but the file still has to go.
	if (team) {
		const gone = await close(name);
		if (!gone.ok) return gone;
	}
	forget(name);
	return { ok: true, name };
}

export function command(): Command {
	return new Command("down")
		.description("Close the team's workspace and drop its lineup.")
		.argument("<team>", "the team name")
		.option("--force", "even with work held — the badge stays behind, and nobody is doing it");
}

export async function main(argv: string[]): Promise<number> {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (err) {
		return (err as { exitCode?: number }).exitCode ?? 1;
	}
	const out = await down(cmd.args[0]!, cmd.opts().force);
	if (!out.ok) return console.error(`✗ ${out.error}`), 1;
	console.log(`${out.name} down`);
	return 0;
}

if (import.meta.main) main(process.argv.slice(2)).then((code) => process.exit(code));
