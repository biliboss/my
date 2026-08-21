//! `my kanban move` — which board an address means, and every refusal that happens
//! BEFORE a point is spent or a window is opened.
//!
//! WHY NO TEST MOVES A CARD OUT OF `Human Review`: doing so would open a real popup on
//! Gabriel's screen and wait ten minutes for him. The policy itself is proved in
//! `model.test.ts`, on `guardMove`, which is exactly why it lives in `model.ts` and not
//! inline here — a rule that can only be re-proved by interrupting a human is a rule
//! nobody re-proves.
//!
//! The live evidence for the write path is in the task's record: `soulperuibe#6`
//! Inbox → Todo → Inbox against project 24, verified between each step by a raw
//! `gh api graphql` call that this code did not make.

import { expect, test } from "bun:test";
import { main } from "./move.ts";

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

test("with fewer than two arguments it teaches both grammars", () => {
	const r = capture(() => main([]));
	expect(r.code).toBe(1);
	expect(r.out).toContain("<board>#<issue>");
});

test("the `#` is what routes: an address with one is remote, a task label never has one", () => {
	// `zz-…` declares no GitHub project, so the remote arm stops before any call. That
	// it stops HERE — with the remote message and not "nenhum card" — is the proof the
	// dispatch went the right way.
	const r = capture(() => main(["zz-board-that-does-not-exist#57", "Todo"]));
	expect(r.code).toBe(1);
	expect(r.out).toContain("não declara projeto do GitHub");

	const local = capture(() => main(["999_999_task_that_does_not_exist", "in_progress"]));
	expect(local.code).toBe(1);
	expect(local.out).toContain("nenhum card");
});

test("an unknown local column is refused by name, and the four are listed", () => {
	const r = capture(() => main(["999_999_task_that_does_not_exist", "Human Review"]));
	expect(r.code).toBe(1);
	// `Human Review` has no folder behind it: it exists only on the GitHub board, and a
	// local move to it must fail loudly rather than invent a fifth directory.
	expect(r.out).toContain("coluna desconhecida");
});

test("`--human` is a flag on the command, not a positional — it never becomes the column", () => {
	const r = capture(() => main(["zz-board-that-does-not-exist#57", "Todo", "--human"]));
	expect(r.code).toBe(1);
	expect(r.out).toContain("não declara projeto do GitHub");
});
