#!/usr/bin/env bun
//! `my home paths` — as três raízes desta casa e POR QUE cada uma resolveu ali.
//!
//! A implementação subiu pra `@my/shared/paths` em 22/08: `chat`, `notes`
//! e `resources` todos precisam de `root()`, e uma cópia por pacote é a segunda
//! verdade que este arquivo passou dois meses evitando.
//!
//! depends_on: packages/shared/paths.ts

import { existsSync } from "node:fs";

import { resolve } from "@my/shared/paths";

export * from "@my/shared/paths";

export function main(argv: string[] = Bun.argv.slice(2)): number {
	const r = resolve();
	const one = argv.find((a) => !a.startsWith("--"));
	if (one) {
		const v = (r as unknown as Record<string, string>)[one];
		if (!v) return console.error(`raiz desconhecida: \`${one}\` — root · code · machine`), 1;
		console.log(v);
		return 0;
	}
	if (argv.includes("--json")) return console.log(JSON.stringify(r, null, 2)), 0;
	for (const k of ["root", "code", "machine"] as const) {
		const missing = existsSync(r[k]) ? "" : "  ← não existe";
		console.log(`${k.padEnd(8)} ${r[k].padEnd(34)} ${r.why[k]}${missing}`);
	}
	return 0;
}

if (import.meta.main) process.exit(main());
