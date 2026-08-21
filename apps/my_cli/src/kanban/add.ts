#!/usr/bin/env bun
//! Põe uma coisa num board. Três coisas, e o board decide qual.
//!
//!     my kanban add 999_001_slug my-teams-v1            confirma o rastreio da task
//!     my kanban add 999_001_slug my-teams-v1 bug,p1     ... com labels
//!
//! NO BOARD DO GITHUB — Projects v2:
//!
//!     my kanban add gh:24 soulperuibe                   LIGA o board local ao projeto
//!     my kanban add biliboss/soulperuibe#57 soulperuibe põe a issue no Inbox
//!     my kanban add <url da issue> gh:24                idem, sem link nenhum
//!
//! A task local RECUSA quando mora noutro board: não existe verbo nesta casa que
//! troque o DONO de uma task, só o nome (`my kanban rename`).
//!
//! ## O que é gravado no link, e o que NÃO é
//!
//! `gh:24 <board>` grava OWNER e NÚMERO no `.kanban/board.json`, e mais nada. O
//! `project_id`, o id do campo Status e os cinco ids de opção ficam de fora de
//! propósito: o registro antigo (`_today/.gh_projects.jsonl`) cacheava os três e o
//! próprio cabeçalho dele avisava que os ids de opção mudam sempre que alguém edita o
//! campo Status. Id de opção cacheado é como uma carta vai parar numa coluna que não
//! existe mais — então eles são RELIDOS a cada comando, e nunca lidos de arquivo.
//!
//! ## Sub-issue é recusada
//!
//! Uma issue com pai aninha sob ele e não aparece em coluna NENHUMA. Três itens
//! sumiram assim em 21/08. Os itens ficam PLANOS.
//!
//! depends_on: src/kanban/model.ts · src/kanban/remote.ts
//! impacts:    —

import { add, link, parseCardAddress, refOf } from "./model.ts";
import { addIssue, parseRef, readBoard, refToString } from "./remote.ts";

/** Liga um board local a um projeto do GitHub. **CUSTA 1 PONTO** — lê o projeto uma
 *  vez pra provar que ele existe e tem campo `Status`, porque um link pra board sem
 *  coluna é um link que só falha na primeira vez que alguém tenta mover uma carta. */
function linkBoard(ghAddress: string, boardName: string): number {
	const ref = parseRef(ghAddress)!;
	const b = readBoard(ref);
	link(boardName, ref);
	console.log(`${boardName} → ${refToString(ref)}  "${b.title}"`);
	console.log(`  colunas: ${b.columns.map((c) => c.name).join(" → ")}`);
	console.log(`  ${b.items.length} carta(s)  ·  my kanban list ${boardName} --remote`);
	return 0;
}

/** Põe uma issue no board, já no `Inbox`. **CUSTA 4 PONTOS**: 1 pra ler o board, 1 pra
 *  resolver a issue (e descobrir se ela tem pai), 1 pra `addProjectV2ItemById` e 1 pro
 *  Status. Nunca num laço. */
function addRemote(issueAddress: string, boardName: string): number {
	const ref = refOf(boardName, { remote: true });
	if (!ref) return console.error(`\`${boardName}\` não declara projeto do GitHub nenhum — my kanban add gh:<n> ${boardName}`), 1;
	const b = readBoard(ref);
	const r = addIssue(b, issueAddress);
	console.log(`#${r.issue} → ${r.column.name} em ${refToString(ref)}`);
	return 0;
}

const ehIssue = (s: string) => /^https?:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+/.test(s) || /^[^/\s]+\/[^#\s]+#\d+$/.test(s);

export function main(argv: string[]): number {
	const [alvo, board, labels] = argv.filter((a) => !a.startsWith("--"));
	if (!alvo || !board)
		return (
			console.error(
				"uso: my kanban add <task> <board> [labels]\n" +
					"     my kanban add gh:<n> <board>                 liga o board ao projeto do GitHub\n" +
					"     my kanban add <owner/repo#57|url> <board>    põe a issue no Inbox",
			),
			1
		);
	try {
		// A FORMA do primeiro argumento decide, e as três não colidem: `gh:24` é
		// endereço de projeto, `owner/repo#57` ou uma URL é issue, e o resto é o rótulo
		// de uma task local (`999_001_slug`), que nunca tem `#` nem `/`.
		if (parseRef(alvo)) return linkBoard(alvo, board);
		if (ehIssue(alvo)) return addRemote(alvo, board);
		if (parseCardAddress(alvo)) return console.error(`\`${alvo}\` é o endereço de uma carta que JÁ está num board — pra mover use \`my kanban move ${alvo} <coluna>\`; pra adicionar, dê o endereço da issue (\`owner/repo#57\`)`), 1;

		const c = add(alvo, board, labels ? labels.split(",").filter(Boolean) : []);
		console.log(`${c.board}#${c.task}  (${c.column}/)  labels: ${c.labels.join(", ") || "—"}`);
		return 0;
	} catch (e) {
		return console.error((e as Error).message), 1;
	}
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
