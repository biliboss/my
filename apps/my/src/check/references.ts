#!/usr/bin/env bun
//! Alguma referência menciona OUTRA referência?
//!
//!   my check references
//!   my check references --json | --jsonl | --tsv
//!
//!   --json → { referencias:int · mencoes:int · findings:[…] }
//!            catraca: references.mencoes = mencoes
//!
//! É a regra 4 de @03_resources/references/system/010_references.md, e era a única das
//! cinco sem check num repo que tem check pra tudo:
//!
//! > Ela é uma unidade isolada de conhecimento: lida sozinha, inteira, sem "veja
//! > também". O motivo é composição: se `git_worktree` aponta pra `git_merge_staging`,
//! > pedir as duas devolve a segunda duas vezes, e pedir só a primeira sugere um
//! > arquivo que não veio.
//!
//! `my references A B C` é a primitiva que essa regra sustenta. Medido 19/08:
//! `in_tasks` cita `out_tasks` e `out_tasks` cita `in_tasks` — pedir os dois entrega
//! um deles duplicado, que é exatamente o dano que o texto previa.
//!
//! O QUE CONTA COMO MENÇÃO: `my references <nome>` onde `<nome>` é uma referência que
//! EXISTE no índice. O índice é o mesmo de @src/resources/store.ts — reimplementar a
//! varredura aqui seria a segunda fonte que a casa recusa, e ela divergiria no dia em
//! que alguém criasse uma pasta `references/` nova.
//!
//! O que NÃO conta, e cada exclusão tira ruído em vez de esconder achado:
//!
//!   · quem cita é `CONTEXT.md`         — ele ROTEIA, é o trabalho dele (010:31)
//!   · quem cita é regra, nota, template — não é referência, a regra não se aplica
//!   · a referência cita a SI MESMA      — não é ponteiro pra fora
//!   · o nome citado não está no índice  — é comando de exemplo, não travessia
//!
//! depends_on: src/resources/store.ts · 03_resources/references/system/010_references.md
//! impacts:    src/check/all.ts · ci/baseline.json

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { emit } from "@my/shared/findings";
import { index as store } from "../resources/store.ts";

/** As referências, e SÓ elas: o kind `references` da loja é exatamente o índice que
 *  `src/references.ts` tinha antes de virar apelido (20/08) — todo `.md` dentro de uma
 *  pasta `references/` ou `resources/`, em qualquer profundidade, sem `CONTEXT.md`.
 *
 *  Filtrar por kind e não varrer a loja inteira é o que mantém a medida comparável com
 *  o teto de ontem: a regra 4 é sobre REFERÊNCIA, e uma nota ou um template que cite
 *  outra página não a viola.
 *
 *  O `.md` no filtro tira o único recurso SINTÉTICO da loja (`stack`, que mora numa
 *  constante do contrato): ele não é arquivo, então não há linha pra apontar. */
const index = (raiz?: string) => store(raiz).filter((r) => r.kind === "references" && r.path.endsWith(".md"));

/** `my references git_worktree` — o verbo, e o nome logo depois dele. Só o PRIMEIRO
 *  nome: `my references A B C` é a chamada composta que a regra existe pra permitir, e
 *  numa referência ela apareceria como travessia do mesmo jeito — o primeiro nome já
 *  denuncia a linha. */
const MENCAO = /\bmy references\s+(?!--)([a-z0-9_]+)/g;

type Achado = { file: string; line: number; cita: string };

/** `raiz` existe pro TESTE: o índice varre um diretório inteiro, e apontá-lo pra uma
 *  fixture é o que permite provar as exclusões sem depender do estado do repo. */
export function achados(raiz?: string): Achado[] {
	const refs = raiz === undefined ? index() : index(raiz);
	const nomes = new Set(refs.map((r) => r.name));
	const out: Achado[] = [];

	for (const ref of refs) {
		const linhas = readFileSync(ref.path, "utf8").split("\n");
		let fenced = false;
		for (let n = 0; n < linhas.length; n++) {
			// Bloco de código é EXEMPLO da sintaxe, não travessia — mesma regra do
			// `citations.ts`, e ela vale 2 dos 16 achados brutos: a própria
			// `010_references.md` ensina o comando num fence ```bash, e sem esta guarda o
			// documento que DEFINE a regra 4 aparecia violando a regra 4. A outra é uma
			// linha de `out_issues.md` que mostra o comando dentro de um bloco.
			if (linhas[n]!.trimStart().startsWith("```")) {
				fenced = !fenced;
				continue;
			}
			if (fenced) continue;
			for (const m of linhas[n]!.matchAll(MENCAO)) {
				const cita = m[1]!;
				// A si mesma não é travessia — uma referência pode ensinar como se pede.
				if (cita === ref.name) continue;
				// Nome que não existe no índice é exemplo de uso do comando, não ponteiro.
				if (!nomes.has(cita)) continue;
				out.push({ file: relative(raiz ?? process.cwd(), ref.path), line: n + 1, cita });
			}
		}
	}
	return out;
}

export function main(argv: string[]): number {
	const found = achados();
	return emit(argv, {
		json: { referencias: index().length, mencoes: found.length },
		findings: found,
		cols: (a) => [a.file, a.line, a.cita],
		human: () => {
			for (const a of found) console.log(`${a.file}:${a.line}: error · menciona a referência \`${a.cita}\``);
			console.log(`${index().length} referências · ${found.length} menção(ões) entre elas`);
			if (found.length) console.log("  a regra 4: uma referência é lida sozinha, inteira, sem `veja também`");
		},
	});
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
