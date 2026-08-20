#!/usr/bin/env bun
//! A armadilha conhecida com o conserto conhecido — a que custou uma noite uma vez.
//!
//!   my resources hacker gotchas
//!   my resources hacker gotchas commander      só as que falam disso
//!
//! POR TERMO, e não por pasta: esta casa não tem `gotchas/` e nunca teve. Uma armadilha
//! com conserto é um PARÁGRAFO dentro de uma página sobre outra coisa — o `-h` que o
//! commander de fora responde primeiro, o `ME_DB` congelado que apagou a barra lateral.
//! Inventar a pasta pra deixar a forma uniforme seria inventar o dado.
//!
//! O vocabulário que marca uma está em `LENSES.hacker.asks.gotchas`, e é config, não
//! decoração: mudar o que conta como armadilha é editar uma linha.
//!
//! depends_on: src/resources/store.ts · src/interfaces/resources.ts

import { printNames, store } from "../store.ts";

export function main(argv: string[]): number {
	return printNames(store.hacker.gotchas(argv.find((a) => !a.startsWith("-"))));
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
