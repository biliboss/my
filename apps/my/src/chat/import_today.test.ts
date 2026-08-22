//! `import_today.ts`: the three refusals, and the five line types landing where the
//! plan said they land.
//!
//! A MIGRATOR THAT IS WRONG LOOKS EXACTLY LIKE ONE THAT WORKED — it prints a row
//! count either way. So the fixture below is built to be wrong in every way the
//! real channels are wrong: a torn line, a line with no author, an unknown `type`,
//! a `re` pointing at nothing, a `re` pointing at TWO things, and two agent names
//! where one is a prefix of the other.
//!
//! `MY_HOME` points at a `mkdtempSync` and `import_today.ts` enters by DYNAMIC
//! `import()` — same reason as `store.test.ts`: a static import is hoisted above
//! the `process.env.MY_HOME = …` line and would run the migration against the real
//! `~/src/me`. The env is handed back in `afterAll`, because `bun test` runs every
//! file in one process and a leaked `MY_HOME` fails the neighbour, not this file.
//!
//! THE SOURCE CHANNELS ARE NEVER WRITTEN TO. The last test reads the real
//! `_today/` when it is there, and asserts only invariants that survive the
//! channels still growing — the four files are live, and hard counts in a test
//! would flake by the hour.
//!
//! depends_on: src/chat/import_today.ts

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, expect, test } from "bun:test";

const HOME = mkdtempSync(join(tmpdir(), "chat-import-home-"));
const REAL_HOME = process.env.MY_HOME;
process.env.MY_HOME = HOME;

const SOURCE = mkdtempSync(join(tmpdir(), "chat-import-src-"));

afterAll(() => {
	if (REAL_HOME === undefined) delete process.env.MY_HOME;
	else process.env.MY_HOME = REAL_HOME;
	rmSync(HOME, { recursive: true, force: true });
	rmSync(SOURCE, { recursive: true, force: true });
});

const { blockers, plan, RULINGS, ruled, write } = await import("./import_today.ts");
const { allMessages, busPath, getCursor, listChannels, setCursor } = await import("./store.ts");

const T = (n: number) => `2026-08-21T10:0${n}:00Z`;

/** Every defect the real channels have, in fourteen lines. */
const FIXTURE = [
	JSON.stringify({ type: "protocol", channel: "mukutu", roles_so_far: { pm: "manager" }, rules: ["ack first"] }),
	JSON.stringify({ type: "join", from: "alice", role: "builder", ts: T(0) }),
	JSON.stringify({ type: "join", from: "alice2", role: "also a builder?", ts: T(0) }),
	JSON.stringify({ type: "message", from: "pm", role: "manager", ts: T(1), text: "start on #7" }), // seq 1
	JSON.stringify({ type: "ack", from: "alice", re: `pm@${T(1)}`, ts: T(2) }), // cursor, not a message
	JSON.stringify({ type: "message", from: "alice", ts: T(3), text: "on it", re: `pm@${T(1)}` }), // seq 2, answers 1
	JSON.stringify({ type: "message", from: "alice", ts: T(4), text: "and this", re: "ghost@2026-01-01T00:00:00Z" }), // seq 3, no match
	JSON.stringify({ type: "review", from: "gabriel", ts: T(5), issue: 7, verdict: "needs_work", id: `mukutu#7@${T(5)}`, text: "look again", files: [{ n: 1, path: "/shot.png" }] }), // seq 4
	JSON.stringify({ type: "message", from: "pm", ts: T(6), text: "reopened", re: `mukutu#7@${T(5)}` }), // seq 5, answers 4
	'{"type":"message","from":"pm","ts":"2026-08-21T10:07:00Z","text":"cut mid-str', // torn
	JSON.stringify({ type: "message", from: {}, ts: T(8), text: "no author" }), // no author
	JSON.stringify({ type: "nudge", from: "pm", ts: T(9), text: "unknown variant" }), // unknown type
	JSON.stringify({ type: "message", from: "pm", ts: "2026-08-21T11:00:00Z", text: "twin a" }), // seq 6
	JSON.stringify({ type: "message", from: "pm", ts: "2026-08-21T11:00:00Z", text: "twin b" }), // seq 7
	JSON.stringify({ type: "message", from: "alice", ts: T(9), text: "which twin?", re: "pm@2026-08-21T11:00:00Z" }), // seq 8, ambiguous
	JSON.stringify({ type: "message", from: "alice2", ts: "2026-08-21T12:00:00Z", text: "the other name speaks" }), // seq 9
	JSON.stringify({ type: "message", from: "pm", ts: "2026-08-21T12:01:00Z", text: "answering it", re: "alice2@2026-08-21T12:00:00Z" }), // seq 10, answers 9
].join("\n");

