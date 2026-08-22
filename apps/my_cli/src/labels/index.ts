#!/usr/bin/env bun
//! The labels in use, counted across zettels and days. Read-only by design: a
//! label exists because a note carries it.
//!
//!     my labels
//!     my labels todo
//!     my labels --tsv

import { Command } from "commander";

import { days, labels, notes } from "@biliboss/my-notes";
import { fmtOf, out } from "../shared/gh.ts";

export function command(): Command {
	return new Command("labels")
		.description("Os labels em uso: quantas notas e quantos dias carregam cada um.")
		.argument("[label]", "só este label — imprime o que o carrega")
		.option("--json", "pro jq")
		.option("--jsonl", "um label por linha")
		.option("--tsv", "um label por linha, pro awk");
}

export async function main(argv: string[]): Promise<number> {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (err) {
		return (err as { exitCode?: number }).exitCode ?? 1;
	}
	const [alvo] = cmd.args;
	const fmt = fmtOf(argv);

	if (alvo) {
		const carrega = [...notes(), ...days()].filter((n) => n.tags.includes(alvo));
		if (fmt !== "human") {
			out(fmt, carrega, (n) => [n.id ?? n.name, n.type, n.title ?? n.name, n.file], (n) => `${n.id ?? n.name}\t${n.title ?? n.name}`);
			return 0;
		}
		// A label nothing carries does not exist here.
		if (!carrega.length) {
			console.log(`nenhuma nota carrega "${alvo}" — os que existem: my labels`);
			return 0;
		}
		for (const n of carrega) console.log(`${(n.id ?? n.name).padEnd(18)} ${(n.type ?? "—").padEnd(12)} ${n.title ?? n.name}`);
		console.log(`\n${carrega.length} carregam "${alvo}"`);
		return 0;
	}

	const rows = labels();
	if (fmt !== "human") {
		out(fmt, rows, (l) => [l.label, l.count, l.notes, l.count - l.notes], (l) => `${l.label}\t${l.count}`);
		return 0;
	}
	if (!rows.length) {
		console.log("nenhum label em uso — nenhuma nota tem `tags:`");
		return 0;
	}
	console.log(`${"label".padEnd(22)} ${"total".padStart(5)} ${"notas".padStart(6)} ${"dias".padStart(5)}`);
	for (const l of rows) console.log(`${l.label.padEnd(22)} ${String(l.count).padStart(5)} ${String(l.notes).padStart(6)} ${String(l.count - l.notes).padStart(5)}`);
	console.log(`\n${rows.length} label(s)`);
	return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
