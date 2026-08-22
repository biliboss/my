#!/usr/bin/env bun
//! O verbo difícil — `Chat.listen` (@packages/interfaces/chat.ts). Absorve o
//! `--monitor` de `src/agents/chat.ts`, que fazia poll de 2s SEM debounce, SEM
//! `max_wait`, SEM lote, e sem endereçamento: acordava pra cada linha nova do
//! arquivo inteiro. Aqui as quatro faltas viram as quatro regras do contrato:
//!
//!   DEBOUNCE DE BORDA TRAILING — silêncio depois do tráfego, nunca no primeiro
//!   sinal: `N agentes escrevendo ao mesmo tempo é UM evento, não N`, e cada
//!   acordada é um turno de modelo com conta.
//!
//!   `max_wait` é TETO, não meta — um canal que nunca sossega (alguém digitando
//!   toda vez que o debounce ia fechar) ainda assim entrega, no mais tardar.
//!
//!   O CURSOR SÓ AVANÇA QUANDO O HANDLER RETORNA. Handler que estoura não perde
//!   o lote: a próxima batida ainda vê as mesmas mensagens (mais o que chegou
//!   depois) porque `seen()` não foi chamado.
//!
//! POLL, não `fs.watch`: esta casa já mede o preço do watcher que fica preso
//! (03_resources/notes/…hook-e-o-watcher-que-nao-se-escreve.md) e `fs.watch` em
//! macOS tem coalescing de eventos que o teste deste arquivo não teria como
//! confiar. `POLL_MS` é o granular — ponytail: fixo em 200ms, promove a opção se
//! algum chamador precisar de mais resolução do que isso.
//!
//! A CLI GANHA O PRINT EM LOTE DE `read.ts`: antes de ir pro ar, mostra o canal
//! inteiro (reusando `read()`/`show()` de lá) — quem entra no meio de uma
//! conversa vê o que já foi dito, não só o que chega dali pra frente.
//!
//!     my chat listen plantao-coding qa-workflow                 # fica na tela
//!     my chat listen plantao-coding qa-workflow --debounce 500 --max-wait 5000
//!
//! depends_on: src/chat/store.ts · src/chat/read.ts
//! impacts:    src/agents/chat.ts
//!
//! O domínio mora em `@my/chat`; aqui fica só o que a CLI imprime.

import * as chat from "@my/chat";
const { say, ask, read, inbox, unanswered, seen, listen, check, allMessages, listChannels, registerChannel, show, busPath, now, whoAmI } = chat as any;

export async function main(argv: string[]): Promise<number> {
	const [channel, me, ...rest] = argv;
	if (channel === undefined || !me) {
		console.error("usage: listen <canal> <eu> [--debounce <ms>] [--max-wait <ms>]");
		return 2;
	}
	const i = rest.indexOf("--debounce");
	const debounce = i > -1 ? Number(rest[i + 1]) : undefined;
	const j = rest.indexOf("--max-wait");
	const max_wait = j > -1 ? Number(rest[j + 1]) : undefined;

	console.log(`\x1b[2m— escutando ${channel || "(canal vazio)"} como ${me}; ctrl-c para sair —\x1b[0m`);
	for (const m of read(channel)) show(m);
	const handle = listen(
		channel,
		me,
		(batch) => {
			for (const m of batch.messages) show(m);
		},
		{ debounce, max_wait },
	);
	await new Promise<void>((resolve) => {
		process.once("SIGINT", () => {
			handle.stop();
			resolve();
		});
	});
	return 0;
}

if (import.meta.main) process.exitCode = await main(Bun.argv.slice(2));

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
