#!/usr/bin/env bun
//! Append one `##` section to a day. Append-only: there is no edit.
//!
//!     my daily_notes add "the subject" "the text, verbatim"
//!     echo "long text" | my daily_notes add "the subject" -
//!     my daily_notes add "the subject" "text" --date 2026-08-21

import { Command } from "commander";

import { append, today } from "@biliboss/notes";

export function command(): Command {
	return new Command("add")
		.description("Uma seção `##` no dia — append-only, o arquivo nasce se não existir.")
		.argument("<assunto>", "o `##` da seção: o que se procura depois")
		.argument("[texto]", "o corpo. `-` lê o stdin, que é como texto verbatim entra")
		.option("--date <d>", "YYYY-MM-DD. Omitida, hoje");
}

export async function main(argv: string[]): Promise<number> {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (err) {
		return (err as { exitCode?: number }).exitCode ?? 1;
	}
	const [assunto, texto] = cmd.args;
	const o = cmd.opts();

	const corpo = texto === "-" ? await Bun.stdin.text() : (texto ?? "");
	if (!corpo.trim()) {
		// A heading with no body looks like a record and is not one.
		console.error("sem texto — passe o corpo, ou `-` pra ler do stdin");
		return 2;
	}

	const out = append(o.date ?? today(), assunto!, corpo);
	if (!out.ok) {
		console.error(out.error);
		return 1;
	}
	console.log(`${out.note.file}\t## ${assunto}`);
	return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
