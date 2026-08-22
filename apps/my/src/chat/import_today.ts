#!/usr/bin/env bun
//! One-shot import of the four `_today/` JSONL channels into `.my_chat.tsv`.
//!
//!     my chat import_today                                  the dry run — the default
//!     my chat import_today --write                          only after every refusal is ruled
//!     my chat import_today --alias designer=design          two names, one agent
//!     my chat import_today --distinct pm,pm-app             two names, two agents
//!     my chat import_today --drop .pm.jsonl:11              a torn line, named by hand
//!     my chat import_today --from /path/to/_today           where the JSONL lives
//!     my chat import_today --no-rulings                     what the files say, before the house has an opinion
//!
//! IT DIES AT CUTOVER STEP 4 (@_today/001_today_moves_into_my.md). A one-shot
//! importer left on disk is a second writer into an append-only file, and two
//! writers into one file is how the four torn lines below were made.
//!
//! IT REFUSES INSTEAD OF GUESSING, on three things measured 21/08:
//!
//!   TORN LINES     4 of 620 do not parse — truncated mid-object by an interleaved
//!                  append. Dropping them silently loses whatever they said, and
//!                  nobody would ever learn what. They must be named one by one on
//!                  the command line (`--drop <file>:<line>`) before `--write` runs.
//!   TWO NAMES      `design` and `designer` write in the same two channels. If one
//!                  agent has two names, importing as-is makes the split PERMANENT:
//!                  every cursor, every `to:`, every `who` reading splits in half
//!                  forever. Only a human knows which pairs are one agent.
//!   `re`           it is a STRING (`pm@2026-08-21T13:20:30Z`), never a seq. Where
//!                  the string names exactly one imported line, it becomes
//!                  `answers`. Where it names none, or names TWO, it goes to
//!                  `thread` as raw text. A `seq` is an address — inventing one
//!                  makes a message answer something it never answered. Same
//!                  discipline `store.ts` took with `channel: ""`.
//!
//! THE SIX LINE TYPES, and where each one lands:
//!
//!   message   → `Message`, unchanged.
//!   review    → `Message` with `thread` = `<channel>#<issue>`. `answers` is left
//!               EMPTY: a review names the issue it judges, never the seq, and no
//!               field in the line carries one. See `answers` above.
//!   summary   → `Message`, threaded on its issue exactly like a review, and its
//!               `bullets[]` folded into the text as `- ` lines. It is NOT counted
//!               as a review: one judges and one recaps, and the report says which.
//!               Found 22/08 — the fifth type appeared AFTER the corpus was first
//!               measured, which is the open-enum rule paying for itself: the four
//!               lines stopped the import instead of arriving as something else.
//!   ack       → the CURSOR, not a message. Its `re` resolves to a seq, and that
//!               seq is how far its author had read.
//!   join      → `Channel.members`.
//!   protocol  → the channel BODY, and it is REPORTED, NOT WRITTEN: `Channel`
//!               (@packages/interfaces/chat.ts) has no `body` field, and T4 owns
//!               that contract. Writing the body to a file the contract does not
//!               name would be a second store nothing reads. The source JSONL is
//!               not deleted here, so nothing is lost yet — but the body does NOT
//!               come over until `Channel` grows the field.
//!
//! An unrecognised `type` is refused, never coerced to `message`: the house rule
//! for outside data is to keep the enum OPEN and stop, not to pick the nearest
//! known variant.
//!
//! WHY THIS FILE WRITES THE TSV ROW ITSELF instead of calling `store.append()`:
//! `append` stamps `at = now()` and refuses a caller-supplied instant, which is
//! right for every other writer and wrong for exactly this one — it would erase
//! 620 real timestamps and replace them with the minute the import ran. The row
//! format is duplicated here, and that duplication is the reason this file has a
//! deletion date.
//!
//! depends_on: src/chat/store.ts · packages/interfaces/chat.ts
//! impacts:    .my_chat.tsv · .my_chat_channels.tsv · .my_chat_cursors/

import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import { allMessages, busPath, getCursor, type Msg, registerChannel, setCursor } from "@my/chat";

/** The four channels, in the order their seqs are assigned. FILE ORDER inside a
 *  file, never sorted by `ts`: an ack carries the clock of the machine that wrote
 *  it, and several of them are stamped BEFORE the message they acknowledge
 *  (`.viacorretor.jsonl:19` acks a 13:20:00 line at 11:36:53). Sorting by that
 *  clock would reorder a conversation against the file that recorded it. */
