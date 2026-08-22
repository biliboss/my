#!/usr/bin/env bun
//! A lente HIPSTER inteira: o que vale construir, e como deve se sentir.
//!
//!   my resources hipster all
//!
//! Produto E design na mesma lente, de propósito: separar os dois é como uma casa acaba
//! com uma coisa linda que ninguém pediu e uma coisa útil que ninguém suporta olhar.
//!
//! depends_on: src/resources/store.ts · src/interfaces/resources.ts

import { printNames, store } from "../store.ts";

export function main(_argv: string[]): number {
	return printNames(store.hipster.all());
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
