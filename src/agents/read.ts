#!/usr/bin/env bun
//! Apelido fino de `my chat inbox` + `my chat seen`. FICA — `my agents read
//! <agente>` está citado e usado pela frota AGORA (mesma razão de
//! `src/agents/send.ts`, @CLAUDE.md: a chamada antiga não pode quebrar).
//!
//! O CONTRATO NOVO (@src/interfaces/chat.ts:186) diz que `seen` nunca é efeito
//! de leitura — e é verdade pro SISTEMA. Mas o CALL SITE velho, `my agents read
//! <quem>`, sempre foi "leia o que chegou E marque como lido" numa chamada só: é
//! assim que a frota evita reprocessar a mesma mensagem a cada poll. Preservar a
//! chamada significa preservar ESSE efeito, então este arquivo COMPÕE os dois
//! verbos puros (`inbox` pra ler, `seen` pra marcar) na mesma ordem que o
//! `read.ts` velho fazia — a impureza mudou de andar, do sistema pro apelido, que
//! é exatamente onde @CLAUDE.md manda ela morar quando uma citação depende dela.
//!
//!     my agents read qa-workflow            # o que chegou, e marca como lido
//!     my agents read qa-workflow --wait     # BLOQUEIA até chegar algo
//!     my agents read --all                  # o barramento inteiro, pra humano
//!
//! Canal sempre `""` — ver `src/agents/send.ts`.
//!
//! depends_on: src/chat/inbox.ts · src/chat/seen.ts · src/chat/read.ts

import { inbox } from "../chat/inbox.ts";
import { read as readChannel } from "../chat/read.ts";
import { seen } from "../chat/seen.ts";
import type { Msg } from "../chat/store.ts";

const show = (m: Msg) => console.log(`${m.at}  ${m.from} → ${m.to}\n  ${m.text}`);

export async function main(argv: string[]): Promise<number> {
	if (argv.includes("--all")) {
		for (const m of readChannel("")) show(m);
		return 0;
	}
	const who = argv.find((a) => !a.startsWith("-"));
	if (!who) {
		console.error("usage: read <quem> [--wait] [--timeout <s>]   |   read --all");
		return 2;
	}
	const i = argv.indexOf("--timeout");
	const deadline = Date.now() + (i > -1 ? Number(argv[i + 1]) : 900) * 1000;

	for (;;) {
		const msgs = inbox("", who);
		if (msgs.length) {
			for (const m of msgs) show(m);
			seen("", who, msgs[msgs.length - 1]!.seq);
			return 0;
		}
		// Sem `--wait` a resposta é "nada agora", e ela é sucesso — mesma regra do
		// `read.ts` velho.
		if (!argv.includes("--wait") || Date.now() >= deadline) return 0;
		await Bun.sleep(3000);
	}
}

if (import.meta.main) process.exitCode = await main(Bun.argv.slice(2));
