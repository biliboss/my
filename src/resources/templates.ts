#!/usr/bin/env bun
//! As formas que esta casa COPIA: landing, outline, call stack, os docs de um design.
//!
//!   my resources templates
//!   my resources read call_stack       a forma, inteira
//!
//! Desenhar um sistema é APLICAR um template, e o que ele produz é conhecimento como o
//! resto. Este verbo LÊ a forma; quem escreve os arquivos a partir dela é
//! `my system_design new` — ler e escrever são verbos diferentes.
//!
//! depends_on: src/resources/store.ts · 03_resources/templates/

import { printNames, store } from "./store.ts";

export function main(_argv: string[]): number {
	return printNames(store.templates());
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
