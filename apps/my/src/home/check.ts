#!/usr/bin/env bun
//! O que está torto sobre ONDE as coisas ficam — e sai 1 quando acha alguma coisa.
//!
//!     my home check
//!     my home check --tsv
//!
//! QUATRO PERGUNTAS, e cada uma nasceu de um jeito de o caminho mentir:
//!
//!   raiz que não existe      `MY_HOME` apontando pro vazio. O verbo não estoura:
//!                            ele lê zero coisas e reporta uma casa vazia, que é
//!                            indistinguível de uma casa nova.
//!   estado de máquina no
//!   checkout                 `_data/` dentro do repo do código. Enquanto checkout
//!                            e casa eram a mesma pasta ninguém via; publicado o
//!                            código, é estado de máquina em repositório público —
//!                            e some no primeiro clone.
//!   env lida e não declarada `my home env` é a tabela, e tabela escrita à mão
//!                            apodrece. Esta pergunta é o que a mantém honesta:
//!                            todo `process.env.X` do fonte tem que estar lá.
//!   env declarada e nunca
//!   lida                     o contrário, e igualmente ruim: uma linha na tabela
//!                            que promete uma alavanca que não existe mais.
//!
//! SÍNCRONO E SÓ DISCO, pra `house.check()` achar por `require()`. E ele varre o
//! CHECKOUT (`code()`), nunca a casa: as env são fato do código.
//!
//! depends_on: src/home/paths.ts · src/home/env.ts · src/shared/findings.ts
//! impacts:    src/shared/house.ts

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { emit } from "../shared/findings.ts";
import { VARS } from "./env.ts";
import { code, machine, root } from "./paths.ts";

export type Finding = { path: string; says: string };

/** Pastas que não são fonte desta casa. `node_modules` não é nosso; `dist`/`out`
 *  são gerados e repetiriam cada leitura já contada no fonte que os gerou. */
const SKIP = new Set(["node_modules", "dist", "out", ".git", "_data", "drizzle"]);

function sources(dir: string, into: string[] = []): string[] {
	if (!existsSync(dir)) return into;
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		if (SKIP.has(e.name) || e.name.startsWith(".")) continue;
		const p = join(dir, e.name);
		if (e.isDirectory()) sources(p, into);
		// `.test.ts` E `.mjs` CONTAM. Uma env lida só num teste continua sendo uma
		// alavanca (`GIT_DIR` guarda o `tasks start` de rodar dentro de um hook), e o
		// servidor de dev da extensão é `.mjs` — os dois apareceram como "declarada e
		// ninguém lê" na primeira rodada deste check, e os dois eram leitura real.
		else if (/\.(ts|mjs|js)$/.test(e.name)) into.push(p);
	}
	return into;
}

/** Toda env LIDA no fonte, com um arquivo de exemplo pra cada — o achado precisa
 *  dizer onde, senão vira "conserte em algum lugar". */
export function read(): Map<string, string> {
	const seen = new Map<string, string>();
	for (const f of sources(join(code(), "src"))) {
		// LINHA DE COMENTÁRIO NÃO É LEITURA. Um `//!` que EXPLICA uma env — e esta casa
		// explica muito — não a lê, e duas rodadas deste check acusaram uma variável
		// chamada `X` que só existe em prosa: uma no docstring deste arquivo, outra em
		// `tasks/start.test.ts` dizendo que `delete process.env.X` não chega no filho.
		// A crase sozinha não resolvia: a segunda estava depois de um `delete `.
		//
		// Linha e não bloco: comentário de bloco com env dentro seria falso NEGATIVO, e
		// esse erra pro lado seguro — o check acusa a mais, nunca a menos.
		for (const line of readFileSync(f, "utf8").split("\n")) {
			if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
			for (const m of line.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) {
				if (!seen.has(m[1]!)) seen.set(m[1]!, f);
			}
		}
	}
	return seen;
}

export function check(): Finding[] {
	const findings: Finding[] = [];

	// 1. A casa aponta pro vazio.
	if (!existsSync(root()))
		findings.push({
			path: root(),
			says: `a raiz da casa não existe — todo verbo vai ler zero coisas e reportar uma casa vazia, que é igualzinho a uma casa nova (\`my home paths\`)`,
		});

	// 2. Estado de máquina dentro do checkout.
	for (const suspect of ["_data", ".me"]) {
		const p = join(code(), suspect);
		if (existsSync(p) && statSync(p).isDirectory())
			findings.push({
				path: relative(code(), p) || p,
				says: `estado de máquina dentro do CHECKOUT — o lugar é ${machine()}. Some no primeiro clone, e vira estado de máquina em repositório público no dia em que o código for publicado`,
			});
	}

	// 3 e 4. A tabela contra o fonte, nos dois sentidos.
	const declared = new Map(VARS.map((v) => [v.name, v]));
	const lidas = read();
	for (const [name, file] of lidas) {
		if (!declared.has(name))
			findings.push({
				path: relative(code(), file),
				says: `lê \`process.env.${name}\` e ela não está declarada — acrescente em \`src/home/env.ts\`, dizendo o que ela decide e se aponta ESCRITA`,
			});
	}
	for (const v of VARS) {
		// `MY_CODE`/`MY_MACHINE` são lidas por `paths.ts`, então caem no laço acima.
		// O que sobra aqui é promessa sem alavanca atrás.
		if (!lidas.has(v.name))
			findings.push({
				path: "src/home/env.ts",
				says: `declara \`${v.name}\` e nenhum fonte a lê — ou a alavanca morreu, ou o nome está errado na tabela`,
			});
	}

	return findings;
}

export function main(argv: string[] = Bun.argv.slice(2)): number {
	const findings = check();
	return emit(argv, {
		json: { declaradas: VARS.length, lidas: read().size },
		findings,
		cols: (f) => [f.path, f.says],
		human: () => {
			for (const f of findings) console.log(`✗ ${f.path}\n  ${f.says}`);
			console.log(`${VARS.length} declarada(s) · ${read().size} lida(s) no fonte · ${findings.length} achado(s)`);
		},
	});
}

if (import.meta.main) process.exit(main());
