#!/usr/bin/env bun
//! The day: read today, read a date, or list the days with their subjects.
//!
//!     my daily_notes
//!     my daily_notes 2026-08-21
//!     my daily_notes --list
//!     my daily_notes --tag todo

import { readFileSync } from "node:fs";
import { Command } from "commander";

import { dayFile, days, hasDay, today } from "@biliboss/my-notes";
import { fmtOf, out } from "../shared/gh.ts";

/** The `##` headings of a day, in the order they happened. */
export function subjects(file: string): string[] {
	try {
		return readFileSync(file, "utf8")
			.split("\n")
			.filter((l) => l.startsWith("## "))
			.map((l) => l.slice(3).trim());
	} catch {
		return [];
	}
}

export function command(): Command {
	return new Command("daily_notes")
		.description("O dia: lê o de hoje, o de uma data, ou lista os que existem.")
		.argument("[data]", "YYYY-MM-DD. Omitida, hoje")
		.option("--list", "os dias que existem, com os assuntos de cada um")
		.option("--tag <t...>", "só os dias que carregam TODOS estes labels")
		.option("--json", "pro jq")
		.option("--jsonl", "um dia por linha")
		.option("--tsv", "um dia por linha, pro awk");
}

export async function main(argv: string[]): Promise<number> {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (err) {
		return (err as { exitCode?: number }).exitCode ?? 1;
	}
	const [data] = cmd.args;
	const o = cmd.opts();

	if (o.list || o.tag?.length) {
		let rows = days();
		if (o.tag?.length) rows = rows.filter((d) => o.tag.every((t: string) => d.tags.includes(t)));

		const fmt = fmtOf(argv);
		if (fmt !== "human") {
			out(fmt, rows, (d) => [d.name, d.tags.join(","), subjects(d.file).length, d.file], (d) => `${d.name}\t${subjects(d.file).length}`);
			return 0;
		}
		if (!rows.length) {
			console.log(o.tag?.length ? `nenhum dia com tag ${o.tag.join("+")}` : "nenhum dia em 00_daily_notes/");
			return 0;
		}
		for (const d of rows) {
			console.log(`${d.name}${d.tags.length ? `  [${d.tags.join(",")}]` : ""}`);
			for (const s of subjects(d.file)) console.log(`    ${s}`);
		}
		console.log(`\n${rows.length} dia(s)`);
		return 0;
	}

	const date = data ?? today();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		console.error(`data inválida: "${date}" — a forma é YYYY-MM-DD`);
		return 2;
	}
	if (!hasDay(date)) {
		// Reading never creates the file.
		console.error(`${date} não tem arquivo — abra com: my daily_notes add "<assunto>" "<texto>"`);
		return 1;
	}
	console.log(readFileSync(dayFile(date), "utf8"));
	return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
