//! `my kanban add` — the three shapes of its first argument, and the refusals that
//! cost nothing.
//!
//! The two live proofs are in the task's record and are not repeatable for free:
//! adding `biliboss/soulperuibe#7` to project 24 (it landed in `Inbox`, verified by a
//! raw `gh api graphql` call, then removed again), and the refusal of
//! `biliboss/fonseca-mono#94` — a REAL sub-issue of #93 — which never reached the
//! write.

import { expect, test } from "bun:test";
import { main } from "./add.ts";

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

test("the usage names all three shapes, because one verb now takes three things", () => {
	const r = capture(() => main(["only-one-argument"]));
	expect(r.code).toBe(1);
	expect(r.out).toContain("gh:<n>");
	expect(r.out).toContain("owner/repo#57");
});

test("an issue address routes remote and stops on a board that declares no project", () => {
	const r = capture(() => main(["biliboss/some-repo#57", "zz-board-that-does-not-exist"]));
	expect(r.code).toBe(1);
	expect(r.out).toContain("não declara projeto do GitHub");
});

test("a full issue URL is the same shape as owner/repo#n", () => {
	const r = capture(() => main(["https://github.com/biliboss/some-repo/issues/57", "zz-board-that-does-not-exist"]));
	expect(r.code).toBe(1);
	expect(r.out).toContain("não declara projeto do GitHub");
});

test("the address of a card ALREADY on a board is not an issue address, and says so", () => {
	// `soulperuibe#57` is where a card IS; `owner/repo#57` is what a card is made of.
	// Confusing the two silently would put a random repo's issue on the wrong board.
	const r = capture(() => main(["zz-board#57", "zz-board"]));
	expect(r.code).toBe(1);
	expect(r.out).toContain("my kanban move");
});

test("anything else is a local task label, and a missing one is a local error", () => {
	const r = capture(() => main(["999_999_task_that_does_not_exist", "zz-board-that-does-not-exist"]));
	expect(r.code).toBe(1);
	expect(r.out).toContain("nenhuma task");
});
