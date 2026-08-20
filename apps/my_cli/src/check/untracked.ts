#!/usr/bin/env bun
//! Existe FONTE que só está no meu disco?
//!
//!   my check untracked
//!   my check untracked --json | --jsonl | --tsv
//!
//!   --json → { fontes:int · findings:[…] }
//!            catraca: untracked.fontes = fontes
//!
//! Arquivo de código não rastreado é um repo que não builda pra mais ninguém — e é
//! invisível localmente, porque local o arquivo está lá. Foi o erro mais caro desta
//! sessão, e ele aconteceu TRÊS vezes seguidas antes de virar este arquivo:
//!
//!   1. `src/projects/model.ts` — `my projects` e `my sprints` funcionavam aqui e
//!      estavam quebrados no repo. Achado pelo `citations.ts` DENTRO do CI.
//!   2. `src/shared/markdown.ts` — nasceu de um `mv` (o `git mv` recusou, o arquivo
//!      ainda não era versionado) e o roteiro de staging pulava o que o
//!      `git status` marca `??`. `Cannot find module` no runner, verde aqui.
//!   3. `src/check/{okf,maps,resources}.ts` — os três checks novos, escritos por
//!      script e nunca adicionados. Mesmo sintoma, mesmo minuto.
//!
//! As três só apareceram no GitHub, uma por push, cada uma custando uma rodada. Um
//! check local que faz a MESMA pergunta custa 40ms — a pergunta é "o repo tem tudo
//! que a minha máquina tem?", e a resposta mora no `git ls-files --others`.
//!
//! ## Só CÓDIGO, e só o que dá `import`
//!
//! Markdown não entra: rascunho não commitado é o estado normal de um doc em
//! andamento, e acusá-lo transformaria este check no que ninguém roda. O que quebra
//! um clone é `.ts`, `.py`, `.mjs`, `.sh` — arquivo que outro arquivo importa.
//!
//! Pasta ignorada pelo `.gitignore` também não entra: `--exclude-standard` é o que
//! separa "esqueci de adicionar" de "isto nunca foi pra cá".
//!
//! depends_on: src/ · src/shared/findings.ts
//! impacts:    src/check/all.ts

import { join } from "node:path";
import { emit } from "../shared/findings.ts";
import { repoRoot } from "../shared/file.ts";

const ROOT = repoRoot();

/** Extensão que outro arquivo IMPORTA — é o que faz um clone quebrar. */
const CODIGO = /\.(ts|tsx|mts|mjs|js|py|sh|rs)$/;

/** Onde código de verdade mora. O `src/` de um projeto conta: o software é dele, mas
 *  um import quebrado ali quebra igual.
 *
 *  E o glob fica FORA do JSDoc de propósito — `01_projects/<x>/src/` escrito com
 *  asterisco-barra fecha o comentário no meio e o resto do arquivo vira erro de
 *  sintaxe. Já custou duas vezes nesta sessão. */
const FONTE = [/^src\//, /^01_projects\/[^/]+\/(?:src|scripts)\//, /^\.github\//];

export function untracked(): string[] {
	const ls = Bun.spawnSync(["git", "ls-files", "--others", "--exclude-standard", "-z"], { cwd: ROOT });
	if (ls.exitCode !== 0) throw new Error(`git ls-files falhou (exit ${ls.exitCode}): ${ls.stderr.toString()}`);
	return ls.stdout
		.toString()
		.split("\0")
		.filter(Boolean)
		.filter((f) => CODIGO.test(f) && FONTE.some((re) => re.test(f)))
		.sort();
}

export function main(argv: string[]): number {
	const achados = untracked();
	return emit(argv, {
		json: { fontes: achados.length },
		findings: achados,
		cols: (f) => [f],
		human: () => {
			for (const f of achados)
				console.log(`${f}: error · fonte não rastreada — um clone deste commit não tem este arquivo`);
			console.log(`${achados.length} fonte(s) só no disco local`);
			if (achados.length) console.log("  `git add <caminho>` — e não `git add -A`, que o hook desta casa barra");
		},
	});
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
