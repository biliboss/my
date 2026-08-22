#!/usr/bin/env bun
//! Apelido fino de `my chat say`. FICA — `my agents send <agente> "<texto>"`
//! está citado em `skills/my/SKILL.md`, `02_areas/00_workflows/03_agents/…` e
//! usado pela frota que roda AGORA; deletar quebraria todo mundo no mesmo
//! commit que criou o substituto (@CLAUDE.md: a chamada antiga não pode
//! quebrar). A LÓGICA morreu — `src/agents/bus.ts` sumiu, e o que sobra aqui é
//! tradução de argumento: sem canal, `send` fala sempre no canal `""`, o mesmo
//! vazio que `src/chat/store.ts` usa pra migrar o barramento velho (nunca um
//! nome inventado como `"fleet"`).
//!
//!     my agents send qa-workflow "afira a #179, mesmo contrato"
//!     echo "texto longo" | my agents send coding-workflow -
//!
//! depends_on: src/chat/say.ts
//!
//! O domínio mora em `@my/agents`; aqui fica só o que a CLI imprime.

import { Command } from "commander";

import { agents } from "@my/agents";

export async function main(argv: string[]): Promise<number> {
	const [to, ...rest] = argv;
	if (!to || rest.length === 0) {
		console.error('usage: send <para> "<texto>"   (use - para ler o texto do stdin)');
		return 2;
	}
	const text = rest[0] === "-" ? await Bun.stdin.text() : rest.join(" ");
	say("", to, text);
	console.log(`→ ${to}`);
	return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