const RULED = {
	source: SOURCE,
	alias: new Map<string, string>(),
	distinct: new Set(["alice alice2"]),
	drop: new Set([".mukutu.jsonl:10", ".mukutu.jsonl:11", ".mukutu.jsonl:12"]),
};

function reset() {
	for (const p of [busPath(), join(HOME, ".my_chat_cursors"), join(HOME, ".my_chat_channels.tsv")]) {
		rmSync(p, { recursive: true, force: true });
	}
	writeFileSync(join(SOURCE, ".mukutu.jsonl"), `${FIXTURE}\n`);
}

beforeEach(reset);

const nothingRuled = () => ({ source: SOURCE, alias: new Map<string, string>(), distinct: new Set<string>(), drop: new Set<string>() });

test("a torn line is refused by file and number, never dropped in silence", () => {
	const p = plan(nothingRuled());
	const torn = p.refused.filter((r) => r.kind === "torn");
	expect(torn).toHaveLength(1);
	expect(torn[0]).toMatchObject({ file: ".mukutu.jsonl", n: 10 });
	// And the count it printed proves nothing vanished: 15 lines in, and every one
	// is either a row, a cursor, a member, the body, or a named refusal.
	expect(p.perChannel[0]?.lines).toBe(17);
	expect(blockers(p, new Set())).toContain("3 refused line(s) not named with --drop");
});

test("a line whose `from` is not a name is refused — `Message.from` is required", () => {
	const p = plan(nothingRuled());
	expect(p.refused.find((r) => r.n === 11)).toMatchObject({ kind: "no author" });
});

test("an unknown `type` stops the import instead of becoming a message", () => {
	const p = plan(nothingRuled());
	expect(p.refused.find((r) => r.n === 12)).toMatchObject({ kind: "unknown type" });
	expect(p.pending.some((q) => q.text.includes("unknown variant"))).toBe(false);
});

test("two names where one is a prefix of the other block the write until a human rules", () => {
	const p = plan(nothingRuled());
	expect(p.collisions).toHaveLength(1);
	expect(p.collisions[0]).toMatchObject({ a: "alice", b: "alice2" });
	expect(blockers(p, new Set())).toContain("1 name collision(s) not ruled with --alias or --distinct");

	// `--distinct` keeps them apart…
	expect(plan({ ...nothingRuled(), distinct: new Set(["alice alice2"]) }).collisions).toHaveLength(0);
	// …and `--alias` folds them into one, which is what makes the split NOT permanent.
	const folded = plan({ ...nothingRuled(), alias: new Map([["alice2", "alice"]]) });
	expect(folded.collisions).toHaveLength(0);
	expect(folded.perChannel[0]?.members).toEqual(["alice", "pm"]);
});

test("a ruled plan has no blockers left", () => {
	expect(blockers(plan(RULED), RULED.drop)).toEqual([]);
});

test("`re` resolves to a seq where it can, and NEVER invents one where it cannot", () => {
	const p = plan(RULED);
	const bySeq = new Map(p.pending.map((q) => [q.seq, q]));

	// names one line → `answers`
	expect(bySeq.get(2)).toMatchObject({ answers: 1 });
	// names a review by its id → `answers`, and the review's issue comes with it
	expect(bySeq.get(5)).toMatchObject({ answers: 4, thread: "mukutu#7" });
	// names nothing → raw string parked in `thread`, and `answers` stays undefined
	expect(bySeq.get(3)?.answers).toBeUndefined();
	expect(bySeq.get(3)?.thread).toBe("ghost@2026-01-01T00:00:00Z");
	// names TWO lines → also unresolved. Picking the first would be inventing an address.
	expect(bySeq.get(8)?.answers).toBeUndefined();
	expect(bySeq.get(8)?.thread).toBe("pm@2026-08-21T11:00:00Z");

	expect(p.reUnresolved.map((u) => u.why).sort()).toEqual(["ambiguous", "no match"]);
	expect(p.reResolved).toBe(4); // three messages and one ack
});

test("ack is a cursor, not a message", () => {
	const p = plan(RULED);
	expect(p.pending.some((q) => q.from === "alice" && q.text === "")).toBe(false);
	expect(p.cursors).toEqual([{ channel: "mukutu", who: "alice", upto: 1, current: 0 }]);
	write(p);
	expect(getCursor("mukutu", "alice")).toBe(1);
});

test("join is Channel.members, and members are registered before the first row", () => {
	const p = plan(RULED);
	write(p);
	const ch = listChannels().find((c) => c.name === "mukutu");
	// `store.append` find-or-creates with an EMPTY member list and never updates, so
	// registering after the rows would lose every join line without a sound.
	expect(ch?.members.sort()).toEqual(["alice", "alice2", "pm"]);
});

