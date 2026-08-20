#!/usr/bin/env bun
//! O que foi PROMETIDO a um cliente, e onde está escrito.
//!
//!   my resources hustler promises
//!   my resources hustler promises acme
//!
//! É a única pergunta desta lente que custa dinheiro quando a resposta é "alguém
//! lembra". O que existe hoje é o contrato do acme — o que o gerador ASSUME sem
//! dizer, descoberto numa venda à vista que tropeçou em cláusula de compra financiada.
//!
//! depends_on: src/resources/store.ts · src/interfaces/resources.ts

import { printNames, store } from "../store.ts";

export function main(argv: string[]): number {
	return printNames(store.hustler.promises(argv.find((a) => !a.startsWith("-"))));
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
