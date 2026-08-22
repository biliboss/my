#!/usr/bin/env bun
//! O que foi decidido — E o que foi recusado ao lado.
//!
//!   my resources hacker decisions
//!
//! A metade RECUSADA é a que nenhum código pode ser lido pra recuperar: o repo mostra o
//! que ficou, nunca o que se considerou e caiu. Por isso ela é pergunta de primeira
//! classe e não uma busca que alguém lembra de fazer.
//!
//! Por termo, mesma razão do `gotchas` ao lado: decisão mora dentro da página do assunto
//! que ela decidiu, e uma pasta `decisions/` seria a pasta que ninguém alimenta.
//!
//! depends_on: src/resources/store.ts · src/interfaces/resources.ts

import { printNames, store } from "../store.ts";

export function main(_argv: string[]): number {
	return printNames(store.hacker.decisions());
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
