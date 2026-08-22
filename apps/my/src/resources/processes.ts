#!/usr/bin/env bun
//! Os processos: as fases, os portões, o que se decide em cada um.
//!
//!   my resources processes
//!   my resources read 001_user_prompt        um deles, inteiro
//!
//! Um processo é uma PASTA — `02_areas/00_workflows/<domínio>/<NN>_<verbo>/` — e o
//! `CONTEXT.md` dela é o corpo. É o único lugar desta casa onde um `CONTEXT.md` É o
//! recurso em vez do mapa pra ele, e é o mesmo caminho que `src/meta.ts` já lia.
//!
//! O que um processo ENFORCE é coluna e portão; o que ele EXPLICA é prosa, e prosa é
//! conhecimento como o resto — por isso ele é um kind daqui e não um verbo à parte.
//!
//! depends_on: src/resources/store.ts · 02_areas/00_workflows/

import { printNames, store } from "./store.ts";

export function main(_argv: string[]): number {
	return printNames(store.processes());
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
