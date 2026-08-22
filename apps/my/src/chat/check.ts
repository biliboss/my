#!/usr/bin/env bun
//! O que está torto no `chat` — `House.check()` acha isto POR FORMA
//! (@src/shared/house.ts), então nenhum registro é preciso.
//!
//! DUAS PERGUNTAS do próprio `View.check()` (@packages/interfaces/chat.ts:110):
//! nenhuma mensagem sem `from`, e nenhum `answers` apontando pra um `seq` que
//! não existe. E QUATRO de presença — o que `today bus check`/`crew blocked`
//! cobriam com um socket, remapeadas pro que sobrevive num arquivo:
//!
//!   NO NAME       um `member` do canal (@store.ts `registerChannel`) é string
//!                 vazia — o slot existe, o nome não. Era "SEM NOME" (conexão
//!                 sem `--as`): lá era anônimo por não se anunciar, aqui é
//!                 anônimo por nunca ter sido escrito.
//!   NO SUBSCRIBER o canal JÁ TEM mensagem e NENHUM candidato a leitor —
//!                 membro declarado ou qualquer `from`/`to` já visto nele — tem
//!                 cursor > 0. Era "SEM ASSINANTE", e é o achado que vale mais:
//!                 um canal que ninguém lê enche em silêncio e parece quieto.
//!   NO READER     um membro declarado nunca avançou cursor NESTE canal nem em
//!                 NENHUM outro — inativo no sistema inteiro. Era "SEM
//!                 LISTENER" (agente esperado que não tinha conexão nenhuma).
//!   SUBSCRIPTION  um membro declarado não leu ESTE canal mas leu outro — está
//!                 no sistema, só não onde deveria. Era "ASSINATURA" (conectado
//!                 com o canal errado).
//!
//! POR QUE ISTO NÃO CHAMA `who.ts`: `who()` puxa a frota viva (`agents/list.ts`
//! → herdr), e herdr é assíncrono até na raiz — `herdr/agents/list.ts` tem
//! `await` de topo dentro do próprio `if (import.meta.main)`, e Bun marca
//! ASSÍNCRONO qualquer módulo com isso, e QUALQUER módulo que o importe
//! ESTATICAMENTE, em cadeia (MEDIDO: `require()` de `agents/list.ts` isolado
//! já falha com "require() async module … is unsupported", mesmo ele guardando
//! o próprio `main` com `.then()` — a árvore embaixo dele é quem contamina).
//! `View.check()` é síncrono no contrato, e `house.ts` descobre `check()` com
//! `require()` síncrono — o mesmo buraco que `agents/check.ts` já documentou e
//! evitou lendo o roster do disco direto em vez de importar `roster()`. Este
//! arquivo evita o buraco inteiro: as quatro presenças acima só usam
//! `store.ts`, que é 100% síncrono.
//!
//!     my chat check
//!
//! depends_on: src/chat/store.ts
//!
//! O domínio mora em `@my/chat`; aqui fica só o que a CLI imprime.

import * as chat from "@my/chat";
const { say, ask, read, inbox, unanswered, seen, listen, check, allMessages, listChannels, registerChannel, show, busPath, now, whoAmI } = chat as any;

export function main(argv: string[]): number {
	const achados = check();
	for (const a of achados) console.log(`${a.path}\t${a.says}`);
	if (!argv.includes("--json") && achados.length === 0) console.log("chat: nada torto");
	return achados.length ? 1 : 0;
}

if (import.meta.main) process.exitCode = main(Bun.argv.slice(2));

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
