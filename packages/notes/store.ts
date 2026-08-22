//! Disk access for the notes system: read frontmatter, write a zettel, append to a day.
//!
//! depends_on: @my/interfaces/notes.ts

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import type { NotesSystem } from "@my/interfaces/notes.ts";

type Note = NotesSystem.Entities.Note;

/** The house being read, not the checkout running this code. */
export const home = (): string => process.env.MY_HOME ?? join(process.env.HOME ?? homedir(), "src/me");

export const NOTES = (): string => join(home(), "03_resources", "notes");
export const DAILY = (): string => join(home(), "00_daily_notes");

/** Top block only. A `---` further down is a horizontal rule. */
function frontmatter(text: string): string {
	if (!text.startsWith("---")) return "";
	const end = text.indexOf("\n---", 3);
	return end === -1 ? "" : text.slice(4, end);
}

const bare = (s: string): string => s.trim().replace(/^["']|["']$/g, "");

export function parse(file: string): Note {
	let text = "";
	try {
		text = readFileSync(file, "utf8");
	} catch {
		text = "";
	}

	const fm = frontmatter(text);
	const scalar = (key: string): string | undefined => {
		const m = fm.match(new RegExp(`^${key}:[ \\t]*(.+)$`, "m"));
		return (m?.[1] ? bare(m[1]) : undefined) || undefined;
	};

	// Both shapes on disk today: an indented list and `[a, b]`. A third shape reads
	// as no tags, which surfaces the note as untagged in `my labels`.
	const tags: string[] = [];
	const inline = fm.match(/^tags:[ \t]*\[(.*)\]/m);
	if (inline?.[1]) {
		tags.push(...inline[1].split(",").map(bare).filter(Boolean));
	} else {
		const block = fm.match(/^tags:[ \t]*\n((?:[ \t]+-[ \t]*.+\n?)+)/m);
		if (block?.[1]) {
			tags.push(
				...block[1]
					.split("\n")
					.map((l) => bare(l.replace(/^[ \t]*-[ \t]*/, "")))
					.filter(Boolean),
			);
		}
	}

	return {
		file,
		name: basename(file, ".md"),
		id: scalar("id"),
		title: scalar("title"),
		type: scalar("type") as NotesSystem.ValueObjects.Kind | undefined,
		status: scalar("status") as NotesSystem.ValueObjects.Status | undefined,
		tags,
	};
}

/** `CONTEXT.md` describes the folder, so it is never content of it. */
function markdowns(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith(".md") && f !== "CONTEXT.md")
		.sort()
		.map((f) => join(dir, f));
}

/** Newest first. Both axes name their files by date, so name order is time order. */
export const notes = (): Note[] => markdowns(NOTES()).map(parse).reverse();
export const days = (): Note[] => markdowns(DAILY()).map(parse).reverse();

/** `date -u +%Y-%m-%dT%H%MZ`. */
export function stamp(at = new Date()): string {
	const iso = at.toISOString();
	return `${iso.slice(0, 11)}${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;
}

/** `date -u +%Y-%m-%d`. UTC, so the filename does not depend on which machine opened it. */
export const today = (at = new Date()): string => at.toISOString().slice(0, 10);

export function slugify(title: string): string {
	return title
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 72);
}

export function writeNote(file: string, body: string): Note {
	mkdirSync(NOTES(), { recursive: true });
	writeFileSync(file, body);
	return parse(file);
}

export const dayFile = (day: string): string => join(DAILY(), `${day}.md`);

export function appendDay(day: string, section: string): Note {
	mkdirSync(DAILY(), { recursive: true });
	const file = dayFile(day);
	if (!existsSync(file)) writeFileSync(file, `---\ntype: daily\ndate: ${day}\n---\n\n# ${day}\n`);
	const current = readFileSync(file, "utf8");
	writeFileSync(file, `${current.replace(/\n*$/, "")}\n\n${section.replace(/\n*$/, "")}\n`);
	return parse(file);
}
