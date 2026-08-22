#!/usr/bin/env bun
//! Todos os checks desta casa, um atrás do outro.
//!
//!   my check all            # os 13, na ordem do disco
//!   my check all --json     # uma linha por check: nome, exit, ms
//!
//! OS CHECKS, e não os relatórios sobre eles: `ratchet.ts` é excluído do glob.
//! Ele respawna oito dos mesmos checks mais `bun test src/`, e medindo 19/08 ele
//! sozinho era 3505ms dos 4943ms daqui — 71% do gate era trabalho repetido. A
//! catraca é um passo próprio, e o CI já a chama assim.
//!
//! Era a receita `just check`, e ela morreu junto com o `justfile` — o verbo tinha
//! que existir em `my` ANTES da deleção, porque o CI é o único consumidor que não
//! pode ser avisado por mensagem.
//!
//! Cada check roda em processo próprio e o exit é OU-lógico: um check vermelho
//! reprova o conjunto, e os outros rodam mesmo assim. Parar no primeiro erro
//! esconderia os outros sete números do log do CI, que é justamente o que se vem
//! ler aqui.
//!
//! depends_on: src/check/ · src/check/reciprocal.ts · src/check/context.ts · src/check/untracked.ts · src/check/notes.ts · src/check/rules.ts · src/check/references.ts · src/check/citations.ts
//! impacts:    .github/workflows/check.yml

import { readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = import.meta.dir;

export function main(args: string[] = process.argv.slice(2)): number {
	const json = args.includes("--json");
	// `ratchet.ts` FICA DE FORA, e não por gosto: ele é um relatório SOBRE os
	// checks, não um check. Por dentro ele respawna oito deles (`--json`, o
	// `CATRACA` em @src/shared/house.ts) mais `bun test src/` inteiro, então tê-lo
	// aqui fazia citations/okf/resources/maps/projects/untracked/notes/gates
	// rodarem DUAS vezes por invocação. Medido 19/08: 3505ms dos 4943ms do `all`
	// eram só ele — 71%, contra 384ms do segundo mais caro.
	//
	// E o efeito pior não era o tempo: o `throw` de `medir()` quando um
	// filho sai > 1 fazia um check irmão quebrado reprovar o `all` DUAS vezes,
	// com duas mensagens diferentes pro mesmo defeito.
	//
	// Quem quer a catraca chama a catraca — o CI já faz isso no passo `catraca`
	// de `.github/workflows/check.yml`, logo depois deste verbo.
	const RELATORIOS = new Set(["all.ts", "ratchet.ts"]);
	const checks = readdirSync(DIR)
		.filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !RELATORIOS.has(f))
		.sort();

	let falhou = 0;
	for (const f of checks) {
		if (!json) console.log(`── ${f}`);
		const t0 = Date.now();
		// `inherit` e não `pipe`: o valor deste verbo é o LOG dos treze números, e
		// bufferizar pra reimprimir no fim troca a ordem de quem lê acompanhando.
		const r = Bun.spawnSync(["bun", "run", join(DIR, f)], { stdio: json ? ["ignore", "ignore", "ignore"] : ["inherit", "inherit", "inherit"] });
		const ms = Date.now() - t0;
		if (r.exitCode !== 0) falhou = 1;
		if (json) console.log(JSON.stringify({ check: f.replace(/\.ts$/, ""), exit: r.exitCode, ms }));
		else console.log(`   exit ${r.exitCode} · ${ms}ms\n`);
	}
	return falhou;
}

if (import.meta.main) process.exit(main());
