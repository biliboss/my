#!/usr/bin/env bun
//! Como esta casa ESCREVE: a voz, as palavras que ela recusa, a forma da frase.
//!
//!   my resources hipster voice
//!
//! Texto é design, e manter a voz na lente técnica é como um produto acaba soando como
//! changelog. Por isso ela é pergunta própria e não um arquivo perdido em `references/`.
//!
//! depends_on: src/resources/store.ts · src/interfaces/resources.ts

import { printNames, store } from "../store.ts";

export function main(_argv: string[]): number {
	return printNames(store.hipster.voice());
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
