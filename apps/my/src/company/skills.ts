#!/usr/bin/env bun
//! Generates one project-scope skill per company workflow, under
//! `.claude/skills/my_<name>/`.
//!
//!     my company skills            escreve o que faltar, apaga o que sobrou
//!     my company skills -n         imprime o que faria, sem escrever
//!     my company skills --check    sai 1 quando algo está desatualizado
//!     my company skills --list     os workflows achados, com o stream de cada um

import { Command } from "commander";

import { apply, check, plan, workflows } from "@my/company";
import { fmtOf, out } from "@my/shared/gh";

export function command(): Command {
	return new Command("skills")
		.description("Um skill de projeto por workflow da empresa, gerado do CONTEXT.md dele.")
		.option("-n, --dry-run", "imprime o que faria, sem escrever")
		.option("--check", "sai 1 quando algo está desatualizado")
		.option("--list", "os workflows achados, com stream e tese")
		.option("--json", "pro jq")
		.option("--jsonl", "um por linha")
		.option("--tsv", "um por linha, pro awk");
}

export async function main(argv: string[]): Promise<number> {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (err) {
		return (err as { exitCode?: number }).exitCode ?? 1;
	}
	const o = cmd.opts();
	const fmt = fmtOf(argv);

	if (o.list) {
		const rows = workflows();
		if (fmt !== "human") {
			out(fmt, rows, (w) => [w.name, w.stream, w.rel, w.thesis ?? ""], (w) => `${w.name}\t${w.stream}`);
			return 0;
		}
		for (const w of rows) console.log(`${w.name.padEnd(26)} ${w.stream.padEnd(24)} ${w.thesis ? "" : "SEM TESE"}`);
		console.log(`\n${rows.length} workflow(s)`);
		return 0;
	}

	if (o.check) {
		const found = check();
		if (fmt !== "human") {
			out(fmt, found, (f) => [f.skill, f.says], (f) => `${f.skill}\t${f.says}`);
			return found.length ? 1 : 0;
		}
		for (const f of found) console.log(`${f.skill.padEnd(30)} ${f.says}`);
		console.log(found.length ? `\n${found.length} achado(s)` : "as skills estão em dia com os workflows");
		return found.length ? 1 : 0;
	}

	const done = apply(Boolean(o.dryRun));
	for (const s of done.written) console.log(`${o.dryRun ? "escreveria" : "escrito"}  ${s}`);
	for (const s of done.removed) console.log(`${o.dryRun ? "apagaria" : "apagado"}   ${s}`);
	for (const g of done.gaps) console.log(`aviso     ${g.skill}: ${g.gap}`);
	console.log(
		`\n${done.written.length} escrito(s) · ${done.unchanged.length} em dia · ${done.removed.length} apagado(s) · ${done.gaps.length} aviso(s)` +
			(o.dryRun ? " — nada foi escrito" : ""),
	);
	// Warnings do not fail the run: they are about how GOOD the skill is, not
	// whether it exists. `--check` is what a gate reads.
	return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
