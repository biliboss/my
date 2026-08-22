#!/usr/bin/env bun
//! As páginas pedidas, inteiras, N de uma vez — e cada leitura fica registrada.
//!
//!   my resources read git_worktree gh_pull_request
//!   my resources read interview            o ALIAS resolve na mesma
//!   my resources read --paths askuser      onde ela mora
//!
//! N DE UMA VEZ É O PONTO: ler um por chamada é como um agente gasta uma janela de
//! contexto em índice. Quem vai cortar worktree, commitar e abrir PR pede os três numa
//! chamada e recebe os três inteiros.
//!
//! O nome basta, sem caminho: ele é único na casa, e é essa regra que deixa um workflow
//! citar a página do outro. Repetido não é sorteio — derruba com os dois caminhos.
//!
//! Verbatim, nunca resumo. E UM SPAN POR NOME: é o que faz `my resources unread` medir
//! em vez de opinar.
//!
//! depends_on: src/resources/store.ts

import { relative } from "node:path";
import { ROOT, naoAchou, print, store } from "./store.ts";

export function main(argv: string[]): number {
	const paths = argv.includes("--paths") || argv.includes("-p");
	const names = argv.filter((a) => !a.startsWith("-"));
	if (!names.length) return console.error("uso: my resources read <nome>...  (`my resources` lista o que existe)"), 1;
	try {
		const found = store.read(names);
		if (paths) for (const r of found) console.log(relative(ROOT, r.path));
		else print(found);
		return 0;
	} catch (e) {
		return naoAchou(e);
	}
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
