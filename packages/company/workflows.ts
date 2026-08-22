//! Reads the company tree: every `CONTEXT.md` carrying `type: workflow`, with the
//! value stream it belongs to and the thesis it opens with.
//!
//! depends_on: —

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative } from "node:path";

export const home = (): string => process.env.MY_HOME ?? join(process.env.HOME ?? homedir(), "src/me");
export const COMPANY = (): string => join(home(), "03_resources", "00_company");

export type Workflow = {
	/** The folder name. It is the address, and the skill is named after it. */
	name: string;
	/** Path relative to the company root — `shared_workflows/research`. */
	rel: string;
	file: string;
	/** The value stream, or `shared` for what all three use. */
	stream: string;
	title: string;
	/** The opening thesis, when the file has one. Absent is a finding, never a
	 *  sentence invented to fill the field. */
	thesis?: string;
	/** `skill:` in the frontmatter, when the workflow declares its own. */
	declared?: { description?: string; triggers?: string[]; skip?: boolean };
};

function frontmatter(text: string): string {
	if (!text.startsWith("---")) return "";
	const end = text.indexOf("\n---", 3);
	return end === -1 ? "" : text.slice(4, end);
}

function body(text: string): string {
	if (!text.startsWith("---")) return text;
	const end = text.indexOf("\n---", 3);
	return end === -1 ? text : text.slice(end + 4);
}

/** The opening thesis: the house writes it as a bold sentence at the top of the
 *  first section. Only a run that READS as a sentence is accepted — a bold
 *  fragment mid-paragraph produced descriptions like ". Não é conselho: é o
 *  portão" and "→ `TaskStop` no monitor", which is worse than none, because a
 *  skill fires on its description. */
export function thesisOf(text: string): string | undefined {
	const b = body(text);

	const sentence = (raw: string): string | undefined => {
		const t = raw.replace(/\s+/g, " ").trim();
		if (t.length < 30 || t.length > 400) return undefined;
		if (!/^[A-ZÀ-Ý"`*]/.test(t)) return undefined;
		if (!/[.!?]$/.test(t)) return undefined;
		// Mermaid arrows and markdown links reach a description as noise: measured
		// 22/08, `generate_output` came out as four `Coordinator->>Run:` lines.
		if (/-->|->>|\]\(/.test(t)) return undefined;
		return t;
	};

	for (const m of b.matchAll(/\*\*([^*]+)\*\*/g)) {
		const hit = sentence(m[1]!);
		if (hit) return hit;
	}

	for (const block of b.split(/\n\s*\n/)) {
		const t = block.trim();
		if (!t || /^[#<`|\-*]/.test(t)) continue;
		const hit = sentence(t.split(/(?<=[.!?])\s/)[0] ?? t);
		if (hit) return hit;
	}
	return undefined;
}

function declaredSkill(fm: string): Workflow["declared"] {
	const block = fm.match(/^skill:[ \t]*\n((?:[ \t]+.+\n?)+)/m);
	if (!block?.[1]) return undefined;
	const raw = block[1];
	const desc = raw.match(/^[ \t]+description:[ \t]*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
	const skip = /^[ \t]+skip:[ \t]*true[ \t]*$/m.test(raw);
	const triggers = [...raw.matchAll(/^[ \t]+-[ \t]*(.+)$/gm)].map((m) => m[1]!.trim().replace(/^["']|["']$/g, ""));
	return { description: desc, triggers: triggers.length ? triggers : undefined, skip };
}

function walk(dir: string, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const e of readdirSync(dir)) {
		const p = join(dir, e);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (e === "CONTEXT.md") out.push(p);
	}
	return out;
}

export function workflows(): Workflow[] {
	const root = COMPANY();
	return walk(root)
		.map((file) => {
			const text = readFileSync(file, "utf8");
			const fm = frontmatter(text);
			if (!/^type:[ \t]*workflow[ \t]*$/m.test(fm)) return undefined;

			const rel = relative(root, dirname(file));
			return {
				name: basename(dirname(file)),
				rel,
				file,
				// `shared_workflows/x` is shared; anything else takes its top folder,
				// which is the value stream that owns it.
				stream: rel.startsWith("shared_workflows") ? "shared" : rel.split("/")[0]!,
				title: body(text).match(/^#\s+(.+)$/m)?.[1]?.trim() ?? basename(dirname(file)),
				thesis: thesisOf(text),
				declared: declaredSkill(fm),
			} as Workflow;
		})
		.filter((w): w is Workflow => w !== undefined)
		.sort((a, b) => (a?.rel ?? "").localeCompare(b?.rel ?? ""));
}