const CHANNEL_FILES = [".soulperuibe.jsonl", ".viacorretor.jsonl", ".mukutu.jsonl", ".pm.jsonl"] as const;

const DEFAULT_SOURCE = () => process.env.TODAY_DIR ?? join(homedir(), "src/me/_today");

/** THE RULINGS, taken 21/08, and written HERE rather than typed as flags at the
 *  cutover. A `--alias` on a command line carries the decision and loses the
 *  reason, and the reason is the whole of it: six months from now the question is
 *  never "which flag" but "why that way round".
 *
 *  THEY ARE STILL CHECKED, all of them. A ruling that names a line which parses
 *  fine becomes a STALE DROP and blocks the write — nothing here is a default that
 *  can pass in silence. That is what makes it safe to pin a line number into source
 *  in a file four agents are appending to this second.
 *
 *  `--no-rulings` runs without them, which is how you see what the files say before
 *  the house has an opinion. */
export const RULINGS = {
	/** ONE AGENT, TWO NAMES — and note the direction: `design` is what DIES.
	 *  `designer` is the name the herdr reports, the name it has signed in the
	 *  channel since yesterday, and the name `.today.yaml` was corrected to today.
	 *  Folding the other way would rename the survivor to match the corpse. */
	alias: [["design", "designer", "`designer` is canonical: herdr, the signature since 20/08, and .today.yaml"]],

	/** TWO NAMES THAT ARE NOT ONE AGENT. Folding either pair erases something the
	 *  channel actually recorded, and no later reader could tell it was ever there. */
	distinct: [
		["pm", "pm-app", "pm-app builds the channel viewer and is the OTHER SIDE of .pm.jsonl — folding erases that the platform had its own owner, and erases an argument where the two disagreed and one corrected the other"],
		["pm", "pm_owner", "two different Claude Code sessions, in two different panes (w52:p1 and w52:p3)"],
	],

	/** THE FIVE OF TODAY, and the date is load-bearing. A line number moves with
	 *  every append and these four files are live, so this is a RECEIPT of what was
	 *  ruled on 21/08 — never a standing truth. The `--dry-run` that runs immediately
	 *  before the cutover, in the same session, is what decides: if it names a
	 *  different line, ITS list wins and this one blocks until somebody re-reads it. */
	drop: [
		[".pm.jsonl:11", "torn — a fragment of an object with no end; nothing to recover"],
		[".pm.jsonl:14", "torn — a fragment of an object with no end; nothing to recover"],
		[".pm.jsonl:20", "torn — a fragment of an object with no end; nothing to recover"],
		[".pm.jsonl:24", "torn — a fragment of an object with no end; nothing to recover"],
		[".soulperuibe.jsonl:168", "parses, and has no author (`from` is {}) — not a message from anybody"],
	],
} as const;

export type Ruled = { alias: Map<string, string>; distinct: Set<string>; drop: Set<string>; why: Map<string, string> };

/** The rulings as the three sets `plan()` takes, plus the reason for each, so the
 *  report can say WHY it dropped a line instead of only that it did. */
export function ruled(): Ruled {
	const alias = new Map<string, string>();
	const distinct = new Set<string>();
	const drop = new Set<string>();
	const why = new Map<string, string>();
	for (const [from, to, reason] of RULINGS.alias) {
		alias.set(from, to);
		why.set(`alias ${from}`, reason);
	}
	for (const [a, b, reason] of RULINGS.distinct) {
		distinct.add(`${a} ${b}`);
		why.set(`distinct ${a} ${b}`, reason);
	}
	for (const [line, reason] of RULINGS.drop) {
		drop.add(line);
		why.set(`drop ${line}`, reason);
	}
	return { alias, distinct, drop, why };
}

const HEADER = "seq\tchannel\tfrom\tto\tat\ttext\tthread\tanswers";

/** Same rule as `store.ts`: a control character inside a TSV corrupts every column
 *  after it for whoever reads by index. Escape on WRITE — on read the damage is
 *  already done. Duplicated here rather than imported because `store.ts` keeps it
 *  private, and this file is deleted before the duplication can rot. */
const clean = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();

/** ISO8601 to the second, the shape `store.ts` writes. Anything that is not an
 *  instant is refused rather than defaulted to now: a message with the wrong hour
 *  reads as a message somebody actually sent at that hour. */
