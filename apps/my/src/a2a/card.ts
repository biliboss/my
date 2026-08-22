#!/usr/bin/env bun
//! O CARTÃO DESTA CAIXA — `A2ASystemView.card` do contrato
//! (@packages/interfaces/a2a.ts). É o documento que responde "quem existe aqui e
//! onde atende", e é o que `my a2a serve` vai servir em
//! `/.well-known/agent-card.json`.
//!
//!     my a2a card                    # o cartão desta caixa
//!     my a2a card --agents           # os agentes do roster, um por linha
//!
//! POR QUE ISTO VEM ANTES DO ENDPOINT. A identidade de um agente hoje é
//! `rosterName ?? a.title` (@src/agents/list.ts:89), então um pane sem entrada no
//! roster é conhecido pelo TÍTULO DA ABA do herdr. Medido em 22/08: dois dos seis
//! "membros" do canal `viacorretor` eram títulos de janela — "Revisar mensagens
//! desde quinta" e "Split herdr and store ID". Título muda quando alguém renomeia
//! a aba; cartão não. Por isso `--agents` lê SÓ o roster, e nunca a frota viva.
//!
//! SAI EM JSON E SÓ. Os quatro formatos da casa existem pra lista que alguém vai
//! filtrar; o cartão não é lista nossa — é o ARTEFATO da spec A2A, com a forma
//! que a outra caixa espera. Imprimir alinhado seria oferecer um formato que
//! nenhum cliente lê.
//!
//! A CAIXA E A URL SÃO CONFIGURAÇÃO, nunca deduzidas. `MY_BOX` nomeia a máquina e
//! `MY_A2A_URL` diz onde ela atende; montar a URL a partir do nome da caixa é
//! como uma troca de porta vira erro calado. Os defaults servem a máquina local e
//! nada além dela.
//!
//! depends_on: packages/interfaces/a2a.ts · src/herdr/agents/roster.ts
//! impacts:    src/a2a/serve.ts (ainda não existe — sprint 002)

import { hostname } from "node:os";
import { Command } from "commander";

import type { A2ASystem } from "@my/interfaces/a2a.ts";

import { stored } from "@my/herdr/agents/roster";

/** A versão da spec que esta casa fala. Literal, e não lida de lugar nenhum: é
 *  uma AFIRMAÇÃO sobre o que implementamos, e ela só muda quando o código muda. */
const PROTOCOL_VERSION = "1.0";

/** Onde esta caixa atende. O default é loopback de propósito — uma caixa que
 *  ainda não decidiu como é alcançada de fora não deve anunciar que é. */
const url = (): A2ASystem.ValueObjects.Endpoint => process.env.MY_A2A_URL ?? "http://127.0.0.1:5399";

/** O nome da máquina. `hostname()` como queda porque é a única resposta que a
 *  máquina sabe dar sobre si mesma sem ninguém configurar. */
const box = (): A2ASystem.ValueObjects.BoxName => process.env.MY_BOX ?? hostname().replace(/\.local$/, "");

export function card(name?: string): A2ASystem.Entities.AgentCard {
	const b = box();
	return {
		name: name ?? b,
		box: b,
		url: url(),
		description: name ? `agente ${name} na caixa ${b}` : `a caixa ${b}`,
		protocolVersion: PROTOCOL_VERSION,
	};
}

/** UM CARTÃO POR NOME GUARDADO, e o arquivo é a única fonte. `stored()` e não
 *  `roster()`: a leitura reconciliada devolve `[]` com o herdr fechado e APAGA
 *  quem sumiu na passagem, e um cartão que só existe enquanto a frota está de pé
 *  não é identidade — é presença com outro nome. */
export function cards(): A2ASystem.Entities.AgentCard[] {
	return Object.keys(stored())
		.filter(Boolean)
		.sort()
		.map((name) => card(name));
}

export function command(): Command {
	return new Command("card")
		.description("O cartão desta caixa — o que `my a2a serve` publica.")
		.option("--agents", "um cartão por agente do roster, um por linha");
}

export async function main(argv: string[]): Promise<number> {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (err) {
		return (err as { exitCode?: number }).exitCode ?? 1;
	}
	if (cmd.opts().agents) {
		for (const c of cards()) console.log(JSON.stringify(c));
		return 0;
	}
	console.log(JSON.stringify(card(), null, 2));
	return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
