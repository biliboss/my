//! The three pieces of `teams` that are logic rather than a call to herdr: the
//! `--watch` grammar, the refusals `up` makes before spending a workspace, and the
//! duplicate-subscription check.
//!
//! NOTHING HERE STARTS AN AGENT. Everything past the refusals is one herdr round
//! trip after another, and a test that pays for four panes to assert a shape is a
//! test nobody runs twice.
//!
//! The lineup store is the REAL one (`~/.me/teams`) under a name nothing else
//! uses, written and swept in the same test. It is machine state, not repo state —
//! same reason `~/.me/me.db` lives out there.

import { afterEach, expect, test } from "bun:test";

import { check } from "./check.ts";
import { forget, mint, stored, write } from "./model.ts";
import { target, up } from "./up.ts";

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
