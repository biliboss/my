#!/usr/bin/env bun
//! Alguma pasta de prosa não tem `CONTEXT.md`?
//!
//!   my check maps
//!   my check maps --json
//!
//!   --json → { sem_mapa:int · findings:[…] }
//!            catraca: maps.sem_mapa = sem_mapa, o int — não findings.length
//!
//! @CLAUDE.md põe a explicação de uma pasta no `CONTEXT.md` dela, então pasta sem um
//! é pasta que ninguém explica — às vezes certo, muitas vezes lacuna. Hoje são 10
//! RAÍZES de projeto sem mapa, todas nascidas antes do `my projects new`.
//!
//! NÃO se confunde com @src/check/context.ts: aquele prova que um mapa continua MAPA
//! (no máximo 100 linhas) e nunca pergunta se ele existe. Duas perguntas, dois
//! arquivos — se fossem uma, o número de um esconderia o do outro.
//!
//! depends_on: CONTEXT.md · src/shared/markdown.ts · src/shared/findings.ts
//! impacts:    src/check/ratchet.ts

import { relative } from "node:path";
import { emit } from "@my/shared/findings";
import { ROOT } from "../shared/markdown.ts";

/** REGISTRO é isento, e a isenção é a razão de o número ser usável: `output`,
 *  `_runs`, `_events` e o `archive/` de uma inbox têm uma pasta por execução —
 *  centenas — e mapa de registro é registro de registro. */
const RECORDS = /(?:^|\/)(?:_events|_runs|_agent_runs|_step_runs|output|runs_mock|node_modules|\.bookmarks)\//;

/** O `archive/` de uma inbox é registro pelo mesmo motivo, e vale pra qualquer
 *  inbox — a da casa e a de um projeto (@01_projects/inbox-v1/CONTEXT.md). */
const INBOX_ARCHIVE = /(?:^|\/)(?:00_)?inbox\/archive\//;

/** NÃO-PROSA: build config, asset estático, SQL gerado, arquivo subido. Pedir a
 *  `static/` ou `icons/` que se explique é como um achado de 150 vira lista que
 *  ninguém lê até o fim. */
// `.github/` e `ci/` entraram depois de a catraca reprovar o commit que os CRIOU:
// pasta de workflow guarda YAML e `ci/` guarda um JSON derivado, e nenhuma das duas
// tem prosa pra explicar. O portão pegando o próprio autor é o sinal de que ele
// funciona — a resposta certa era a isenção, não baixar o teto.
// A isenção vale pra pasta E pra tudo abaixo dela, em QUALQUER nível — por isso o
// `\/` no fim e o teste contra `${d}/`, e não o `$` que estava aqui. Com `$` ela
// casava só quando o caminho ACABAVA no nome: `webapp/build` saía, e as 12 pastas de
// `webapp/build/server/chunks/...` entravam como se fossem prosa não explicada.
// Medido 19/08: 24 dos 119 achados eram artefato de build, 20% de ruído numa lista
// que só serve se der pra ler até o fim.
export const NOT_PROSE = /(?:^|\/)(?:\.vscode|\.svelte-kit|\.github|ci|static|assets|icons|drizzle|attachments|dist|build|out)\//;

/** CÓDIGO se explica no código. Tudo em `src/` — `src/lib/`, `src/routes/`,
 *  `src-tauri/src/` — fica fora: a doc durável ali é o header `//!` do módulo, ao
 *  lado da coisa, e um `CONTEXT.md` por pasta de fonte é a segunda fonte que
 *  apodrece primeiro. Os `CONTEXT.md` que JÁ moram em `src/` (`src/cli/`,
 *  `src/workflows/`) continuam funcionando — só não entram na conta. */
const CODE_TREE = /(?:^|\/)(?:src|src-tauri)(?:\/|$)/;

export function mapas(): { dirs: string[]; sem: string[] } {
	const ls = Bun.spawnSync(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT });
	if (ls.exitCode !== 0) throw new Error(`git ls-files falhou (exit ${ls.exitCode})`);
	const files = ls.stdout.toString().split("\0").filter(Boolean);
	const dirs = [
		...new Set(
			files
				.filter((f) => f.includes("/"))
				.map((f) => f.slice(0, f.lastIndexOf("/")))
				.filter((d) => !RECORDS.test(`${d}/`) && !NOT_PROSE.test(`${d}/`) && !CODE_TREE.test(d) && !INBOX_ARCHIVE.test(`${d}/`)),
		),
	].sort();
	// O mapa de uma skill é o `SKILL.md` dela — aquele arquivo É a declaração da
	// pasta, e exigir um segundo ao lado é pedir o mesmo mapa duas vezes.
	const comMapa = new Set(
		files.filter((f) => f.endsWith("/CONTEXT.md") || f.endsWith("/SKILL.md")).map((f) => f.slice(0, f.lastIndexOf("/"))),
	);
	return { dirs, sem: dirs.filter((d) => !comMapa.has(d)) };
}


export function tabela(cap = 40): { md: string; sem: string[] } {
	const { dirs, sem } = mapas();
	const porTopo = [...new Set(dirs.map((d) => d.split("/")[0]!))]
		.map((topo) => {
			const meus = dirs.filter((d) => d.split("/")[0] === topo);
			return { topo, n: meus.length, sem: meus.filter((d) => sem.includes(d)).length };
		})
		.sort((a, b) => b.sem - a.sem || b.n - a.n);
	return {
		sem,
		md: [
			"## CONTEXT.md",
			"",
			"Pasta sem `CONTEXT.md` é pasta que ninguém explica. Quatro isenções, e cada uma tira ruído em vez de esconder achado: **código** (`src/`, `src-tauri/`) se explica no header `//!`; **registro** (`output/`, `_runs/`, `_events/`, `inbox/archive/`, `.bookmarks/`) é uma pasta por execução; **não-prosa** (`static/`, `assets/`, `icons/`, `.vscode/`, `.github/`, `ci/`, `drizzle/`, `dist/`, `build/`, `out/`) nunca teve o que explicar; e pasta com `SKILL.md` já É declarada.",
			"",
			"| pasta | subpastas | com mapa | sem mapa |",
			"|---|---|---|---|",
			...porTopo.map((b) => `| \`${b.topo}\` | ${b.n} | ${b.n - b.sem} | ${b.sem} |`),
			`| **total** | **${dirs.length}** | **${dirs.length - sem.length}** | **${sem.length}** |`,
			"",
			`### Sem \`CONTEXT.md\`${sem.length > cap ? ` (as ${cap} primeiras de ${sem.length})` : ""}`,
			"",
			sem.length === 0 ? "Nenhuma — toda pasta tem mapa." : sem.slice(0, cap).map((d) => `- \`${d}/\``).join("\n"),
		].join("\n"),
	};
}

export function main(argv: string[]): number {
	const { md, sem } = tabela();
	return emit(argv, {
		json: { sem_mapa: sem.length },
		findings: sem,
		cols: (d) => [d],
		// As duas primeiras linhas do `md` são o título da seção, que só serve pro
		// `ci/report.md` — no terminal ele já está sob o nome do check.
		human: () => console.log(md.split("\n").slice(2).join("\n")),
	});
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
