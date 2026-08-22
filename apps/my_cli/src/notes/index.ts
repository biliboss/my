#!/usr/bin/env bun
//! The zettels: list and filter by label, type, status and text.
//!
//!     my notes
//!     my notes --tag todo
//!     my notes --type literature --status draft
//!     my notes -g sshfs
//!     my notes --tsv

import { readFileSync } from "node:fs";
import { Command } from "commander";

import { filter, notes } from "@biliboss/my-notes";
import { fmtOf, out } from "../shared/gh.ts";

export function command(): Command {
	return new Command("notes")
		.description("Os zettels: lista e filtra por label, tipo, status e texto.")
		.option("--tag <t...>", "só as que carregam TODOS estes labels")
		.option("--type <t>", "fleeting | literature | permanent | daily | meeting | decision | reference")
		.option("--status <s>", "draft | active | stable | archived")
		.option("-g, --grep <termo>", "o termo no nome, no título ou no corpo, sem caixa")
		.option("--json", "a lista inteira, pro jq")
		.option("--jsonl", "uma nota por linha")
		.option("--tsv", "uma nota por linha, pro awk");
}

/** Body reading stays in the caller so the package stays testable without disk. */
const body = (file: string): string => {
	try {
		return readFileSync(file, "utf8");
	} catch {
		return "";
	}
};

export async function main(argv: string[]): Promise<number> {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (err) {
		return (err as { exitCode?: number }).exitCode ?? 1;
	}
	const o = cmd.opts();
	const todas = notes();
	const rows = filter(todas, o, body);

	const fmt = fmtOf(argv);
	if (fmt !== "human") {
		out(
			fmt,
			rows,
			(n) => [n.id, n.type, n.status, n.tags.join(","), n.title ?? n.name, n.file],
			(n) => `${n.id}\t${n.title ?? n.name}`,
		);
		return 0;
	}

	if (!rows.length) {
		// Name the filter, or an empty result reads as an empty folder.
		const usado = [o.tag?.length && `tag ${o.tag.join("+")}`, o.type && `type ${o.type}`, o.status && `status ${o.status}`, o.grep && `"${o.grep}"`]
			.filter(Boolean)
			.join(" · ");
		console.log(usado ? `nenhuma nota com ${usado}` : "nenhuma nota em 03_resources/notes/");
		return 0;
	}

	for (const n of rows) console.log(`${(n.id ?? "—").padEnd(18)} ${(n.tags.join(",") || "—").padEnd(22)} ${n.title ?? n.name}`);
	console.log(`\n${rows.length} de ${todas.length}`);
	return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
