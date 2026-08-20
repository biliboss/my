#!/usr/bin/env bun
//! Como esta casa embala e nomeia o que ela faz.
//!
//!   my resources hustler offers
//!
//! O Hacker prova que funciona; o Hipster decide como se sente; o Hustler prova que
//! alguém consegue ACHAR, entender e escolher. O que existe hoje é a metade do nome —
//! o funil que elimina colisão antes de alguém se apegar, e a régua que separa nome
//! bonito de marca encontrável. Preço e promessa ainda não têm página, e a lente mostra
//! isso ao devolver duas.
//!
//! depends_on: src/resources/store.ts · src/interfaces/resources.ts

import { printNames, store } from "../store.ts";

export function main(_argv: string[]): number {
	return printNames(store.hustler.offers());
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
