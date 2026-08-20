#!/usr/bin/env bun
//! O que construir e pra quem — o problema, o usuário, e o escopo que foi CORTADO.
//!
//!   my resources hipster product
//!
//! A metade cortada é a que ninguém escreve e todo mundo re-propõe.
//!
//! Hoje o que esta casa tem de produto é o cockpit — o lugar por onde ela MOSTRA coisa.
//! É pouco, e é o número honesto: a lente lista o que existe, não o que devia existir.
//!
//! depends_on: src/resources/store.ts · src/interfaces/resources.ts

import { printNames, store } from "../store.ts";

export function main(_argv: string[]): number {
	return printNames(store.hipster.product());
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
