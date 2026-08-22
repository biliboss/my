#!/usr/bin/env bun
//! Assemble a team: one workspace, one pane per role, one agent in each.
//!
//!     my teams up coding qa --watch project_tasks:my-v1
//!     my teams up coding qa --watch sprint_tasks:my-v1/999_rota --name plantao-rota
//!     my teams up triage --watch inbox:my-v1 --kind bug --kind p1
//!     my teams up design qa --watch project_tasks:soulperuibe --channel soulperuibe
//!
//! THE TEAM IS SENIOR, SO IT PULLS. Nothing here hands anybody work: each member
//! is started with a prompt that says which queue is its own and how to take from
//! it. `my teams watch` only wakes them.
//!
//! AND IT IS ASSEMBLED IN A ROOM. The team's channel (`--channel`, the team name
//! when omitted) is registered before the first member and JOINED by each member
//! that actually comes up, so `Channel.members` is the roster of who is expected
//! to read it. That membership is the subscription — `_today` kept the same
//! mapping in a `crew:` block of its own YAML, with a regex to parse it back.
//!
//! DUPLICATE ROLES ARE REFUSED, and this is the runtime boundary the contract
//! names: `Lineup.roles` is an array, `Team.members` is a map, so two `coding`
//! entries would be silently collapsed AFTER two agents had already been paid for.
//!
//! ORDER IS DRAWING ORDER — the first role takes the first cell of the grid, which
//! is what makes "the qa is bottom-right" a thing a human can rely on.
//!
//! `layout: tabs` IS NOT BUILT. herdr can do it (`tabs create` per role) and this
//! refuses instead of pretending: nothing has needed more than four members, and a
//! second layout with no caller is a branch nobody has ever run.
//!
//! depends_on: src/teams/model.ts · src/teams/list.ts · src/chat/store.ts ·
//!             src/herdr/workspaces/create.ts · src/herdr/panes/grid.ts · src/agents/start.ts
//! impacts:    src/teams/down.ts

import { Command } from "commander";

import type { AgentSystem } from "@my/interfaces/agents.ts";
import type { Fail, TeamsSystem } from "@my/interfaces/teams.ts";
import { agents } from "@my/agents";

import { registerChannel } from "@my/chat";
import { grid } from "@my/herdr/panes/grid";
import { create } from "@my/herdr/workspaces/create";
import { RAIZ } from "../shared/work/model.ts";
import { type Lineup, type Team, agora, channelOf, memberName, mint, storedOf, write } from "./model.ts";
import { find } from "./list.ts";

/** WHAT A MEMBER IS TOLD ON ITS FIRST BREATH. It names the queue and the two verbs
 *  that take from it, and the room and the three verbs that read and answer it —
 *  an agent that has to be told what to do next by a human is a pane, not a team
 *  member, and one that cannot be reached without a human relaying is a pane too. */
const brief = (team: string, role: string, sub: TeamsSystem.ValueObjects.Subscription, channel: string) => {
	const me = memberName(team, role);
	return [
		`You are the \`${role}\` of team \`${team}\`, and your agent name is \`${me}\`.`,
		`It watches ${JSON.stringify(sub.monitors)}${sub.kinds.length ? `, kinds ${sub.kinds.join(", ")}` : ""}.`,
		"Nothing will be assigned to you: you PULL.",
		`See your queue with \`my teams list ${team} --queue\`, take one with`,
		`\`my teams claim ${team} ${role} <work-path>\`, and let go with \`--release\`.`,
		`Your team talks in the channel \`${channel}\`, and you are a member of it.`,
		`Read it with \`my chat ${channel}\`, take what is addressed to you with`,
		`\`my chat read ${channel} --mine ${me}\`, answer with \`my chat say ${channel} <to> "…"\`,`,
		`wait on it with \`my chat listen ${channel} ${me}\`, and mark how far you got with \`--seen <seq>\`.`,
		"Read the work's CONTEXT.md before anything else.",
	].join(" ");
};

