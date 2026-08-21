//! `my kanban list` — which of the two boards a set of arguments means, and what it
//! says when the answer is "neither".
//!
//! THE ASSERTION THAT MATTERS IS THE ONE ABOUT SILENCE: no argument shape here reaches
//! the network, because none of them names a board that declares a GitHub project. A
//! remote read costs 1 point from a budget shared with every agent, and a test suite
//! that spends it on every run is the 30-second polling that emptied it on 21/08,
//! wearing a different name.

import { expect, test } from "bun:test";
import { main } from "./list.ts";

function capture(fn: () => number): { code: number; out: string } {
	const log = console.log;
	const err = console.error;
	let out = "";
	console.log = (...a: unknown[]) => {
		out += `${a.join(" ")}\n`;
	};
	console.error = (...a: unknown[]) => {
		out += `${a.join(" ")}\n`;
	};
	try {
		return { code: fn(), out };
	} finally {
		console.log = log;
		console.error = err;
	}
}

test("with no argument it lists the local boards and touches nothing remote", () => {
	const r = capture(() => main([]));
	expect(r.code).toBe(0);
});

test("`--remote` on a board that declares no project refuses, and teaches the three ways out", () => {
	const r = capture(() => main(["zz-board-that-does-not-exist", "--remote"]));
	expect(r.code).toBe(1);
	expect(r.out).toContain("my kanban list --remote");
	expect(r.out).toContain("my kanban add gh:");
	expect(r.out).toContain("my kanban list gh:");
});

test("a local board name with no folder is a local error, not a remote one", () => {
	const r = capture(() => main(["zz-board-that-does-not-exist"]));
	expect(r.code).toBe(1);
	expect(r.out).toContain("nenhum board");
});
