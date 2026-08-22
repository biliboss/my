#!/usr/bin/env bun
//! A CASA desta máquina: mostra qual é, ou escolhe outra.
//!
//!     my home                      o caminho, cru — pro `$(...)` de um script
//!     my home --why                com a evidência de quem decidiu cada raiz
//!     my home ~/src/me             passa a ser esta, e fica
//!     my home --clear              volta pro default
//!
//! UMA CASA POR VEZ, e é decisão, não limitação de implementação. Um CLI que aceita
//! N casas ao mesmo tempo precisa que TODO verbo receba qual — e aí `my tasks list`
//! ganha uma flag que 99% das chamadas repetem igual. A casa é ambiente, como o
//! diretório corrente é pro `git`.
//!
//! TRÊS CAMADAS, do mais volátil pro mais estável (@src/home/paths.ts):
//!
//!     MY_HOME=…        esta chamada     — o que um teste e um CI usam
//!     ~/.me/home       esta máquina     — o que este verbo escreve
//!     ~/src/me         sempre foi
//!
//! Env GANHA do arquivo de propósito: uma alavanca de sessão que perde pra uma de
//! disco é uma alavanca que não serve — seria impossível rodar um check contra uma
//! árvore descartável sem desconfigurar a máquina.
//!
//! SAI CRU POR PADRÃO porque a resposta mais comum é interpolação —
//! `cd "$(my home)"`. Cabeçalho e alinhamento são o que faz um comando ser
//! reparseado por quem chama; `--why` é pra gente.
//!
//! `--why` E NÃO `-v`: `has()` desta casa casa `--nome` e só, então `-v` seria uma
//! flag que o `--help` promete e o código nunca vê (medido escrevendo este arquivo).
//! E o nome diz o que sai: não é verbosidade, é a EVIDÊNCIA de quem decidiu.
//!
//! depends_on: src/home/paths.ts
//! impacts:    src/home/check.ts

import { existsSync, rmSync } from "node:fs";

import { has, value } from "@biliboss/shared/argv";
import { machine, resolve, root, setRoot, storedRoot } from "./paths.ts";

export function main(argv: string[] = Bun.argv.slice(2)): number {
	if (has("clear")) {
		rmSync(`${machine()}/home`, { force: true });
		console.log(`${root()}  (voltou pro default)`);
		return 0;
	}

	const alvo = argv.find((a) => !a.startsWith("-")) ?? value("set");
	if (alvo) {
		const out = setRoot(alvo);
		if ("erro" in out) return console.error(`✗ ${out.erro}`), 1;
		console.log(out.root);
		return 0;
	}

	if (!has("why")) {
		console.log(root());
		// Casa anotada que sumiu do disco: o caminho ainda é impresso, porque é o que
		// está configurado, e o aviso vai pro stderr pra não sujar um `$(my home)`.
		if (!existsSync(root())) console.error(`✗ não existe — \`my home <caminho>\` pra escolher outra`);
		return existsSync(root()) ? 0 : 1;
	}

	const r = resolve();
	console.log(`${r.root}\n  ${r.why.root}`);
	console.log(`\ncódigo   ${r.code}\n  ${r.why.code}`);
	console.log(`máquina  ${r.machine}\n  ${r.why.machine}`);
	if (!storedRoot()) console.log(`\nnenhuma casa anotada — \`my home <caminho>\` fixa uma nesta máquina`);
	return 0;
}

if (import.meta.main) process.exit(main());
