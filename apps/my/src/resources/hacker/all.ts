#!/usr/bin/env bun
//! A lente HACKER inteira: como se constrói, e por que quebrou.
//!
//!   my resources hacker all
//!
//! As três lentes são três LEITURAS de uma loja só, nunca três lojas. A mesma página é
//! lida por gente diferente fazendo pergunta diferente, e separar o DADO por audiência é
//! como a mesma regra acaba escrita três vezes e diverge duas.
//!
//! Que pastas esta lente lê é `LENSES.hacker.reads` — dado, não este parágrafo.
//!
//! depends_on: src/resources/store.ts · src/interfaces/resources.ts

import { printNames, store } from "../store.ts";

export function main(_argv: string[]): number {
	return printNames(store.hacker.all());
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