export async function up(lineup: Lineup): Promise<Team | Fail> {
	const name = mint(lineup);

	if (!lineup.roles.length)
		return { ok: false, reason: "unsupported", error: "a team with no roles is a workspace — `my herdr workspaces create` does that" };

	const dupes = lineup.roles.filter((r, i) => lineup.roles.indexOf(r) !== i);
	if (dupes.length)
		return { ok: false, reason: "ambiguous", error: `role repeated in the lineup: ${[...new Set(dupes)].join(", ")} — one member per role, or the map loses the second` };

	if (lineup.layout === "tabs")
		return { ok: false, reason: "unsupported", error: "only `grid` is built — nothing has needed tabs, and an untested branch is worse than a refusal" };

	if (storedOf(name))
		return { ok: false, reason: "ambiguous", error: `\`${name}\` is already assembled — \`my teams down ${name}\` first` };

	// herdr refuses a repeated label on its own, which is the same natural-key rule
	// one layer down: two workspaces sharing a name makes every later call a guess.
	const ws = await create(name, { cwd: RAIZ, focus: true });
	if (!ws.ok) return ws;

	const panes = await grid(ws.pane, lineup.roles.length, RAIZ);
	if (!panes.ok) return panes;

	// THE ROOM EXISTS BECAUSE THE TEAM DOES, and it is registered before anybody is
	// briefed to talk in it. Find-or-create by name, so a `--channel` naming a
	// project room several teams share joins that one instead of minting a second.
	const channel = channelOf({ name, listens: lineup.listens });
	registerChannel(channel);

	for (const [i, role] of lineup.roles.entries()) {
		const launch: AgentSystem.ValueObjects.Launch = { ...lineup.launch, ...lineup.per_role?.[role] };
		const member = await agents.control.start(memberName(name, role), { pane: panes.panes[i]!, prompt: brief(name, role, lineup.listens, channel) }, launch);
		if ("ok" in member && member.ok === false)
			// The workspace STAYS UP on a failed member, deliberately: the pane holds
			// whatever the CLI printed before it died, and that is the only evidence of
			// why. `my teams down` is one command away.
			return { ...member, error: `${role} did not come up: ${member.error} — the workspace is still there, read the pane` };
		// IT JOINS AFTER IT BREATHES, one name at a time: `registerChannel` unions, so
		// this adds itself and evicts nobody. A member that never came up never joins,
		// and `my teams check` is then not reporting a reader that was never born.
		registerChannel(channel, [memberName(name, role)]);
	}

	write({ ...lineup, name, assembled_at: agora(), paused: false });

	const team = await find(name);
	return team ?? { ok: false, reason: "herdr", error: `${name} was assembled but did not appear in the workspace list right after` };
}

/** `project_tasks:my-v1` · `sprint_tasks:my-v1/999_rota` · `inbox:my-v1`. One
 *  string because the four targets differ in one field, and a flag per field
 *  would let `--sprint` arrive without `--project`. */
export function target(spec: string): TeamsSystem.ValueObjects.MonitorTarget.Any | { erro: string } {
	const [watches, rest] = spec.split(":");
	const [project, sprint] = (rest ?? "").split("/");
	if (!project) return { erro: `--watch wants <kind>:<project>[/<sprint>], got \`${spec}\`` };
	if (watches === "inbox") return { watches: "inbox", feed: project };
	if (watches === "project_tasks") return { watches: "project_tasks", project };
	if (watches === "all_sprint_tasks") return { watches: "all_sprint_tasks", project };
	if (watches === "sprint_tasks") {
		if (!sprint) return { erro: "sprint_tasks wants the sprint too: `sprint_tasks:<project>/<sprint>`" };
		return { watches: "sprint_tasks", project, sprint };
	}
	return { erro: `unknown target \`${watches}\` — inbox · project_tasks · all_sprint_tasks · sprint_tasks` };
}

export function command(): Command {
	return new Command("up")
		.description("Assemble a team: a workspace, a pane per role, an agent in each.")
		.argument("<roles...>", "the roles, in drawing order — `coding qa`")
		.requiredOption("-w, --watch <kind:project[/sprint]>", "what the team is answerable for")
		.option("-n, --name <team>", "the team name; minted from the first role when omitted")
		.option("-c, --channel <channel>", "the room the team talks in; the team name when omitted")
		.option("-k, --kind <kind>", "only this kind of work; repeat. Omitted means everything there", (v: string, acc: string[]) => [...acc, v], [] as string[])
		.option("-m, --model <model>", "the model every member starts on")
		.option("-e, --effort <effort>", "low · medium · high · xhigh · max")
		.option("--json", "the team, for jq");
}

export async function main(argv: string[]): Promise<number> {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (err) {
		return (err as { exitCode?: number }).exitCode ?? 1;
	}
	const opts = cmd.opts();
	const monitors = target(opts.watch);
	if ("erro" in monitors) return console.error(monitors.erro), 1;

	const launch: AgentSystem.ValueObjects.Launch = {};
	if (opts.model) launch.engine = { cli: "claude-code", model: opts.model };
	if (opts.effort) launch.effort = opts.effort;

	const out = await up({
		name: opts.name,
		listens: { monitors, kinds: opts.kind, channel: opts.channel },
		roles: cmd.args,
		launch: Object.keys(launch).length ? launch : undefined,
	});

	if ("ok" in out && out.ok === false) return console.error(`✗ ${out.error}`), 1;
	const team = out as Team;
	if (opts.json) console.log(JSON.stringify(team, null, 2));
	else console.log(`${team.name} up · ${Object.keys(team.members).join(" ")} · position ${team.position}`);
	return 0;
}

if (import.meta.main) main(process.argv.slice(2)).then((code) => process.exit(code));