function instant(ts: unknown): string | null {
	if (typeof ts !== "string") return null;
	const d = new Date(ts);
	if (Number.isNaN(d.getTime())) return null;
	return `${d.toISOString().slice(0, 19)}Z`;
}

type Line = { file: string; n: number; raw: string; obj: Record<string, unknown> | null; why?: string };

type Refused = { file: string; n: number; kind: "torn" | "no author" | "no instant" | "unknown type"; says: string };

/** A line that will become a `Message`, before its `seq` and its `answers` exist. */
type Pending = {
	line: Line;
	channel: string;
	from: string;
	to: string;
	at: string;
	text: string;
	thread?: string;
	/** The raw `re` string, unresolved. Becomes `answers` or falls back to `thread`. */
	re?: string;
	/** Resolved from `re`, and ONLY from `re`. Never derived, never nearest-match. */
	answers?: number;
	isReview: boolean;
	/** `<from>@<ts>` and, for a review, its `id` — every string another line can name it by. */
	keys: string[];
	seq: number;
};

export type Plan = {
	source: string;
	perChannel: {
		channel: string;
		file: string;
		lines: number;
		counts: Record<string, number>;
		refused: number;
		members: string[];
		protocolBytes: number;
	}[];
	refused: Refused[];
	/** Author name pairs where one is a strict prefix of the other, unruled. */
	collisions: { a: string; b: string; countA: number; countB: number; channels: string[] }[];
	pending: Pending[];
	reTotal: number;
	reResolved: number;
	reUnresolved: { file: string; n: number; re: string; why: "no match" | "ambiguous" }[];
	reviewsWithoutAnswers: number;
	cursors: { channel: string; who: string; upto: number; current: number }[];
	/** `--drop` flags naming a line that parses fine — a stale flag from an earlier
	 *  run, which would silently lose whatever arrived at that line number since. */
	staleDrops: string[];
	alreadyImported: string[];
	firstSeq: number;
};

function readLines(dir: string, file: string): Line[] {
	const path = join(dir, file);
	if (!existsSync(path)) return [];
	const out: Line[] = [];
	const text = readFileSync(path, "utf8");
	const raws = text.split("\n");
	// A trailing newline yields a final empty element that is not a line.
	if (raws.length && raws[raws.length - 1] === "") raws.pop();
	raws.forEach((raw, i) => {
		const n = i + 1;
		if (!raw.trim()) {
			out.push({ file, n, raw, obj: null, why: "empty line" });
			return;
		}
		try {
			const parsed: unknown = JSON.parse(raw);
			if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
				out.push({ file, n, raw, obj: null, why: "not a JSON object" });
				return;
			}
			out.push({ file, n, raw, obj: parsed as Record<string, unknown> });
		} catch (e) {
			out.push({ file, n, raw, obj: null, why: (e as Error).message });
		}
	});
	return out;
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** WHO ELSE THIS NAME COULD BE. A strict prefix, and nothing cleverer: `design` /
 *  `designer` is caught, and so are `pm` / `pm-app` and `pm` / `pm_owner`, which
 *  are just as ambiguous and just as unknowable from the file. An edit-distance
 *  rule was tried and rejected — at these name lengths it pairs `pm` with `qa`,
 *  which is noise, and noise in a refusal teaches people to pass the flag blind. */
const prefixPair = (a: string, b: string) => a !== b && (a.startsWith(b) || b.startsWith(a));

