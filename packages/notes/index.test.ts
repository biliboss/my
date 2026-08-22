import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { append, check, create, days, filter, hasDay, labels, notes } from "./index.ts";

let house = "";
const saved = process.env.MY_HOME;

beforeEach(() => {
	house = mkdtempSync(join(tmpdir(), "my-notes-"));
	mkdirSync(join(house, "03_resources", "notes"), { recursive: true });
	mkdirSync(join(house, "00_daily_notes"), { recursive: true });
	process.env.MY_HOME = house;
});

afterEach(() => {
	if (saved === undefined) delete process.env.MY_HOME;
	else process.env.MY_HOME = saved;
	rmSync(house, { recursive: true, force: true });
});

const at = (minute: string) => new Date(`2026-08-22T${minute}:00.000Z`);
const first = (title: string, opts: Record<string, unknown> = {}, when = at("10:00")) =>
	create({ title, first: "nobody wrote this down", ...opts }, when);

test("a note with no link and no --first is refused, and the error names both ways out", () => {
	const out = create({ title: "orphan" });
	expect(out.ok).toBe(false);
	if (out.ok) return;
	expect(out.error).toContain("--link");
	expect(out.error).toContain("--first");
});

test("type, status and scope are closed enums, and the refusal lists what was accepted", () => {
	for (const [field, value] of [
		["type", "invented"],
		["status", "almost"],
		["scope", "galaxy"],
	] as const) {
		const out = create({ title: "x", first: "y", [field]: value });
		expect(out.ok).toBe(false);
		if (out.ok) continue;
		expect(out.error).toContain(value);
		expect(out.error).toContain("o schema aceita");
	}
});

test("a link to an id that does not exist is refused before the file is written", () => {
	const out = create({ title: "x", links: [{ id: "2020-01-01T0000Z", why: "z" }] });
	expect(out.ok).toBe(false);
	expect(notes()).toHaveLength(0);
});

test("a link with no reason is refused: an edge nobody can judge later", () => {
	first("anchor");
	const anchor = notes()[0]!.id!;
	const out = create({ title: "x", links: [{ id: anchor, why: "  " }] });
	expect(out.ok).toBe(false);
});

test("two notes in the same minute collide on the id, not on the filename", () => {
	expect(first("one", {}, at("10:00")).ok).toBe(true);
	const second = first("two", {}, at("10:00"));
	expect(second.ok).toBe(false);
	if (second.ok) return;
	expect(second.error).toContain("2026-08-22T1000Z");
	expect(notes()).toHaveLength(1);
});

test("a valid note carries the id in both the filename and the frontmatter", () => {
	const out = first("the first idea", { tags: ["proof", "remote"] }, at("10:14"));
	expect(out.ok).toBe(true);
	if (!out.ok) return;
	expect(out.note.id).toBe("2026-08-22T1014Z");
	expect(out.note.name.startsWith("2026-08-22T1014Z_")).toBe(true);
	expect(out.note.tags).toEqual(["proof", "remote"]);
	expect(readFileSync(out.note.file, "utf8")).toContain("Primeira do assunto: nobody wrote this down");
});

test("a link is written as an edge carrying its reason", () => {
	first("anchor", {}, at("10:00"));
	const anchor = notes()[0]!.id!;
	const out = create({ title: "follows", links: [{ id: anchor, why: "continues the first" }] }, at("10:01"));
	expect(out.ok).toBe(true);
	if (!out.ok) return;
	const text = readFileSync(out.note.file, "utf8");
	expect(text).toContain(`  - id: ${anchor}`);
	expect(text).toContain("    why: continues the first");
});

test("filter is AND, including between tags", () => {
	first("a", { tags: ["x", "y"] }, at("10:00"));
	first("b", { tags: ["x"] }, at("10:01"));
	const body = () => "";
	expect(filter(notes(), { tag: ["x"] }, body)).toHaveLength(2);
	expect(filter(notes(), { tag: ["x", "y"] }, body)).toHaveLength(1);
	expect(filter(notes(), { tag: ["x", "absent"] }, body)).toHaveLength(0);
});

test("filter matches the body through the reader it is handed", () => {
	first("a", {}, at("10:00"));
	const hit = filter(notes(), { grep: "needle" }, () => "a needle in here");
	expect(hit).toHaveLength(1);
	expect(filter(notes(), { grep: "needle" }, () => "")).toHaveLength(0);
});

test("labels count both axes and split out the zettel half", () => {
	first("a", { tags: ["shared"] }, at("10:00"));
	append("2026-08-22", "subject", "text");
	// The day carries no tags, so `shared` stays a notes-only label.
	const found = labels().find((l) => l.label === "shared");
	expect(found).toEqual({ label: "shared", count: 1, notes: 1 });
});

test("a label nothing carries does not appear", () => {
	first("a", { tags: ["kept"] }, at("10:00"));
	expect(labels().map((l) => l.label)).toEqual(["kept"]);
});

test("append creates the day with its frontmatter, then only adds to it", () => {
	expect(hasDay("2026-08-22")).toBe(false);
	expect(append("2026-08-22", "first subject", "one").ok).toBe(true);
	expect(append("2026-08-22", "second subject", "two").ok).toBe(true);

	const text = readFileSync(join(house, "00_daily_notes", "2026-08-22.md"), "utf8");
	expect(text).toContain("type: daily");
	expect(text).toContain("## first subject");
	expect(text).toContain("## second subject");
	expect(text.indexOf("first subject")).toBeLessThan(text.indexOf("second subject"));
	expect(days()).toHaveLength(1);
});

test("append refuses a malformed date and an empty subject", () => {
	expect(append("22-08-2026", "a", "b").ok).toBe(false);
	expect(append("2026-08-22", "   ", "b").ok).toBe(false);
	expect(hasDay("2026-08-22")).toBe(false);
});

test("check is quiet on what create wrote", () => {
	first("a", {}, at("10:00"));
	append("2026-08-22", "s", "t");
	expect(check()).toEqual([]);
});

test("check names a note whose filename lost its id", () => {
	Bun.write(join(house, "03_resources", "notes", "no-id-here.md"), "---\ntype: permanent\n---\n\n# x\n");
	const said = check().map((f) => f.says);
	expect(said.some((s) => s.includes("<id>_<slug>.md"))).toBe(true);
});
