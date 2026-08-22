#!/usr/bin/env bun
//! Algum recurso de `03_resources/` não é citado por ninguém?
//!
//!   my check resources
//!   my check resources --json
//!
//!   --json → { orfaos:[path] · report:str }
//!            catraca: resources.orfaos = orfaos.LENGTH — `orfaos` é lista. ABSOLUTA (teto 0)
//!
//! Recurso órfão é documento que envelhece sem testemunha. Foi assim que
//! @03_resources/rules/retrieval/house_verbs.md ficou com TRÊS verbos mortos na
//! própria tabela (`just runs`, `just fleet`, `my vscode regen`) — nada apontava pra
//! ele, então ninguém o abriu pra ver.
//!
//! ## As cinco formas de citar, e três só apareceram por medição
//!
//! - **PATH**, casado nos dois últimos segmentos (`macos/001_notificacoes.md`) e não
//!   no caminho inteiro: metade das citações da casa é relativa, e match de caminho
//!   completo perde todas.
//! - **nome do arquivo PELADO, da MESMA pasta** — `[`x.md`](x.md)` no `CONTEXT.md`
//!   dela. Estar no mapa da própria pasta é estar alcançável, e sem isto a árvore
//!   inteira de `references/` lia como órfã.
//! - **VERBO** por nome (`my meta resources <nome>`, `my references <nome>`) — o que casa
//!   é o `resources <nome>`/`references <nome>` no fim, então o prefixo do runner não importa.
//! - **ÂNCORA** `#slug`: sem ela, 27 das 39 regras liam como órfãs enquanto
//!   `#commit_is_the_report` estava em `src/meta.ts` e em quatro outras regras.
//! - **`id:` de nota**: nota liga nota pelo timestamp IMUTÁVEL, nunca pelo nome do
//!   arquivo (@03_resources/notes/CONTEXT.md — o slug muda, o ID não). Sem esta,
//!   quatro notas já ligadas apareciam como órfãs.
//!
//! O que NÃO conta: a lista `nunca_buscado:` do `vocabulary.yaml`. Ela nomeia o que
//! ninguém BUSCOU, que é o contrário de citação — e corrobora este check, com
//! `house_verbs` nas duas listas.
//!
//! ## `meetings/` é ISENTO, e o porquê está medido
//!
//! Ata de reunião não é recurso que se cita: é fonte que se consome em LOTE. O
//! parecer da task 010 mediu o bucket inteiro — 39 atas, **zero** citadas — e
//! achou a causa: o caminho de consumo é ata → `asks.md`, escrito na própria ata
//! ("o que virou PEDIDO sai daqui pro `asks.md`"), e o que é citado é a PASTA
//! (`03_resources/meetings/CONTEXT.md`, apontado por `asks.md` e `caixa.md`), não
//! o arquivo. A ata ainda é imutável por regra, então a citação nunca pode nascer
//! dentro dela. Em 44 dias de atas (06/07 a 19/08) ninguém citou nenhuma, uma vez
//! sequer — e elas chegam a ~1,3 por dia, automáticas.
//!
//! A alternativa era um índice em `meetings/CONTEXT.md` listando as 39, e ela foi
//! RECUSADA: só valeria se a linha fosse escrita pela mesma varredura que cria a
//! ata, e `in_inbox_sweep` é PROSA que um agente segue, não um verbo onde caiba o
//! append. Índice à mão apodrece na ata 40 — e apodrece em silêncio, porque aí o
//! check acusa 1 órfão em vez de 39, e 1 no meio do relatório não chama ninguém.
//!
//! Entre um check que mente (39 órfãos permanentes viram o novo normal, e o 40º
//! achado de verdade chega invisível dentro do ruído) e um check que não olha, o
//! que não olha é honesto. O bucket **continua na tabela**, com a contagem e a
//! palavra `isento` na coluna: some do exit code, não some da vista.
//!
//! **O RELATÓRIO não é citação**, e é a linha que faz a conta valer: ele lista cada
//! órfão por path, então da segunda rodada em diante "citava" todos e a contagem
//! caía pra ZERO. Relatório que apaga o próprio achado publicando-o é o pior tipo de
//! verde. Por isso o caminho dele entra como argumento.
//!
//! depends_on: 03_resources/CONTEXT.md · src/shared/markdown.ts
//! impacts:    src/check/ratchet.ts

