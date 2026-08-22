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

import { allMessages, getCursor, listChannels } from "./store.ts";

export type Finding = { path: string; says: string };

export function check(): Finding[] {
	const all = allMessages();
	const seqs = new Set(all.map((m) => m.seq));
	const achados: Finding[] = [];
	for (const m of all) {
		const path = `.my_chat.tsv#${m.seq}`;
		if (!m.from) achados.push({ path, says: "mensagem sem `from`" });
		if (m.answers !== undefined && !seqs.has(m.answers)) {
			achados.push({ path, says: `\`answers\` aponta pro seq #${m.answers}, que não existe` });
		}
	}
	achados.push(...checkPresenca(all));
	return achados;
}

/** As quatro presenças — ver o header. Recebe `all` já lido pra não reparsear
 *  o TSV inteiro uma segunda vez dentro do mesmo `check()`. */
function checkPresenca(all: ReturnType<typeof allMessages>): Finding[] {
	const achados: Finding[] = [];
	const channels = listChannels();

	// CONTAGEM, não `seq` máximo: `seq` é endereço GLOBAL do arquivo inteiro
	// (@store.ts, "seq é endereço, nunca reusado" — não recomeça por canal), e
	// usar o maior `seq` de um canal como se fosse "quantas mensagens tem" conta
	// TAMBÉM as mensagens de todo canal escrito ANTES dele no arquivo. MEDIDO:
	// dois canais interleaved, `pm` com 2 mensagens cujo maior `seq` é 4 (por
	// causa de 2 mensagens de outro canal no meio) reportava "pm tem 4
	// mensage(ns)" — 21/08, achado pelo importador do T5 contra 569 linhas
	// reais, onde o canal `pm` tinha 32 e o achado dizia 569 (o `seq` da ÚLTIMA
	// linha do ARQUIVO). Um teste de canal único nunca pega isto — os dois
	// números coincidem quando só existe um canal.
	const countOf = new Map<string, number>();
	for (const m of all) countOf.set(m.channel, (countOf.get(m.channel) ?? 0) + 1);

	/** Já leu ALGUMA COISA em algum canal que não `except` — é o que distingue
	 *  "nunca tocou o sistema" (NO READER) de "está ativo, só não aqui"
	 *  (SUBSCRIPTION). */
	const leuEmOutroLugar = (who: string, except: string): boolean =>
		channels.some((c2) => c2.name !== except && getCursor(c2.name, who) > 0);

	for (const c of channels) {
		const count = countOf.get(c.name) ?? 0;
		if (count === 0) continue; // canal sem mensagem: nada pra estar atrasado

		const semNome = c.members.filter((m) => !m.trim()).length;
		if (semNome) {
			achados.push({
				path: `.my_chat_channels.tsv#${c.name}`,
				says: `NO NAME: ${semNome} membro(s) do canal sem nome`,
			});
		}

		const membros = c.members.map((m) => m.trim()).filter((m) => m && m !== "all");
		for (const quem of membros) {
			if (getCursor(c.name, quem) > 0) continue;
			if (leuEmOutroLugar(quem, c.name)) {
				achados.push({
					path: `.my_chat.tsv#${c.name}`,
					says: `SUBSCRIPTION: ${quem} é membro de ${c.name} mas só leu outro canal`,
				});
			} else {
				achados.push({
					path: `.my_chat.tsv#${c.name}`,
					says: `NO READER: ${quem} é membro de ${c.name} e nunca leu nada, em canal nenhum`,
				});
			}
		}

		// Candidato a leitor: membro declarado OU qualquer `from`/`to` já visto
		// neste canal — um canal sem membro declarado nenhum ainda pode ter
		// alguém lendo por fora, e isso não é "sem assinante".
		const doCanal = all.filter((m) => m.channel === c.name).flatMap((m) => [m.from, m.to]);
		const candidatos = new Set([...membros, ...doCanal.map((s) => s.trim())].filter((s) => s && s !== "all"));
		if ([...candidatos].every((quem) => getCursor(c.name, quem) === 0)) {
			achados.push({
				path: `.my_chat.tsv#${c.name}`,
				says: `NO SUBSCRIBER: ${c.name} tem ${count} mensage(ns) e ninguém leu nenhuma`,
			});
		}
	}
	return achados;
}

export function main(argv: string[]): number {
	const achados = check();
	for (const a of achados) console.log(`${a.path}\t${a.says}`);
	if (!argv.includes("--json") && achados.length === 0) console.log("chat: nada torto");
	return achados.length ? 1 : 0;
}

if (import.meta.main) process.exitCode = main(Bun.argv.slice(2));