export function plan(opts: {
	source: string;
	alias: Map<string, string>;
	distinct: Set<string>;
	drop: Set<string>;
}): Plan {
	const { source, alias, distinct, drop } = opts;
	const resolveName = (n: string) => alias.get(n) ?? n;

	const refused: Refused[] = [];
	const pending: Pending[] = [];
	const perChannel: Plan["perChannel"] = [];
	const acks: { channel: string; who: string; re: string; file: string; n: number }[] = [];
	const authorCount = new Map<string, number>();
	const authorChannels = new Map<string, Set<string>>();

	for (const file of CHANNEL_FILES) {
		const lines = readLines(source, file);
		if (!lines.length) continue;
		const counts: Record<string, number> = {};
		const members = new Set<string>();
		let protocolBytes = 0;
		// The channel is the project name, and the protocol line declares it. The
		// filename is the fallback, not the source: a file renamed by hand must not
		// silently rename a channel that 600 lines already belong to.
		let channel = basename(file, ".jsonl").replace(/^\./, "");
		const protocol = lines.find((l) => l.obj?.type === "protocol");
		const declared = str(protocol?.obj?.channel);
		if (declared) channel = declared;

		let refusedHere = 0;
		for (const line of lines) {
			if (!line.obj) {
				refused.push({ file, n: line.n, kind: "torn", says: `${line.why} (${line.raw.length} bytes)` });
				refusedHere++;
				continue;
			}
			const type = str(line.obj.type) ?? "<none>";
			// Counted only where the line is ACCEPTED. A refused line counted as its
			// own type would make the table's columns sum past `lines`, and a table
			// that does not add up is how a lost line hides.
			const accept = () => {
				counts[type] = (counts[type] ?? 0) + 1;
			};

			if (type === "protocol") {
				accept();
				protocolBytes = line.raw.length;
				const roles = line.obj.roles_so_far;
				if (roles && typeof roles === "object" && !Array.isArray(roles)) {
					for (const k of Object.keys(roles)) members.add(resolveName(k));
				}
				continue;
			}

			const rawFrom = line.obj.from;
			const from = str(rawFrom);
			if (!from) {
				refused.push({ file, n: line.n, kind: "no author", says: `\`from\` is not a name: ${JSON.stringify(rawFrom)}` });
				refusedHere++;
				continue;
			}
			const who = resolveName(from);
			authorCount.set(who, (authorCount.get(who) ?? 0) + 1);
			if (!authorChannels.has(who)) authorChannels.set(who, new Set());
			authorChannels.get(who)?.add(channel);

			if (type === "join") {
				accept();
				members.add(who);
				continue;
			}

			const at = instant(line.obj.ts);
			if (!at) {
				refused.push({ file, n: line.n, kind: "no instant", says: `\`ts\` is not an instant: ${JSON.stringify(line.obj.ts)}` });
				refusedHere++;
				continue;
			}

			if (type === "ack") {
				const re = str(line.obj.re);
				if (!re) {
					refused.push({ file, n: line.n, kind: "no instant", says: "ack with no `re`: it points at nothing" });
					refusedHere++;
					continue;
				}
				accept();
				acks.push({ channel, who, re, file, n: line.n });
				continue;
			}

			if (type !== "message" && type !== "review" && type !== "summary") {
				// Open enum: an unknown variant stops the import instead of being
				// coerced into the nearest known one.
				refused.push({ file, n: line.n, kind: "unknown type", says: `unknown \`type\`: ${JSON.stringify(line.obj.type)}` });
				refusedHere++;
				continue;
			}

			let text = str(line.obj.text) ?? "";
			const bullets = line.obj.bullets;
			if (Array.isArray(bullets) && bullets.length) {
				// A summary is a headline plus its evidence, and the evidence is the
				// half that can be checked. `Message` has one text field, so the
				// bullets fold into it — dropping them keeps the claim and loses
				// every number behind it.
				const lines = bullets.map((b) => (typeof b === "string" ? b : "")).filter(Boolean);
				if (lines.length) text = [text, ...lines.map((l) => `- ${l}`)].join("\n");
			}
			const files = line.obj.files;
			if (Array.isArray(files) && files.length) {
				// The text says "ver [File #1]". Dropping the path leaves a reference to
				// nothing, and `Message` has no attachment field to carry it.
				const paths = files.map((f) => (typeof f === "string" ? f : str((f as Record<string, unknown>)?.path) ?? "")).filter(Boolean);
				if (paths.length) text = `${text} [files: ${paths.join(" ")}]`;
			}

			let thread = str(line.obj.thread) ?? undefined;
			const keys = [`${who}@${str(line.obj.ts)}`];
			const isReview = type === "review";
			// A summary and a review are different acts — one judges, one recaps —
			// but both name an ISSUE and neither names a seq. The threading is the
			// same; the label is not, so `isReview` stays false for a summary and
			// only the reporting below tells them apart.
			const onIssue = isReview || type === "summary";
			if (onIssue) {
				const issue = line.obj.issue;
				if (issue === undefined || issue === null) {
					refused.push({ file, n: line.n, kind: "unknown type", says: `${type} with no \`issue\`: nothing to thread it on` });
					refusedHere++;
					continue;
				}
				thread = `${channel}#${issue}`;
				const id = str(line.obj.id);
				if (id) keys.push(id);
			}

			accept();
			pending.push({
				line,
				channel,
				from: who,
				// `to` absent means the room. 81% of the corpus is `to: all` by omission
				// and never declared, so the omission IS the value.
				to: resolveName(str(line.obj.to) ?? "all"),
				at,
				text,
				thread,
				re: str(line.obj.re) ?? undefined,
				isReview,
				keys,
				seq: 0,
			});
		}

		perChannel.push({
			channel,
			file,
			lines: lines.length,
			counts,
			refused: refusedHere,
			members: [...members].sort(),
			protocolBytes,
		});
	}

	// --- seq, assigned only after every refusal is known -----------------------
	const existing = allMessages();
	const firstSeq = (existing.length ? existing[existing.length - 1]!.seq : 0) + 1;
	const dropped = new Set<string>();
	let seq = firstSeq;
	for (const p of pending) {
		if (drop.has(`${p.line.file}:${p.line.n}`)) {
			dropped.add(`${p.line.file}:${p.line.n}`);
			continue;
		}
		p.seq = seq++;
	}
	const kept = pending.filter((p) => p.seq > 0);

	// --- `re` → seq, per channel, and never across one -------------------------
	// A key is `<from>@<ts>` or a review `id`. Both are strings the writer chose,
	// so neither is guaranteed unique: where two lines answer to the same key the
	// reference is AMBIGUOUS, and picking the first would be inventing an address.
	const index = new Map<string, Pending[]>();
	for (const p of kept) {
		for (const k of p.keys) {
			const bucket = `${p.channel} ${k}`;
			if (!index.has(bucket)) index.set(bucket, []);
			index.get(bucket)?.push(p);
		}
	}
	// AN ALIAS RENAMES THE AUTHOR, SO IT MUST RENAME THE POINTER TOO. A `re` reads
	// `<from>@<ts>`, and the `<from>` in it is the name as WRITTEN — fold `design`
	// into `designer` without folding the pointer and every ack quoting `design@…`
	// stops resolving, silently, into `thread` text. No `re` in the corpus names
	// `design` TODAY, which is exactly why this would have gone unnoticed: the first
	// one to break it would be written after the import was already believed good.
	// A review id (`soulperuibe#24@…`) has no author in the head and passes through.
	const aliasRe = (re: string) => {
		const at = re.indexOf("@");
		if (at < 0) return re;
		const mapped = alias.get(re.slice(0, at));
		return mapped ? mapped + re.slice(at) : re;
	};
	const lookup = (channel: string, re: string): { hit?: Pending; why?: "no match" | "ambiguous" } => {
		const bucket = index.get(`${channel} ${aliasRe(re)}`);
		if (!bucket || bucket.length === 0) return { why: "no match" };
		if (bucket.length > 1) return { why: "ambiguous" };
		return { hit: bucket[0] };
	};

	const reUnresolved: Plan["reUnresolved"] = [];
	let reTotal = 0;
	let reResolved = 0;
	for (const p of kept) {
		if (!p.re) continue;
		reTotal++;
		const { hit, why } = lookup(p.channel, p.re);
		if (hit) {
			reResolved++;
			p.answers = hit.seq;
			// A reply to a review inherits the issue it is about. The `re` string
			// literally names it, so this is reading the value, not guessing one.
			if (!p.thread && hit.thread) p.thread = hit.thread;
		} else {
			reUnresolved.push({ file: p.line.file, n: p.line.n, re: p.re, why: why ?? "no match" });
			// Never invent a seq: the pointer survives as text, where it can be read
			// by a human and repaired by anyone who learns what it meant.
			if (!p.thread) p.thread = p.re;
		}
	}

	// --- ack → cursor ----------------------------------------------------------
	const highest = new Map<string, number>();
	for (const a of acks) {
		reTotal++;
		const { hit, why } = lookup(a.channel, a.re);
		if (!hit) {
			reUnresolved.push({ file: a.file, n: a.n, re: a.re, why: why ?? "no match" });
			continue;
		}
		reResolved++;
		const key = `${a.channel} ${a.who}`;
		highest.set(key, Math.max(highest.get(key) ?? 0, hit.seq));
	}
	const cursors: Plan["cursors"] = [...highest].map(([key, upto]) => {
		const [channel, who] = key.split(" ");
		return { channel: channel ?? "", who: who ?? "", upto, current: getCursor(channel ?? "", who ?? "") };
	});

	// --- name collisions -------------------------------------------------------
	const names = [...authorCount.keys()].sort();
	const collisions: Plan["collisions"] = [];
	for (let i = 0; i < names.length; i++) {
		for (let j = i + 1; j < names.length; j++) {
			const a = names[i]!;
			const b = names[j]!;
			if (!prefixPair(a, b)) continue;
			if (distinct.has(`${a} ${b}`) || distinct.has(`${b} ${a}`)) continue;
			const chans = new Set([...(authorChannels.get(a) ?? []), ...(authorChannels.get(b) ?? [])]);
			collisions.push({ a, b, countA: authorCount.get(a) ?? 0, countB: authorCount.get(b) ?? 0, channels: [...chans].sort() });
		}
	}

	// The guard used to fire on the CHANNEL being present, which reads "imported"
	// off a fact that only means "somebody said something here once". Measured
	// 22/08: `.my_chat.tsv` held 4 lines written by hand into three channels, and
	// that alone blocked an import of 600+ that had never run. A channel is not a
	// receipt. The receipt is the LINE, and its identity is who said it, where,
	// and when — the same triple the JSONL carries and the importer preserves.
	const seen = new Set(existing.map((m) => `${m.channel}|${m.from}|${m.at}`));
	const alreadyImported = [...new Set(kept.filter((p) => seen.has(`${p.channel}|${p.from}|${p.at}`)).map((p) => p.channel))].sort();

	// A `--drop` naming a line that parses fine, or no line at all, is a stale flag
	// from a previous run — and these files GROW, so line 11 tomorrow is not the
	// line 11 that tore today. It blocks on its own: it can never be "named", which
	// is how every other refusal is cleared.
	const staleDrops = [...drop].filter((d) => !refused.some((r) => `${r.file}:${r.n}` === d));

	return {
		source,
		perChannel,
		refused,
		collisions,
		pending: kept,
		reTotal,
		reResolved,
		reUnresolved,
		reviewsWithoutAnswers: kept.filter((p) => p.isReview && p.answers === undefined).length,
		cursors,
		staleDrops,
		alreadyImported,
		firstSeq,
	};
}

