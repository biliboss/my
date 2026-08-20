#!/usr/bin/env bun
//! A lente HUSTLER inteira: quanto isto vale, e pra quem.
//!
//!   my resources hustler all
//!
//! `LENSES.hustler.roles` é uma lista VAZIA, e isso está escrito no contrato em vez de
//! calado: ninguém desta frota vende. A lacuna é um fato que alguém pode fechar, não um
//! silêncio que alguém redescobre.
//!
//! depends_on: src/resources/store.ts · src/interfaces/resources.ts

import { printNames, store } from "../store.ts";

export function main(_argv: string[]): number {
	return printNames(store.hustler.all());
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
