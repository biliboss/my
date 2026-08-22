#!/usr/bin/env bun
//! A new zettel. The gate lives in `@biliboss/notes#create`.
//!
//!     my notes new "the idea" --link 2026-08-22T0743Z --why "same pair of boxes"
//!     my notes new "first of its subject" --first "nobody has written this down"
//!     my notes new "study" --type literature --tag remoto --status draft

import { Command } from "commander";

import { KINDS, SCOPES, STATUSES, create } from "@biliboss/notes";

export function command(): Command {
	return new Command("new")
		.description("Um zettel novo — e ele nasce válido ou não nasce.")
		.argument("<titulo>", "a IDEIA, numa frase. O slug sai daqui")
		.option("--type <t>", KINDS.join(" | "), "permanent")
		.option("--status <s>", STATUSES.join(" | "), "draft")
		.option("--scope <s>", SCOPES.join(" | "), "personal")
		.option("--tag <t...>", "os labels desta nota — o que `my labels` conta")
		.option("--link <id...>", "o id de uma nota existente; cada um exige um --why")
		.option("--why <texto...>", "a razão de cada --link, na mesma ordem")
		.option("--first <porque>", "declara que é a primeira do assunto, no lugar de um link");
}

export async function main(argv: string[]): Promise<number> {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (err) {
		return (err as { exitCode?: number }).exitCode ?? 1;
	}
	const [titulo] = cmd.args;
	const o = cmd.opts();

	const ids: string[] = o.link ?? [];
	const whys: string[] = o.why ?? [];
	// Order is the command line's contract, so the mismatch dies here.
	if (ids.length !== whys.length) {
		console.error(`${ids.length} --link e ${whys.length} --why: cada aresta precisa da sua razão, na mesma ordem`);
		return 2;
	}

	const out = create({
		title: titulo!,
		type: o.type,
		status: o.status,
		scope: o.scope,
		tags: o.tag,
		links: ids.map((id, i) => ({ id, why: whys[i]! })),
		first: o.first,
	});

	if (!out.ok) {
		console.error(out.error);
		return 1;
	}
	console.log(out.note.file);
	console.log(`id ${out.note.id} · ${out.note.type} · ${out.note.status}${out.note.tags.length ? ` · tags: ${out.note.tags.join(", ")}` : ""}`);
	console.log("confira a casa depois: my check notes");
	return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
