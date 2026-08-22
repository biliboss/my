#!/usr/bin/env bun
//! O que está torto num board: coluna acima do limite, label não declarada, duas
//! labels do mesmo grupo, histórico de card cuja task sumiu do disco.
//!
//!     my kanban check
//!     my kanban check --json | --jsonl | --tsv
//!
//! NO BOARD DO GITHUB — Projects v2, e cada board custa 1 ponto:
//!
//!     my kanban check --remote                 todo board LINKADO   1 ponto por board
//!     my kanban check --remote <board>         só esse              1 ponto
//!     my kanban check --remote gh:24           idem, sem link       1 ponto
//!
//! POR QUE `--remote` É OPT-IN E NÃO O PADRÃO: `check()` (de `model.ts`) é a função
//! que @src/shared/house.ts acha POR FORMA e roda em todo `my check all`. Gastar
//! ponto do orçamento compartilhado ali seria exatamente o laço que zerou os 5000 em
//! 21/08 — a varredura da casa roda o dia inteiro. Então `check()` continua só disco,
//! e a rede só sai quando alguém pede.
//!
//! O que ele acha lá que não existe aqui: `HUMAN REVIEW` (a fila na frente do Gabriel,
//! que era o `today waiting`), `SUB-ISSUE` (aninhada no pai, invisível na coluna),
//! `NO STATUS` e `STATUS LOST` — este último é o rastro do `updateProjectV2Field`, que
//! recria as opções com ids novos e derruba a coluna de todo item em silêncio.
//!
//! `check()` é a função que @src/shared/house.ts acha POR FORMA — nenhum registro.
//!
//! depends_on: src/kanban/model.ts · src/kanban/remote.ts · src/shared/findings.ts
//! impacts:    —

import { emit } from "@my/shared/findings";
// NÃO reexporta `check`: @src/shared/house.ts varre TODO arquivo de `src/kanban/`
// que declare `export … check`, e um `export { check }` aqui faria a MESMA função
// de `model.ts` ser contada duas vezes — achado dobrado, sem achado novo nenhum.
import { check, type Finding, links, refOf, remoteFindings } from "./model.ts";
import { readBoard, refToString } from "./remote.ts";

/** Os boards remotos que este comando vai ler. Sem nome, TODO board linkado — e é o
 *  único lugar deste módulo que lê mais de um board numa chamada. É a mesma varredura
 *  que o `today boards list` fazia, uma vez por invocação humana: um ponto por board,
 *  nunca num timer. */
function alvos(nome?: string): { label: string; ref: ReturnType<typeof refOf> }[] {
	if (nome) return [{ label: nome, ref: refOf(nome, { remote: true }) }];
	return links().map((l) => ({ label: l.slug, ref: l.ref }));
}

export function main(argv: string[]): number {
	const achados: Finding[] = check();

	if (argv.includes("--remote")) {
		const nome = argv.filter((a) => !a.startsWith("--")).find((a) => a !== "--remote");
		const alvo = alvos(nome);
		if (!alvo.length)
			return console.error("nenhum board declara projeto do GitHub — my kanban add gh:<n> <board>, ou my kanban check --remote gh:<n>"), 1;
		for (const a of alvo) {
			if (!a.ref) {
				achados.push({ path: a.label, says: `--remote pedido, mas o board não declara projeto nenhum — my kanban add gh:<n> ${a.label}` });
				continue;
			}
			try {
				achados.push(...remoteFindings(readBoard(a.ref)));
			} catch (e) {
				// Falha de rede/orçamento é ACHADO, não crash: um check que morre no meio
				// deixa o resto do board sem resposta e parece "nada torto".
				achados.push({ path: refToString(a.ref), says: `não deu pra ler o board: ${(e as Error).message}` });
			}
		}
	}

	return emit<Finding>(argv, {
		findings: achados,
		cols: (f) => [f.path, f.says],
		human: () => {
			for (const f of achados) console.log(`${f.path}\n  ${f.says}`);
			console.log(achados.length ? `\n${achados.length} achado(s)` : "nada torto");
		},
	});
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