/** Everything that stops `--write`. Unresolved `re` is NOT here: it degrades to
 *  `thread` text by design, and a channel where nobody can be quoted is still a
 *  channel. A torn line and a split identity are different — both destroy
 *  something the file still holds. */
export function blockers(p: Plan, drop: Set<string>): string[] {
	const out: string[] = [];
	const unnamed = p.refused.filter((r) => !drop.has(`${r.file}:${r.n}`));
	if (unnamed.length) out.push(`${unnamed.length} refused line(s) not named with --drop`);
	if (p.collisions.length) out.push(`${p.collisions.length} name collision(s) not ruled with --alias or --distinct`);
	for (const d of p.staleDrops) out.push(`--drop ${d} names a line that is not refused — a stale flag loses a good line`);
	if (p.alreadyImported.length) out.push(`already imported: ${p.alreadyImported.join(", ")} — .my_chat.tsv already holds these channels`);
	return out;
}

function row(m: Msg): string {
	return [m.seq, m.channel, m.from, m.to, m.at, clean(m.text), m.thread ?? "", m.answers ?? ""].join("\t");
}

export function write(p: Plan): { rows: number; cursors: number; channels: number } {
	// Members BEFORE the first row, and no longer because it is the only order that
	// works: `registerChannel` unions since 21/08, so registering after the rows
	// keeps the 13 join lines too. It stays first because the channel a reader finds
	// should already name who was in it, never messages in a room with no roster.
	for (const c of p.perChannel) registerChannel(c.channel, c.members);

	const lines = p.pending.map((q) => row(q as unknown as Msg));
	const bus = busPath();
	if (!existsSync(bus)) appendFileSync(bus, `${HEADER}\n`);
	appendFileSync(bus, lines.map((l) => `${l}\n`).join(""));

	// READ BACK WHAT WE WROTE. Four of the source lines tore because a writer
	// trusted its own append, and every one of them was found hours later by a
	// reader. `store.append` re-reads one row; this writes ~590 in one call, so it
	// re-reads all of them, by seq and by author.
	const back = new Map(allMessages().map((m) => [m.seq, m]));
	for (const q of p.pending) {
		const got = back.get(q.seq);
		if (!got) throw new Error(`read-back: seq #${q.seq} (${q.line.file}:${q.line.n}) is not in ${bus}`);
		if (got.from !== q.from || got.at !== q.at || got.channel !== q.channel) {
			throw new Error(`read-back: seq #${q.seq} came back as ${got.channel}/${got.from}/${got.at}, wrote ${q.channel}/${q.from}/${q.at}`);
		}
	}

	// Fold with max, never absolute: this import is a LATE writer against cursors a
	// live listener may already have moved forward, and an absolute write would
	// rewind it — the exact regression `.bus_acks.jsonl` was immune to.
	for (const c of p.cursors) if (c.upto > c.current) setCursor(c.channel, c.who, c.upto);

	return { rows: lines.length, cursors: p.cursors.filter((c) => c.upto > c.current).length, channels: p.perChannel.length };
}

