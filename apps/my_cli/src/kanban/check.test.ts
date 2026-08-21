//! `my kanban check` — and the one property that has to hold forever: **the bare check
//! spends no GraphQL point.**
//!
//! `check()` in `model.ts` is the function `src/shared/house.ts` finds BY FORM and runs
//! on every `my check all`. The day a network call gets into it, the house's own sweep
//! becomes a poller against a budget shared with every agent — which is precisely how
//! the 5000 points/hour hit zero on 21/08. The test below is what fails if somebody
//! moves the remote findings out of `--remote` and into the default.

import { expect, test } from "bun:test";
import { main } from "./check.ts";
import { check } from "./model.ts";

function capture(fn: () => number): { code: number; out: string } {
	const err = console.error;
	const log = console.log;
	let out = "";
	console.error = (...a: unknown[]) => {
		out += `${a.join(" ")}\n`;
	};
	console.log = (...a: unknown[]) => {
		out += `${a.join(" ")}\n`;
	};
	try {
		return { code: fn(), out };
	} finally {
		console.error = err;
		console.log = log;
	}
}

test("the bare check is disk only — no finding of it mentions a GitHub board", () => {
	// Every remote finding is addressed `gh:<owner>/<number>#<issue>`. One appearing
	// here would mean `check()` reached the network on a `my check all`.
	for (const f of check()) expect(f.path.startsWith("gh:")).toBe(false);
});

test("`--remote` on a board that declares no project is a finding, not a crash", () => {
	const r = capture(() => main(["--remote", "zz-board-that-does-not-exist"]));
	expect(r.code).toBe(1);
	expect(r.out).toContain("my kanban add gh:");
});

test("the four formats still come from `emit`, so `--json` stays parseable", () => {
	const r = capture(() => main(["--json"]));
	expect(() => JSON.parse(r.out)).not.toThrow();
	expect(JSON.parse(r.out)).toHaveProperty("findings");
});