import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT } from "../shared/markdown.ts";

/** Onde o relatório mora — o único arquivo que este check ignora ao contar citação. */
const REPORT_DEFAULT = join(ROOT, "ci/report.md");

export function citacoes(report: string): { file: string; text: string }[] {
	const rg = Bun.spawnSync(
		[
			"rg",
			"--no-heading",
			"-o",
			"-N",
			"-e",
			String.raw`[A-Za-z0-9_./-]+\.md`,
			"-e",
			String.raw`\b(?:resources|references)\s+[a-z0-9_-]+`,
			// A âncora, e foi MEDIDA: sem ela 27 das 39 regras liam como órfãs
			// enquanto `#commit_is_the_report` está em `src/meta.ts`, no `rec.ts` e em
			// quatro outras regras. Relatório de órfão que perde a forma mais usada da
			// casa manda alguém deletar regra viva.
			"-e",
			String.raw`#[a-z0-9_]+`,
			// O ID de nota, e esta ia me fazer editar nota viva: nota liga nota pelo ID
			// imutável (`links: [- id: 2026-08-13T1942Z]`), NUNCA por nome de arquivo —
			// @03_resources/notes/CONTEXT.md diz que o slug muda e o ID não. Seis das
			// sete "notas órfãs" estavam ligadas o tempo todo.
			"-e",
			String.raw`\d{4}-\d{2}-\d{2}T\d{4}Z`,
			".",
		],
		{ cwd: ROOT },
	);
	// `rg` sai 1 em "nenhum match" — isso é dado, não falha. Acima disso é.
	if (rg.exitCode > 1) throw new Error(`rg falhou (exit ${rg.exitCode}): ${rg.stderr.toString()}`);
	// O RELATÓRIO NÃO É CITAÇÃO, e esta linha é a razão de a conta ser confiável:
	// ele lista cada órfão por path, então da segunda rodada em diante "citava"
	// todos e a conta caía pra ZERO. Relatório que apaga o próprio achado
	// publicando-o é o pior tipo de verde.
	const self = relative(ROOT, report);
	return rg.stdout
		.toString()
		.split("\n")
		.flatMap((line) => {
			const colon = line.indexOf(":");
			if (colon < 0) return [];
			const file = line.slice(0, colon).replace(/^\.\//, "");
			return file === self ? [] : [{ file, text: line.slice(colon + 1) }];
		});
}

/** Quem cita este recurso, tirando ele mesmo.
 *
 *  Por PATH é nos DOIS últimos segmentos (`macos/001_notificacoes.md`) e não no
 *  caminho inteiro, porque metade das citações da casa é relativa e um match de
 *  caminho completo perde todas. Nome de arquivo PELADO conta só quando vem da
 *  MESMA pasta — `[`../../../03_resources/references/macos/001_notificacoes.md`](../../../03_resources/references/macos/001_notificacoes.md)` no `CONTEXT.md`
 *  dela; de qualquer outro lugar um `output.md` solto não quer dizer nada.
 *
 *  O que NÃO conta: a lista `nunca_buscado:` do `vocabulary.yaml`. Ela nomeia
 *  recurso que ninguém buscou, o contrário de citação — e corrobora este check,
 *  com `house_verbs` nas duas listas. */
export function citadoPor(rel: string, cites: { file: string; text: string }[]): string[] {
	const parts = rel.split("/");
	const [dir, base] = [parts.slice(0, -1).join("/"), parts.at(-1)!];
	const tail = `${parts.at(-2)}/${base}`;
	const name = base.replace(/\.md$/, "");
	const id = base.match(/^\d{4}-\d{2}-\d{2}T\d{4}Z/)?.[0];
	return [
		...new Set(
			cites
				.filter((c) => c.file !== rel)
				.filter(
					(c) =>
						c.text.endsWith(tail) ||
						(c.text === base && c.file.slice(0, c.file.lastIndexOf("/")) === dir) ||
						c.text === `#${name}` ||
						(id !== undefined && c.text === id) ||
						(/^(?:resources|references)\s/.test(c.text) && c.text.split(/\s+/).at(-1) === name),
				)
				.map((c) => c.file),
		),
	];
}


/** Os buckets de que não se cobra citação — o porquê está no `//!`, e é um só:
 *  ata de reunião é fonte que se consome em LOTE (ata → `asks.md`), não recurso
 *  que se cita; o que é citado é a PASTA. Medido na task 010: 39 atas, zero
 *  citadas, em 44 dias.
 *
 *  Isenção é do BUCKET e não some da tabela: a contagem continua impressa, com
 *  `isento` na coluna de órfãos. Bucket que sai do exit code mas fica na vista é
 *  a diferença entre não cobrar e não olhar. */
const ISENTOS = new Set(["meetings"]);

/** Os órfãos, por bucket de `03_resources/`. */
export function orfaos(report = REPORT_DEFAULT) {
	const dir = join(ROOT, "03_resources");
	const cites = citacoes(report);
	const buckets = readdirSync(dir, { withFileTypes: true })
		.filter((e) => e.isDirectory() && !e.name.startsWith("."))
		.map((e) => {
			const files = readdirSync(join(dir, e.name), { recursive: true })
				.filter((f): f is string => typeof f === "string" && f.endsWith(".md") && !f.endsWith("CONTEXT.md"))
				.map((f) => `03_resources/${e.name}/${f}`);
			const isento = ISENTOS.has(e.name);
			return { name: e.name, files, isento, orfaos: isento ? [] : files.filter((rel) => citadoPor(rel, cites).length === 0) };
		})
		.sort((a, b) => b.files.length - a.files.length);
	return { buckets, todos: buckets.flatMap((b) => b.orfaos) };
}

export function tabela(report = REPORT_DEFAULT): { md: string; orfaos: string[] } {
	const { buckets, todos } = orfaos(report);
	const total = buckets.reduce((s, b) => s + b.files.length, 0);
	// O total de COBRADOS, e não o de arquivos: com um bucket isento, "138 | 99 | 0"
	// leria como 39 recursos que sumiram da conta sem explicação.
	const cobrados = buckets.reduce((s, b) => (b.isento ? s : s + b.files.length), 0);
	const isentos = total - cobrados;
	return {
		orfaos: todos,
		md: [
			"## Resources Summary",
			"",
			"Referenciado = alguém cita por PATH (inclusive relativo), pelo nome do arquivo no `CONTEXT.md` da PRÓPRIA pasta, pelo VERBO (`my meta resources <nome>`), pela ÂNCORA (`#<nome>`), ou — entre notas — pelo `id:` imutável. O próprio arquivo não se cita, e a lista `nunca_buscado:` do `vocabulary.yaml` não conta: ela nomeia o que ninguém buscou.",
			"",
			`Bucket \`isento\` não é cobrado: ata de reunião é fonte que se consome em lote (ata → \`asks.md\`), e o que se cita é a PASTA. ${isentos} recurso(s) fora da conta, ${cobrados} cobrado(s).`,
			"",
			"| bucket | resources | referenciados | órfãos |",
			"|---|---|---|---|",
			...buckets.map(
				(b) =>
					`| \`${b.name}\` | ${b.files.length} | ${b.isento ? "—" : b.files.length - b.orfaos.length} | ${b.isento ? "isento" : b.orfaos.length} |`,
			),
			`| **total cobrado** | **${cobrados}** | **${cobrados - todos.length}** | **${todos.length}** |`,
			"",
			"### Órfãos",
			"",
			todos.length === 0 ? "Nenhum — todo recurso COBRADO é citado por alguém." : todos.map((o) => `- \`${o}\``).join("\n"),
		].join("\n"),
	};
}

export function main(argv: string[]): number {
	const i = argv.indexOf("--report");
	const report = i === -1 ? REPORT_DEFAULT : join(ROOT, argv[i + 1] ?? "");
	const { md, orfaos: todos } = tabela(report);

	if (argv.includes("--json")) {
		console.log(JSON.stringify({ orfaos: todos, report: relative(ROOT, report) }, null, 2));
		return todos.length === 0 ? 0 : 1;
	}
	console.log(md.split("\n").slice(2).join("\n"));
	return todos.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