// =============================================================================
// the report
// =============================================================================

const pad = (s: string, n: number) => s.padEnd(n);

function report(p: Plan, drop: Set<string>, willWrite: boolean, why: Map<string, string>): void {
	console.log(`source   ${p.source}`);
	console.log(`target   ${busPath()}   (next seq #${p.firstSeq})`);
	console.log("");

	// The rulings are printed EVERY run, whether or not they changed anything. A
	// decision that only shows up when it fires is a decision nobody audits.
	if (why.size) {
		console.log(`RULINGS (${why.size}) — carried in the source, still checked every run`);
		for (const [k, reason] of why) console.log(`  ${pad(k, 30)}${reason}`);
		console.log("");
	} else {
		console.log("RULINGS: none (--no-rulings) — this is what the files say before the house has an opinion");
		console.log("");
	}

	const types = ["message", "review", "summary", "ack", "join", "protocol"];
	console.log(`${pad("channel", 14)}${pad("file", 22)}${pad("lines", 7)}${types.map((t) => pad(t, 10)).join("")}refused`);
	const total: Record<string, number> = {};
	let totalLines = 0;
	let totalRefused = 0;
	for (const c of p.perChannel) {
		totalLines += c.lines;
		totalRefused += c.refused;
		for (const t of types) total[t] = (total[t] ?? 0) + (c.counts[t] ?? 0);
		console.log(
			pad(c.channel, 14) + pad(c.file, 22) + pad(String(c.lines), 7) + types.map((t) => pad(String(c.counts[t] ?? 0), 10)).join("") + String(c.refused),
		);
	}
	console.log(pad("TOTAL", 36) + pad(String(totalLines), 7) + types.map((t) => pad(String(total[t] ?? 0), 10)).join("") + String(totalRefused));
	console.log("");

	if (p.refused.length) {
		console.log(`REFUSED LINES (${p.refused.length}) — nothing is dropped that you did not name`);
		for (const r of p.refused) {
			const key = `${r.file}:${r.n}`;
			const named = drop.has(key) ? (why.has(`drop ${key}`) ? "  [RULED]" : "  [--drop given]") : "";
			console.log(`  ${pad(key, 24)}${pad(r.kind, 14)}${r.says}${named}`);
		}
		const unnamed = p.refused.filter((r) => !drop.has(`${r.file}:${r.n}`));
		if (unnamed.length) console.log(`  → to drop them: ${unnamed.map((r) => `--drop ${r.file}:${r.n}`).join(" ")}`);
		console.log("");
	}

	if (p.staleDrops.length) {
		console.log(`STALE --drop (${p.staleDrops.length}) — these name a line that parses fine`);
		for (const d of p.staleDrops) console.log(`  ${d}`);
		console.log("");
	}

	if (p.collisions.length) {
		console.log(`NAME COLLISIONS (${p.collisions.length}) — one agent with two names, or two agents?`);
		for (const c of p.collisions) {
			console.log(`  ${pad(`${c.a} (${c.countA})`, 20)}~ ${pad(`${c.b} (${c.countB})`, 20)}channels: ${c.channels.join(", ")}`);
			console.log(`     same agent → --alias ${c.b}=${c.a} (or ${c.a}=${c.b}; the LEFT name dies)      different → --distinct ${c.a},${c.b}`);
		}
		console.log("");
	}

	console.log(`\`re\` (${p.reTotal}) — ${p.reResolved} resolved to a seq, ${p.reUnresolved.length} unresolvable → \`thread\` as raw text`);
	for (const u of p.reUnresolved) console.log(`  ${pad(`${u.file}:${u.n}`, 24)}${pad(u.why, 12)}${u.re}`);
	console.log("");

	const reviews = p.pending.filter((q) => q.isReview);
	if (reviews.length) {
		console.log(`REVIEWS (${reviews.length}) — \`thread\` = the issue, \`answers\` left EMPTY (no line names the seq being judged)`);
		for (const r of reviews) console.log(`  ${pad(`${r.line.file}:${r.line.n}`, 24)}thread=${r.thread}`);
		console.log("");
	}

	console.log(`CURSORS from ack (${p.cursors.length})`);
	for (const c of p.cursors) console.log(`  ${pad(c.channel, 14)}${pad(c.who, 14)}→ #${c.upto}${c.current ? `  (was #${c.current})` : ""}`);
	console.log("");

	console.log("MEMBERS from join + protocol roles");
	for (const c of p.perChannel) console.log(`  ${pad(c.channel, 14)}${c.members.join(", ") || "(none)"}`);
	console.log("");

	const bodies = p.perChannel.filter((c) => c.protocolBytes > 0);
	console.log(`PROTOCOL BODY (${bodies.length}) — NOT imported: \`Channel\` has no \`body\` field (T4 owns the contract)`);
	for (const c of bodies) console.log(`  ${pad(c.channel, 14)}${c.protocolBytes} bytes stay in ${c.file}`);
	console.log("");

	console.log("DROPPED FIELDS: `role` (always the same string per author, and nothing reads it), `ts2`, `id` on a non-review line");
	console.log("");

	const stop = blockers(p, drop);
	if (stop.length) {
		console.log("BLOCKED:");
		for (const s of stop) console.log(`  ${s}`);
	} else if (willWrite) {
		console.log(`ready: ${p.pending.length} rows from #${p.firstSeq}`);
	} else {
		console.log(`ready: ${p.pending.length} rows from #${p.firstSeq} — rerun with --write`);
	}
}

export function main(argv: string[]): number {
	// The rulings come FIRST and the flags layer on top, so a flag can still
	// override a ruling in the session that finds it wrong. That is the whole point
	// of them being named: an unnamed default cannot be argued with.
	const base = argv.includes("--no-rulings") ? { alias: new Map<string, string>(), distinct: new Set<string>(), drop: new Set<string>(), why: new Map<string, string>() } : ruled();
	const { alias, distinct, drop, why } = base;
	let source = DEFAULT_SOURCE();
	const willWrite = argv.includes("--write");

	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]!;
		if (a === "--alias") {
			const [from, to] = (argv[++i] ?? "").split("=");
			if (!from || !to) return console.error("usage: --alias <old>=<new>"), 2;
			alias.set(from, to);
		} else if (a === "--distinct") {
			const [x, y] = (argv[++i] ?? "").split(",");
			if (!x || !y) return console.error("usage: --distinct <a>,<b>"), 2;
			distinct.add(`${x} ${y}`);
		} else if (a === "--drop") {
			const v = argv[++i];
			if (!v || !v.includes(":")) return console.error("usage: --drop <file>:<line>"), 2;
			drop.add(v);
		} else if (a === "--from") {
			const v = argv[++i];
			if (!v) return console.error("usage: --from <dir>"), 2;
			source = v;
		} else if (a !== "--write" && a !== "--dry-run" && a !== "--no-rulings") {
			return console.error(`unknown flag: ${a}`), 2;
		}
	}

	if (!existsSync(source)) return console.error(`no such directory: ${source}`), 1;
	const found = readdirSync(source).filter((f) => (CHANNEL_FILES as readonly string[]).includes(f));
	if (!found.length) return console.error(`none of the four channel files in ${source}`), 1;

	const p = plan({ source, alias, distinct, drop });
	report(p, drop, willWrite, why);

	const stop = blockers(p, drop);
	if (stop.length) return 1;
	if (!willWrite) return 0;

	const done = write(p);
	console.log("");
	// THE RECEIPT, on the write and not only on the dry run. Whoever runs the
	// cutover sees on screen exactly what did not come over — a discard that only
	// appears in a rehearsal nobody re-reads is a silent discard with extra steps.
	console.log(`DISCARDED (${p.refused.length}) — these lines did NOT come over:`);
	for (const r of p.refused) {
		const key = `${r.file}:${r.n}`;
		console.log(`  ${pad(key, 24)}${pad(r.kind, 14)}${why.get(`drop ${key}`) ?? r.says}`);
	}
	console.log("");
	console.log(`written: ${done.rows} rows, ${done.channels} channels, ${done.cursors} cursors moved`);
	return 0;
}

if (import.meta.main) process.exitCode = main(Bun.argv.slice(2));
