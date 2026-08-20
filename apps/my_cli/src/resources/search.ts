#!/usr/bin/env bun
//! Que páginas falam disto — o nome e o corpo, sem caixa.
//!
//!   my resources search worktree
//!   my resources search 'rocks?db'
//!
//! Sem índice e sem ranking: se um dia precisar dos dois, a resposta é um motor de
//! busca, não um índice à mão que apodrece. Quem quer CONTAGEM — "quanto deste assunto
//! já existe em casa?" — usa `my resources -g <termo>`, que conta ocorrência por página.
//!
//! Exit 1 quando nada casa, como o grep.
//!
//! depends_on: src/resources/store.ts

import { printNames, store } from "./store.ts";

export function main(argv: string[]): number {
	const termo = argv.find((a) => !a.startsWith("-"));
	if (!termo) return console.error("uso: my resources search <termo>"), 1;
	try {
		return printNames(store.search(termo));
	} catch (e) {
		return console.error(`regex inválida: ${(e as Error).message}`), 1;
	}
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