test("review is a Message threaded on the issue, with `answers` left empty", () => {
	const p = plan(RULED);
	const review = p.pending.find((q) => q.isReview);
	expect(review).toMatchObject({ seq: 4, from: "gabriel", thread: "mukutu#7" });
	// No field in a review line carries the seq it judges. Empty is the honest value.
	expect(review?.answers).toBeUndefined();
	expect(p.reviewsWithoutAnswers).toBe(1);
	// The attachment path survives in the text, because `Message` has nowhere else
	// to put it and the prose refers to it.
	expect(review?.text).toContain("/shot.png");
});

test("protocol is reported and NOT written — `Channel` has no body field yet", () => {
	const p = plan(RULED);
	expect(p.perChannel[0]?.protocolBytes).toBeGreaterThan(0);
	write(p);
	expect(allMessages().some((m) => m.text.includes("ack first"))).toBe(false);
});

test("the rows land in .my_chat.tsv with their ORIGINAL instants, not the import's clock", () => {
	const p = plan(RULED);
	const done = write(p);
	expect(done.rows).toBe(10);
	const all = allMessages();
	expect(all.map((m) => m.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	expect(all[0]).toMatchObject({ channel: "mukutu", from: "pm", to: "all", at: T(1), text: "start on #7" });
	// `to` absent means the room: the omission IS the value, in 495 of the 620 real lines.
	expect(all.every((m) => m.to !== "")).toBe(true);
	// Read-back is what proves it: the file on disk parses to what we handed it.
	expect(readFileSync(busPath(), "utf8").split("\n")[0]).toBe("seq\tchannel\tfrom\tto\tat\ttext\tthread\tanswers");
});

test("seq continues from what is already in the file, and never reuses an address", () => {
	writeFileSync(busPath(), "seq\tchannel\tfrom\tto\tat\ttext\tthread\tanswers\n41\t\tbob\tall\t2026-01-01T00:00:00Z\told\t\t\n");
	const p = plan(RULED);
	expect(p.firstSeq).toBe(42);
	write(p);
	expect(allMessages().map((m) => m.seq)).toEqual([41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51]);
});

test("running twice is refused: the channels are already in the file", () => {
	write(plan(RULED));
	const again = plan(RULED);
	expect(again.alreadyImported).toEqual(["mukutu"]);
	expect(blockers(again, RULED.drop)[0]).toContain("already imported");
});

test("a --drop naming a line that parses fine is itself refused", () => {
	// A stale flag from a previous run silently loses a line that arrived since.
	const drop = new Set([...RULED.drop, ".mukutu.jsonl:4"]);
	const p = plan({ ...RULED, drop });
	expect(p.staleDrops).toEqual([".mukutu.jsonl:4"]);
	// And it BLOCKS even though it is itself a `--drop`: naming it is what every
	// other refusal is cleared by, so a stale one could never be cleared at all.
	expect(blockers(p, drop).some((b) => b.includes("stale flag"))).toBe(true);
});

test("the cursor folds with max — a late import never rewinds a live listener", () => {
	setCursor("mukutu", "alice", 99);
	const p = plan(RULED);
	expect(p.cursors[0]).toMatchObject({ upto: 1, current: 99 });
	write(p);
	expect(getCursor("mukutu", "alice")).toBe(99);
});

// =============================================================================
// the real channels — read only, and only invariants that survive them growing
// =============================================================================

test("an alias renames the POINTER too, not only the author", () => {
	// `re` carries the name as WRITTEN. Fold `alice2` into `alice` without folding
	// the `re` that quotes it and the reply resolves to nothing — silently, into
	// `thread` text. Nothing in the real corpus quotes `design` TODAY, which is
	// precisely why this would have gone unnoticed until after the import was
	// believed good.
	const folded = plan({ ...RULED, distinct: new Set(), alias: new Map([["alice2", "alice"]]) });
	const reply = folded.pending.find((q) => q.text === "answering it");
	const spoke = folded.pending.find((q) => q.text === "the other name speaks");
	expect(spoke?.from).toBe("alice");
	expect(reply?.answers).toBe(spoke?.seq);
	expect(folded.reUnresolved.some((u) => u.re.startsWith("alice2@"))).toBe(false);
});

test("the rulings are the same three sets, and every one of them is still checked", () => {
	const r = ruled();
	// The direction is the ruling: `design` dies, `designer` lives.
	expect(r.alias.get("design")).toBe("designer");
	expect(r.alias.has("designer")).toBe(false);
	expect(r.distinct.has("pm pm-app")).toBe(true);
	expect(r.distinct.has("pm pm_owner")).toBe(true);
	expect([...r.drop].sort()).toEqual([".pm.jsonl:11", ".pm.jsonl:14", ".pm.jsonl:20", ".pm.jsonl:24", ".soulperuibe.jsonl:168"]);
	// Every ruling carries its reason. A decision without one is a default.
	expect(r.why.size).toBe(RULINGS.alias.length + RULINGS.distinct.length + RULINGS.drop.length);
	for (const reason of r.why.values()) expect(reason.length).toBeGreaterThan(20);
});

test("a RULED drop gets no exemption: pinned at a line that parses fine, it still blocks", () => {
	// This is the whole safety of pinning line numbers into source while four
	// agents append to the files. The ruling is a receipt of 21/08, not a standing
	// truth, and the run that finds it stale must refuse rather than eat a good line.
	const drop = new Set([...RULED.drop, ".mukutu.jsonl:4"]);
	const p = plan({ ...RULED, drop });
	expect(p.staleDrops).toEqual([".mukutu.jsonl:4"]);
	expect(blockers(p, drop).some((b) => b.includes("stale flag"))).toBe(true);
	// And the good line it named is NOT in the import.
	expect(p.pending.some((q) => q.text === "start on #7")).toBe(false);
});

const CHANNELS = [".soulperuibe.jsonl", ".viacorretor.jsonl", ".mukutu.jsonl", ".pm.jsonl"];
const REAL = process.env.TODAY_DIR ?? join(homedir(), "src/me/_today");

test.skipIf(!existsSync(join(REAL, ".pm.jsonl")))("the real _today parses, and the source is left byte-identical", () => {
	// A COPY, not the live files: four agents are appending to them this second, so a
	// byte-count taken before and after would race their writes and blame this code.
	// The copy is what proves the importer opens the source read-only.
	const copy = mkdtempSync(join(tmpdir(), "chat-import-real-"));
	const before = new Map<string, string>();
	for (const f of CHANNELS) {
		const src = join(REAL, f);
		if (!existsSync(src)) continue;
		const bytes = readFileSync(src, "utf8");
		before.set(f, bytes);
		writeFileSync(join(copy, f), bytes);
	}

	const p = plan({ source: copy, alias: new Map(), distinct: new Set(), drop: new Set() });

	expect(p.perChannel.map((c) => c.channel).sort()).toEqual(["mukutu", "pm", "soulperuibe", "viacorretor"]);
	// Every line is accounted for: a typed line, or a refusal that names it.
	for (const c of p.perChannel) {
		const typed = Object.values(c.counts).reduce((a, b) => a + b, 0);
		expect(typed + c.refused).toBe(c.lines);
	}
	// No row goes out without the four columns `store.parseRow` requires.
	for (const q of p.pending) {
		expect(q.from).not.toBe("");
		expect(q.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
		expect(q.channel).not.toBe("");
		expect(q.to).not.toBe("");
	}
	// Seqs are contiguous from firstSeq — an address is never skipped or reused.
	expect(p.pending.map((q) => q.seq)).toEqual(p.pending.map((_, i) => p.firstSeq + i));
	// Nothing resolved by proximity: every `answers` names a seq this plan assigned.
	const seqs = new Set(p.pending.map((q) => q.seq));
	for (const q of p.pending) if (q.answers !== undefined) expect(seqs.has(q.answers)).toBe(true);
	// The defects measured 21/08 are still exactly what blocks the write.
	expect(p.refused.some((r) => r.kind === "torn" && r.file === ".pm.jsonl")).toBe(true);
	expect(p.collisions.some((c) => c.a === "design" && c.b === "designer")).toBe(true);
	expect(blockers(p, new Set()).length).toBeGreaterThan(0);

	// …and with the rulings of 21/08 carried, the same plan comes out clean.
	const r = ruled();
	const green = plan({ source: copy, alias: r.alias, distinct: r.distinct, drop: r.drop });
	expect(green.collisions).toEqual([]);
	expect(green.pending.some((q) => q.from === "design")).toBe(false);
	expect(green.pending.some((q) => q.from === "designer")).toBe(true);
	// THE DRIFT ALARM. A stale pin means a line number moved, and this test failing
	// is the finding — the `--dry-run` run in the cutover session is what decides,
	// and it would name different lines than `RULINGS.drop` does.
	expect(green.staleDrops).toEqual([]);
	// A failure here is new damage in the live channels, not a broken test: some
	// line tore, or an agent joined under a name that is a prefix of another.
	expect(blockers(green, r.drop)).toEqual([]);

	for (const [f, bytes] of before) expect(readFileSync(join(copy, f), "utf8")).toBe(bytes);
	rmSync(copy, { recursive: true, force: true });
});
