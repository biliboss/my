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
//!     my chat listen plantao-coding qa-workflow                 # fica na tela
//!     my chat listen plantao-coding qa-workflow --debounce 500 --max-wait 5000
//!
//! depends_on: src/chat/store.ts · src/chat/inbox.ts
//! impacts:    src/agents/chat.ts

import type { Batch, ChatSystem } from "@biliboss/interfaces/chat.ts";
import { allMessages, getCursor, setCursor, type Msg } from "./store.ts";

const POLL_MS = 200;
const DEFAULT_DEBOUNCE = 2000;
const DEFAULT_MAX_WAIT = 15000;

export function listen(
	channel: ChatSystem.ValueObjects.ChannelName,
	me: ChatSystem.ValueObjects.Addressee,
	on: (batch: Batch) => void,
	opts?: { debounce?: ChatSystem.ValueObjects.DebounceTime; max_wait?: ChatSystem.ValueObjects.DebounceTime },
): { stop(): void } {
	const debounceMs = opts?.debounce ?? DEFAULT_DEBOUNCE;
	const maxWaitMs = opts?.max_wait ?? DEFAULT_MAX_WAIT;
	const addressedToMe = (m: Msg) => m.channel === channel && (m.to === me || m.to === "all");

	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let firstPendingAt: number | null = null;
	let lastActivityAt = 0;
	let lastMaxSeqSeen = 0;

	// LÊ O PENDENTE DO DISCO A CADA BATIDA, nunca "o que apareceu desde a última
	// olhada": um lote que já estava esperando quando `listen` começou (o agente
	// caiu e voltou com mensagens no cursor) tem que entrar no primeiro debounce
	// igual a um lote que chegou depois — comparar CONTAGEM total erraria esse
	// caso, porque a contagem já nasceria "vista".
	const tick = async () => {
		if (stopped) return;
		const cursor = getCursor(channel, me);
		const pending = allMessages().filter((m) => m.seq > cursor && addressedToMe(m));
		if (pending.length) {
			const maxSeq = pending[pending.length - 1]!.seq;
			if (maxSeq !== lastMaxSeqSeen) {
				lastMaxSeqSeen = maxSeq;
				lastActivityAt = Date.now();
				if (firstPendingAt === null) firstPendingAt = lastActivityAt;
			}
		} else {
			firstPendingAt = null;
			lastMaxSeqSeen = 0;
		}
		if (firstPendingAt !== null) {
			const t = Date.now();
			const quiet = t - lastActivityAt;
			const waited = t - firstPendingAt;
			if (quiet >= debounceMs || waited >= maxWaitMs) {
				const batch: Batch = { channel, from: cursor, to: pending[pending.length - 1]!.seq, messages: pending };
				firstPendingAt = null;
				lastMaxSeqSeen = 0;
				try {
					await on(batch);
					// SÓ AQUI o cursor avança — handler que retorna é a única prova de
					// que o lote foi tratado.
					setCursor(channel, me, batch.to);
				} catch (err) {
					// Cursor NÃO avançou: a próxima batida ainda vê estas mensagens (mais
					// o que chegou nesse meio-tempo) como pendentes, e reprocessa.
					console.error(`chat.listen: handler falhou, lote #${batch.from}..#${batch.to} NÃO consumido — ${(err as Error).message}`);
				}
			}
		}
		if (!stopped) timer = setTimeout(tick, POLL_MS);
	};
	timer = setTimeout(tick, POLL_MS);
	return {
		stop() {
			stopped = true;
			if (timer) clearTimeout(timer);
		},
	};
}

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
	const handle = listen(
		channel,
		me,
		(batch) => {
			for (const m of batch.messages) console.log(`#${m.seq}  ${m.at.slice(11, 19)}  \x1b[1m${m.from}\x1b[0m → ${m.to}\n  ${m.text}`);
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
