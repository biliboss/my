#!/usr/bin/env bun
//! WRAPPER. A pergunta vai pro `askuser`, que é um projeto INDEPENDENTE.
//!
//!   my askuser ask "Disparo as 4 unidades?" \
//!     -o "faz|4 agentes · ~12 min de parede" -o "espera|primeiro decido a S5"
//!
//! ## Isto aqui não é o app
//!
//! O app mora em `~/src/askuser` (github.com/biliboss/askuser, público, MIT) e
//! não sabe que esta casa existe. O que este arquivo faz é UMA coisa: encaixar
//! o comando de lá na gramática daqui, e preencher a ORIGEM com o que o
//! ambiente desta casa sabe — o agente, o pane, o run.
//!
//! Se você está mexendo em COMO a pergunta funciona, o lugar é lá:
//! `~/src/askuser/CONTEXT.md`. Aqui só se mexe no encaixe.
//!
//! ## Por que existe
//!
//! Um agente da frota vive num pane que ninguém olha, e `AskUserQuestion` ali é
//! um agente travado em SILÊNCIO — de fora, esperar resposta é indistinguível de
//! trabalhar (@02_areas/00_workflows/03_agents/references/askuser.md). O
//! `askuser` leva a pergunta pra uma tela que a pessoa está olhando.
//!
//! ## As quatro saídas, e quem chama TEM que tratá-las
//!
//! `0` escolheu · `2` PULOU · `3` EXPIROU · `1` erro.
//!
//! Tratar 2 ou 3 como 0 é seguir com uma decisão que ninguém tomou. Depois de um
//! pulo ou de um vencimento, o caminho honesto é parar e registrar `pendente`.
//! E `1` é "não consegui perguntar", que é diferente de "ninguém respondeu".
//!
//! depends_on: ~/src/askuser/scripts/cli/askuser.ts
//! impacts:    02_areas/00_workflows/03_agents/references/askuser.md

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";

/** Onde o projeto independente está clonado. Env primeiro — nem toda máquina põe no mesmo lugar. */
const RAIZ = process.env.ASKUSER_HOME ?? join(homedir(), "src", "askuser");
const CLI = join(RAIZ, "scripts", "cli", "askuser.ts");

export function command(): Command {
	return new Command("ask")
		.description("uma pergunta vai pro app `askuser` e o comando espera a decisão")
		.allowUnknownOption()
		.helpOption(false)
		.argument("[args...]", "repassado inteiro pro `askuser` — veja `my askuser ask --help`");
}

export async function main(argv: string[]): Promise<number> {
	if (!existsSync(CLI))
		return (
			console.error(
				`askuser não está em ${RAIZ}\n` +
					`  git clone https://github.com/biliboss/askuser ${RAIZ}\n` +
					`  ou aponte com ASKUSER_HOME=<caminho>`,
			),
			1
		);

	// A ORIGEM é o que esta casa acrescenta, e não é enfeite: pergunta sem dono
	// é decisão tomada sobre um contexto que quem responde não reconstrói. O
	// `askuser` lê essas três do ambiente e mostra na tela.
	//
	// `??=` e não atribuição direta: quem chamou pode ter setado a origem à mão,
	// e sobrescrever seria a casa mentindo sobre quem perguntou.
	const env = { ...process.env };
	env.ASKUSER_AGENT ??= process.env.MY_AGENT ?? "";
	env.ASKUSER_RUN ??= process.env.MY_RUN ?? "";
	env.ASKUSER_PANE ??= process.env.HERDR_PANE_ID ?? "";

	// SÍNCRONO, e é o único lugar desta casa onde bloquear é o certo: "dispara e
	// monitora" vale pra trabalho, não pra pergunta feita a gente. Não há nada
	// pra fazer enquanto a decisão não vem.
	//
	// `stdio: inherit` no stdout deixa o JSON do `askuser` sair intacto pra quem
	// estiver parseando — reescrever aqui criaria uma segunda forma de saída.
	const r = Bun.spawnSync(["bun", CLI, ...argv], { env, stdout: "inherit", stderr: "inherit" });
	return r.exitCode ?? 1;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));
