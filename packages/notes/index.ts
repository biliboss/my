//! `NotesSystemView` — the two lists, the labels, and the two writers.
//! The CLI under `apps/my/src/{notes,daily_notes,labels}/` only reads flags and prints.
//!
//! depends_on: @my/interfaces/notes.ts · ./store.ts

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Finding, NotesSystem } from "@my/interfaces/notes.ts";

import { NOTES, appendDay, dayFile, days, notes, slugify, stamp, writeNote } from "./store.ts";

export { DAILY, NOTES, dayFile, days, home, notes, parse, slugify, stamp, today } from "./store.ts";

type Note = NotesSystem.Entities.Note;
type Counted = NotesSystem.Entities.Counted;

export const KINDS: NotesSystem.ValueObjects.Kind[] = [
	"fleeting",
	"literature",
	"permanent",
	"daily",
	"meeting",
	"decision",
	"reference",
];
export const STATUSES: NotesSystem.ValueObjects.Status[] = ["draft", "active", "stable", "archived"];
export const SCOPES: NotesSystem.ValueObjects.Scope[] = ["personal", "company"];

/** Derived on every read, so a tag dropped from its last note stops existing with
 *  no cleanup step. Ordered by count. */
export function labels(): Counted[] {
	const tally = new Map<string, Counted>();
	const add = (rows: Note[], isNote: boolean) => {
		for (const n of rows) {
			for (const t of n.tags) {
				const c = tally.get(t) ?? { label: t, count: 0, notes: 0 };
				c.count++;
				if (isNote) c.notes++;
				tally.set(t, c);
			}
		}
	};
	add(notes(), true);
	add(days(), false);
	return [...tally.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** AND across every filter, including between tags. */
export function filter(
	rows: Note[],
	f: { tag?: string[]; type?: string; status?: string; grep?: string },
	body: (file: string) => string,
): Note[] {
	let out = rows;
	if (f.type) out = out.filter((n) => n.type === f.type);
	if (f.status) out = out.filter((n) => n.status === f.status);
	if (f.tag?.length) out = out.filter((n) => f.tag!.every((t) => n.tags.includes(t)));
	if (f.grep) {
		const term = f.grep.toLowerCase();
		out = out.filter(
			(n) =>
				n.name.toLowerCase().includes(term) ||
				(n.title ?? "").toLowerCase().includes(term) ||
				body(n.file).toLowerCase().includes(term),
		);
	}
	return out;
}

export type CreateInput = {
	title: string;
	type?: string;
	status?: string;
	scope?: string;
	tags?: string[];
	links?: NotesSystem.Entities.Link[];
	first?: string;
	slug?: string;
};

export function create(input: CreateInput, at = new Date()): { ok: true; note: Note } | { ok: false; error: string } {
	const type = input.type ?? "permanent";
	const status = input.status ?? "draft";
	const scope = input.scope ?? "personal";

	if (!KINDS.includes(type as NotesSystem.ValueObjects.Kind)) {
		return { ok: false, error: `type inválido: "${type}"\n  o schema aceita: ${KINDS.join(", ")}` };
	}
	if (!STATUSES.includes(status as NotesSystem.ValueObjects.Status)) {
		return { ok: false, error: `status inválido: "${status}"\n  o schema aceita: ${STATUSES.join(", ")}` };
	}
	if (!SCOPES.includes(scope as NotesSystem.ValueObjects.Scope)) {
		return { ok: false, error: `scope inválido: "${scope}"\n  o schema aceita: ${SCOPES.join(", ")}` };
	}

	const links = input.links ?? [];
	if (!links.length && !input.first) {
		return {
			ok: false,
			error:
				"nota sem link é nota perdida — ninguém esbarra nela de novo.\n" +
				'  ligue numa existente:  --link <id> --why "<a razão da aresta>"\n' +
				'  ou declare a primeira: --first "<por que ninguém escreveu sobre isto ainda>"\n' +
				"  os ids que existem:    my notes",
		};
	}
	const noReason = links.filter((l) => !l.why?.trim());
	if (noReason.length) {
		return { ok: false, error: `link sem --why: ${noReason.map((l) => l.id).join(", ")}` };
	}

	const existing = notes();
	const known = new Set(existing.map((n) => n.id).filter(Boolean));
	const dangling = links.filter((l) => !known.has(l.id));
	if (dangling.length) {
		return { ok: false, error: `link pra nota que não existe: ${dangling.map((l) => l.id).join(", ")}\n  os ids que existem: my notes` };
	}

	const id = stamp(at);
	const slug = slugify(input.slug ?? input.title);
	if (!slug) return { ok: false, error: `o título não vira slug: "${input.title}" — passe --slug` };

	// The id collides before the filename does: two notes created in the same
	// minute get distinct slugs and identical ids, and a link would then point at
	// two notes. Measured 22/08.
	const taken = existing.find((n) => n.id === id);
	if (taken) {
		return {
			ok: false,
			error: `o id ${id} já é de ${taken.name}\n  o id é o MINUTO, e é o que os links apontam — espere o minuto virar`,
		};
	}

	const file = join(NOTES(), `${id}_${slug}.md`);
	if (existsSync(file)) return { ok: false, error: `já existe: ${file}` };

	const out = [
		"---",
		`type: ${type}`,
		`id: ${id}`,
		`created: ${at.toISOString()}`,
		`scope: ${scope}`,
		`status: ${status}`,
		`title: ${JSON.stringify(input.title)}`,
		...(input.tags?.length ? ["tags:", ...input.tags.map((t) => `  - ${t}`)] : []),
		...(links.length ? ["", "links:", ...links.flatMap((l) => [`  - id: ${l.id}`, `    why: ${l.why}`])] : []),
		"---",
		"",
		`# ${input.title}`,
		"",
		...(input.first ? [`Primeira do assunto: ${input.first}`, ""] : []),
		"<a ideia, em um parágrafo. Se precisa de dois assuntos, são duas notas.>",
		"",
	].join("\n");

	return { ok: true, note: writeNote(file, out) };
}

export function append(
	day: string,
	subject: string,
	body: string,
): { ok: true; note: Note; day: string } | { ok: false; error: string } {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: `data inválida: "${day}" — a forma é YYYY-MM-DD` };
	if (!subject.trim()) return { ok: false, error: "assunto vazio — o `##` do dia é o que se procura depois" };
	return { ok: true, note: appendDay(day, `## ${subject.trim()}\n\n${body.trim()}`), day };
}

export function check(): Finding[] {
	const found: Finding[] = [];
	const rows = notes();
	const ids = new Set(rows.map((n) => n.id).filter(Boolean));

	for (const n of rows) {
		if (!/^\d{4}-\d{2}-\d{2}T\d{4}Z_/.test(`${n.name}_`)) {
			found.push({ path: n.file, says: "o nome não começa com o id — `<id>_<slug>.md`" });
			continue;
		}
		if (n.id && !n.name.startsWith(n.id)) {
			found.push({ path: n.file, says: `o \`id:\` (${n.id}) não é o prefixo do nome — um dos dois mente` });
		}
	}

	for (const d of days()) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(d.name)) found.push({ path: d.file, says: "o nome de um dia é YYYY-MM-DD, e nada mais" });
	}

	for (const n of rows) {
		let text = "";
		try {
			text = readFileSync(n.file, "utf8");
		} catch {
			continue;
		}
		for (const m of text.matchAll(/^\s+- id:\s*(\d{4}-\d{2}-\d{2}T\d{4}Z)\s*$/gm)) {
			if (!ids.has(m[1]!)) found.push({ path: n.file, says: `link pra nota que não existe: ${m[1]}` });
		}
	}

	return found;
}

/** Reading never creates the file: an empty day born from a query has no author. */
export const hasDay = (day: string): boolean => existsSync(dayFile(day));
