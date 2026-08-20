#!/usr/bin/env bun
//! O que está torto num board: coluna acima do limite, label não declarada, duas
//! labels do mesmo grupo, histórico de card cuja task sumiu do disco.
//!
//!     my kanban check
//!     my kanban check --json | --jsonl | --tsv
//!
//! `check()` é a função que @src/shared/house.ts acha POR FORMA — nenhum registro.
//!
//! depends_on: src/kanban/model.ts · src/shared/findings.ts
//! impacts:    —

import { emit } from "../shared/findings.ts";
// NÃO reexporta `check`: @src/shared/house.ts varre TODO arquivo de `src/kanban/`
// que declare `export … check`, e um `export { check }` aqui faria a MESMA função
// de `model.ts` ser contada duas vezes — achado dobrado, sem achado novo nenhum.
import { check, type Finding } from "./model.ts";

export function main(argv: string[]): number {
	const achados = check();
	return emit<Finding>(argv, {
		findings: achados,
		cols: (f) => [f.path, f.says],
		human: () => {
			for (const f of achados) console.log(`${f.path}\n  ${f.says}`);
			console.log(achados.length ? `\n${achados.length} achado(s)` : "nada torto");
		},
	});
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
