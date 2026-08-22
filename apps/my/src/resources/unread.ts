#!/usr/bin/env bun
//! O que ninguém abriu — a lista de deleção de uma pasta que só cresce.
//!
//!   my resources unread                    ninguém abriu nos últimos 30 dias
//!   my resources unread 90                 nos últimos 90
//!   my resources unread 2026-07-01         desde a data
//!
//! Uma referência que ninguém lê não é rede de segurança: é resultado de busca que
//! desperdiça a tarde de alguém. É o mesmo argumento que `dead()` faz sobre verbo,
//! aplicado à coisa que é ainda mais fácil de acumular.
//!
//! ISTO SÓ É MEDIÇÃO PORQUE A LEITURA É REGISTRADA: `my resources read <nome>` abre um
//! span por NOME, e o sink é um JSONL em `~/.me/spans.jsonl` — em memória ele
//! responderia "ninguém leu nada" pra sempre, já que cada `my` é um processo novo.
//! Recurso lido por fora (um `Read` de agente, um editor aberto) não conta, e isso é
//! honesto: a pergunta é "esta casa serviu esta página", não "alguém olhou o disco".
//!
//! `first_seen` é o mtime do arquivo — o único carimbo que o disco realmente tem.
//!
//! depends_on: src/resources/store.ts · src/shared/telemetry.ts

import { store } from "./store.ts";

export function main(argv: string[]): number {
	const arg = argv.find((a) => !a.startsWith("-"));
	const dias = arg && /^\d+$/.test(arg) ? Number(arg) : arg ? undefined : 30;
	const since = dias === undefined ? new Date(arg!).toISOString() : new Date(Date.now() - dias * 864e5).toISOString();
	if (Number.isNaN(Date.parse(since))) return console.error(`data inválida: "${arg}" — use dias (30) ou ISO`), 1;

	const rows = store.unread(since);
	for (const u of rows) console.log(`${u.what.padEnd(34)} desde ${u.first_seen.slice(0, 10)}`);
	console.log(`\n${rows.length} de ${store.list().length} recurso(s) sem leitura desde ${since.slice(0, 10)}`);
	return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
