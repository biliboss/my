#!/usr/bin/env bun
//! A sprint troca de ESTADO, e estado é a PASTA em que ela está.
//!
//!   my sprints move 999 inprogress      # começou a rodar
//!   my sprints move 999 done            # acabou
//!   my sprints move 999 aberta          # volta pra raiz
//!   my sprints move 999 done -n         # o plano, sem mover
//!
//! `sprints/999_x/` está aberta · `sprints/inprogress/999_x/` está rodando ·
//! `sprints/done/999_x/` acabou. Pasta e não campo, pela mesma razão que fez a task
//! virar pasta: um `estado:` no front matter é a segunda fonte que ninguém atualiza,
//! e o `ls` mostra o campo velho pra quem acredita nele. Aqui
//! `ls sprints/inprogress` É a pergunta "o que está rodando agora", sem parser.
//!
//! O `done/` já existia por convenção — as duas sprints fechadas do
//! `biliboss_corretor` estão nele desde antes de qualquer verbo escrever ali. Este
//! arquivo só deu nome ao que a casa já fazia à mão, e acrescentou o estado do meio.
//!
//! ## `git mv`, e o NNN continua sendo endereço
//!
//! `git mv` porque a história tem que seguir a pasta: um `mv` cru faz o `git log`
//! da sprint parar no dia da mudança de estado, e o que se quer saber de uma sprint
//! fechada é exatamente o histórico dela.
//!
//! O número NÃO muda de estado pra estado. `999` em `done/` continua sendo `999`, e
//! é por isso que `my sprints new` conta olhando TODAS as pastas — reusar
//! o número de uma sprint arquivada faria duas atenderem pela mesma citação.
//!
//! depends_on: src/sprints/model.ts
//! impacts:    src/sprints/list.ts · src/check/projects.ts

import { existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { lembra, projetoCorrente } from "../tasks/model.ts";
import { ESTADOS, type Estado, acharSprint, sprintsDir } from "./model.ts";

export function command(): Command {
	return new Command("move")
		.description("a sprint troca de estado — e estado é a pasta em que ela está")
		.argument("<sprint>", "`999` ou `999_<slug>`")
		.argument("<estado>", `um de: ${ESTADOS.join(" · ")}`)
		.option("-P, --project <slug>", "o projeto. Omitido, vem do cwd ou do último usado")
		.option("-n, --dry-run", "imprime o plano e não move nada");
}

export function main(argv: string[]): number {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (e) {
		return (e as { exitCode?: number }).exitCode ?? 1;
	}
	const [alvo, estado] = cmd.args as [string, string];
	const { project, dryRun } = cmd.opts();
	const morre = (m: string) => (console.error(m), 1);

	if (!ESTADOS.includes(estado as Estado)) return morre(`estado inválido: ${estado}\n  existem: ${ESTADOS.join(", ")}`);
	// A mesma resolução do `list` e do `new`: `-P` uma vez fica LEMBRADO. Reimplementar
	// aqui faria o `move` discordar dos irmãos sobre qual é o projeto corrente.
	const { slug } = projetoCorrente(project);
	if (!slug) return morre("sem projeto corrente: passe `-P <slug>` uma vez e ele fica lembrado");
	if (project) lembra(slug);

	const s = acharSprint(slug, alvo);
	if ("erro" in s) return morre(s.erro);
	if (s.estado === estado) return morre(`${s.pasta} já está em \`${estado}\` — nada a fazer`);

	const raiz = sprintsDir(slug);
	const destino = estado === "aberta" ? join(raiz, s.pasta) : join(raiz, estado, s.pasta);
	// Antes de mover, e não no meio: destino ocupado com o mesmo NNN significa duas
	// sprints com o mesmo endereço, e sobrescrever apagaria o registro de uma delas.
	if (existsSync(destino)) return morre(`já existe: ${destino.replace(`${raiz}/`, "")}`);

	console.log(`${s.pasta}: ${s.estado} → ${estado}`);
	console.log(`  ${s.tasks.length} task(s) vão junto`);
	if (dryRun) {
		console.log("\nplano só. Sem `-n`, move.");
		return 0;
	}

	if (estado !== "aberta") mkdirSync(join(raiz, estado), { recursive: true });
	// `git mv` pra história seguir a pasta; `renameSync` é o fallback pra sprint que
	// ainda não foi commitada, onde o git recusa por não conhecer o caminho.
	const mv = Bun.spawnSync(["git", "mv", s.dir, destino], { cwd: join(raiz, "../../..") });
	if (mv.exitCode !== 0) {
		renameSync(s.dir, destino);
		console.log("  (movida com `mv`: o git ainda não conhecia esta pasta)");
	}
	console.log(`\n${destino.slice(destino.indexOf("01_projects"))}`);
	if (estado === "inprogress") console.log("  ao fechar: my sprints move " + s.nnn + " done");
	return 0;
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
