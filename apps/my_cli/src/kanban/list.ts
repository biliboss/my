#!/usr/bin/env bun
//! Os boards, ou os cards de um — com a coluna, o WIP e quem está bloqueando.
//!
//!     my kanban list                          todos os boards, com o WIP de cada
//!     my kanban list my-teams-v1               os cards do board
//!     my kanban list my-teams-v1 --column doing
//!     my kanban list my-teams-v1 --labels bug,p1
//!     my kanban list --json | --jsonl | --tsv
//!
//! O BOARD DO GITHUB — Projects v2, e cada leitura CUSTA do orçamento compartilhado:
//!
//!     my kanban list --remote                 os projetos do owner          1 ponto
//!     my kanban list <board> --remote         as cartas por coluna          1 ponto
//!     my kanban list gh:24                    idem, endereçado pelo número  1 ponto
//!     my kanban list gh:biliboss/24           idem, com o owner explícito   1 ponto
//!
//! NENHUMA LEITURA REMOTA ACONTECE SEM `--remote` OU SEM `gh:` NO ENDEREÇO — nem no
//! `list` pelado, nem por um board estar linkado. São 5000 pontos/hora divididos com
//! todo agente e com o dashboard, e ele zerou em 21/08 com polling de 30s em três
//! boards. Um comando que gasta ponto sem alguém ter pedido vira exatamente esse laço.
//!
//! depends_on: src/kanban/model.ts · src/kanban/remote.ts · src/shared/gh.ts
//! impacts:    —

import { fmtOf, out } from "../shared/gh.ts";
import { blocked, board, boards, cards, linkOf, refOf, wip } from "./model.ts";
import { type RemoteItem, byColumn, listProjects, readBoard, refToString } from "./remote.ts";

/** As cartas de um board do GitHub, agrupadas por coluna na ordem do fluxo. Uma
 *  chamada, um ponto — medido em 21/08: `cost: 1`, `nodeCount: 100`. */
function remoteBoard(name: string, argv: string[], fmt: ReturnType<typeof fmtOf>): number {
	const ref = refOf(name, { remote: true });
	if (!ref)
		return (
			console.error(
				`\`${name}\` não declara projeto do GitHub nenhum.\n` +
					`  my kanban list --remote            vê os projetos que existem\n` +
					`  my kanban add gh:<n> ${name}${" ".repeat(Math.max(0, 14 - name.length))} liga este board a um deles\n` +
					`  my kanban list gh:<n>              lê o projeto sem ligar nada`,
			),
			1
		);
	const b = readBoard(ref);
	const grupos = byColumn(b);
	const linhas = grupos.flatMap((g) =>
		g.items.map((i: RemoteItem) => ({
			board: refToString(b.ref),
			column: g.column,
			issue: i.number,
			title: i.title,
			state: i.state,
			parent: i.parent,
			item: i.id,
			url: i.url,
		})),
	);

	if (fmt !== "human") {
		out(
			fmt,
			linhas,
			(r) => [r.board, r.column, r.issue, r.title, r.state, r.parent],
			(r) => `${r.column}\t#${r.issue}\t${r.title}`,
		);
		return 0;
	}
	console.log(`${b.title}  ${b.url}`);
	if (b.truncated) console.log("  ⚠ mais de 100 itens: o que segue é um PREFIXO do board");
	for (const g of grupos) {
		if (!g.items.length) continue;
		console.log(`\n  ${g.column} (${g.items.length})`);
		// `parent` marcado na linha porque uma sub-issue NÃO aparece em coluna nenhuma
		// na tela do GitHub — ela aninha sob a issue pai. Três itens sumiram assim em
		// 21/08, e o único lugar onde eles voltam a ser visíveis é aqui.
		for (const i of g.items)
			console.log(`    #${i.number ?? "—"} ${i.title.slice(0, 62)}${i.parent ? `  ↳ sub-issue de #${i.parent}, invisível na coluna` : ""}`);
	}
	return 0;
}

/** Os projetos do owner, sem as cartas. **CUSTA 1 PONTO.** Existe pra ninguém
 *  precisar manter um arquivo com os números dos boards: o GitHub já É esse registro,
 *  e um registro em disco envelhece sem avisar. */
function remoteProjects(fmt: ReturnType<typeof fmtOf>): number {
	out(
		fmt,
		listProjects(),
		(r) => [r.number, r.title, r.url],
		(r) => `gh:${String(r.number).padEnd(4)} ${r.title.padEnd(38)} ${r.url}`,
	);
	return 0;
}

export function main(argv: string[]): number {
	const [arg] = argv.filter((a) => !a.startsWith("--"));
	const fmt = fmtOf(argv);
	const remoto = argv.includes("--remote");

	try {
		// O endereço `gh:` já É o pedido de rede: quem digitou o número do projeto não
		// está perguntando sobre pasta nenhuma.
		if (arg && (remoto || arg.startsWith("gh:"))) return remoteBoard(arg, argv, fmt);
		if (!arg && remoto) return remoteProjects(fmt);
	} catch (e) {
		return console.error((e as Error).message), 1;
	}

	if (!arg) {
		const rows = boards().map((b) => ({ board: b.name, wip: wip(b.name), blocked: blocked(b.name), remote: linkOf(b.name) }));
		if (fmt !== "human") {
			out(
				fmt,
				rows,
				(r) => [r.board, r.blocked.join(",") || "", r.remote ? refToString(r.remote) : ""],
				(r) => `${r.board}\t${r.blocked.join(",")}\t${r.remote ? refToString(r.remote) : ""}`,
			);
			return 0;
		}
		for (const r of rows) {
			const cols = Object.entries(r.wip).map(([c, w]) => `${c}=${w.cards}${w.limit ? `/${w.limit}` : ""}`).join(" · ");
			// O link sai de graça — está no `.kanban/board.json`, e imprimir custa zero
			// ponto. Ler o board de lá custa um, e por isso exige `--remote`.
			const gh = r.remote ? `  → ${refToString(r.remote)}` : "";
			console.log(`${r.board.padEnd(28)} ${cols}${r.blocked.length ? `  ⚠ ${r.blocked.join(",")} acima do limite` : ""}${gh}`);
		}
		if (!rows.length) console.log("nenhum board ainda — my kanban open <nome>");
		return 0;
	}

	const val = (f: string) => {
		const i = argv.indexOf(f);
		return i === -1 ? undefined : argv[i + 1];
	};
	if (!board(arg)) return console.error(`nenhum board \`${arg}\` — existem: ${boards().map((b) => b.name).join(", ")}`), 1;
	const labels = val("--labels")?.split(",").filter(Boolean);
	const rows = cards(arg, { column: val("--column"), labels });

	if (fmt !== "human") {
		out(
			fmt,
			rows,
			(r) => [r.board, r.task, r.column, r.service, r.labels.join(",")],
			(r) => `${r.board}\t${r.task}\t${r.column}\t${r.labels.join(",")}`,
		);
		return 0;
	}
	for (const r of rows) console.log(`${r.column.padEnd(11)} ${r.task}${r.labels.length ? `  [${r.labels.join(", ")}]` : ""}`);
	if (!rows.length) console.log("nada aqui");
	return 0;
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
