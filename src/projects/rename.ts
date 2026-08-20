#!/usr/bin/env bun
//! Um projeto troca de nome, e TUDO que aponta pra ele troca junto.
//!
//!   my projects rename me-validate my_check_v1
//!   my projects rename me-validate my_check_v1 -n    # o plano, sem escrever
//!
//! Renomear à mão é `git mv` mais uma caçada: o `projeto:` do front matter, o
//! `**Serve a área:**`, o link da área de volta, o `--out-dir` de um workflow, o
//! caminho dentro de um RFC. Medido nesta casa em 17/08, quando renumerar as pastas
//! do PARA deixou **seis links de `01_projects/CONTEXT.md` e cinco docs de projeto
//! apontando pro vazio** — e o sinal foi um `my check all` num projeto novo, dias
//! depois. Esse é o custo que este arquivo existe pra não pagar de novo.
//!
//! ## O que ele faz, em ordem
//!
//! 1. RECUSA antes de tocar: slug inválido, destino ocupado, origem inexistente.
//! 2. `git mv` — e não `mv`: o git é quem carrega a história do arquivo pro nome
//!    novo, e um `mv` cru faz o log parar no rename.
//! 3. reescreve `01_projects/<antigo>` -> `01_projects/<novo>` em TODO arquivo do
//!    repo que cite o caminho, achado por `rg`.
//! 4. reescreve o `projeto:` do front matter, que é a única cópia do slug DENTRO do
//!    projeto.
//!
//! ## O que ele deixa pendurado FORA do repo
//!
//! `~/src/tmp/<slug>` é um symlink por projeto, feito à mão, e este verbo não o
//! toca: escrever fora de `~/src/me` é uma permissão que um verbo de projeto não
//! tem pedido. Medido no primeiro rename real — `~/src/tmp/me-validate` ficou
//! apontando pro vazio, e o único sinal foi um `test -e` que falhou.
//!
//! ponytail: por enquanto é à mão (`ln -s` novo, `rm` no velho). Se um dia algo
//! CRIAR esses links por conta, é esse algo que passa a consertá-los aqui.
//!
//! O que ele NÃO faz: adivinhar menção em prosa. `me-validate` escrito no meio de
//! uma frase não é caminho, e trocar texto solto é como um RFC vira ficção — a
//! frase passa a descrever um nome que nunca existiu naquele dia. O plano imprime
//! quantas dessas sobraram, pra pessoa decidir uma por uma.
//!
//! `-n` imprime e não escreve, igual ao `--fix` do @src/check/citations.ts.
//!
//! depends_on: 01_projects/ · src/projects/model.ts
//! impacts:    src/check/projects.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { PROJETOS, RAIZ } from "./model.ts";

/** O slug aceita `_`, e isso é medição e não gosto: `agent_evals`,
 *  `biliboss_corretor` e `system-hooks` convivem no disco desde antes do script, e
 *  um regex que só aceita hífen recusaria renomear pro padrão que a casa já usa. */
const SLUG = /^[a-z0-9][a-z0-9_-]{1,48}$/;

/** Todo arquivo que cita `01_projects/<slug>` — o caminho, não o nome solto. */
function citantes(slug: string): string[] {
	// `--hidden`, e isto foi pego no dry-run: sem ele o `rg` pula arquivo oculto e o
	// rename deixaria `.github/workflows/check.yml` apontando pro nome velho — CI
	// quebrada por um caminho que a busca não viu. `!.git` porque o objeto do git não
	// é citação de ninguém.
	const rg = Bun.spawnSync(["rg", "-l", "--hidden", "-g", "!.git", "--fixed-strings", `01_projects/${slug}`, "."], { cwd: RAIZ });
	if (rg.exitCode > 1) throw new Error(`rg falhou (exit ${rg.exitCode})`);
	return rg.stdout
		.toString()
		.split("\n")
		.filter(Boolean)
		.map((f) => f.replace(/^\.\//, ""));
}

/** Menção ao NOME sem o caminho: o que este verbo se recusa a adivinhar. */
function mencoes(slug: string, novo: string): number {
	const rg = Bun.spawnSync(["rg", "-c", "--hidden", "-g", "!.git", "--fixed-strings", slug, "-g", `!01_projects/${novo}/**`, "."], { cwd: RAIZ });
	return rg.stdout
		.toString()
		.split("\n")
		.filter(Boolean)
		.reduce((s, l) => s + Number(l.slice(l.lastIndexOf(":") + 1)), 0);
}

export function command(): Command {
	return new Command("rename")
		.description("um projeto troca de nome, e tudo que aponta pra ele troca junto")
		.argument("<antigo>", "o slug de hoje")
		.argument("<novo>", "o slug novo")
		.option("-n, --dry-run", "imprime o plano e não escreve nada");
}

export function main(argv: string[]): number {
	const cmd = command().exitOverride();
	let code = 0;
	try {
		cmd.parse(argv, { from: "user" });
	} catch (e) {
		return (e as { exitCode?: number }).exitCode ?? 1;
	}
	const [antigo, novo] = cmd.args;
	const seco = cmd.opts().dryRun === true;
	const morre = (m: string) => (console.error(m), 1);

	if (!antigo || !novo) return morre("uso: my projects rename <antigo> <novo> [-n]");
	if (!SLUG.test(novo)) return morre(`slug inválido: ${novo} (minúsculas, hífen ou _, 2-49)`);
	if (!existsSync(join(PROJETOS, antigo))) return morre(`não existe: 01_projects/${antigo}/`);
	// Antes de qualquer escrita, e não no meio: um rename que falha na metade deixa
	// a pasta com nome novo e metade das citações no nome velho.
	if (existsSync(join(PROJETOS, novo))) return morre(`já existe: 01_projects/${novo}/ — o NNN de um projeto é endereço, não se sobrescreve`);

	const arquivos = citantes(antigo);
	const soltas = mencoes(antigo, novo);
	console.log(`01_projects/${antigo}/ -> 01_projects/${novo}/`);
	console.log(`${arquivos.length} arquivo(s) citam o caminho:`);
	for (const f of arquivos) console.log(`  ${f}`);
	if (soltas) console.log(`\n· ${soltas} menção(ões) ao nome "${antigo}" SEM o caminho — não são tocadas, decida uma por uma`);

	if (seco) {
		console.log("\nplano só. Sem `-n`, executa.");
		return 0;
	}

	// `git mv` e não `mv`: o git é quem carrega a história pro nome novo.
	const mv = Bun.spawnSync(["git", "mv", `01_projects/${antigo}`, `01_projects/${novo}`], { cwd: RAIZ });
	if (mv.exitCode !== 0) return morre(`git mv falhou: ${mv.stderr.toString()}`);

	// A reescrita vem DEPOIS do mv, e sobre a lista tirada ANTES: os arquivos de
	// dentro do projeto mudaram de caminho no meio, e reler agora perderia os que
	// ainda citam o nome velho de dentro do lugar novo.
	let tocados = 0;
	for (const f of arquivos) {
		const path = join(RAIZ, f.startsWith(`01_projects/${antigo}/`) ? f.replace(`01_projects/${antigo}/`, `01_projects/${novo}/`) : f);
		if (!existsSync(path)) continue;
		const antes = readFileSync(path, "utf8");
		const depois = antes.replaceAll(`01_projects/${antigo}`, `01_projects/${novo}`).replace(/^projeto:\s*.*$/m, `projeto: ${novo}`);
		if (depois !== antes) (writeFileSync(path, depois), tocados++);
	}

	// O `projeto:` do PRÓPRIO doc, sempre — e não como parte do laço acima. Ele foi
	// esquecido na primeira execução real por um motivo bobo e exato: o `CONTEXT.md`
	// de um projeto não cita o próprio caminho, então nunca entrou na lista de
	// citantes. O único lugar que guarda o slug DENTRO do projeto era o único que não
	// era visitado.
	for (const doc of [`01_projects/${novo}/CONTEXT.md`, `01_projects/${novo}/${novo}.md`, `01_projects/${novo}/${antigo}.md`]) {
		const path = join(RAIZ, doc);
		if (!existsSync(path)) continue;
		const antes = readFileSync(path, "utf8");
		const depois = antes.replace(/^projeto:\s*.*$/m, `projeto: ${novo}`);
		if (depois !== antes) (writeFileSync(path, depois), tocados++);
	}

	console.log(`\n${tocados} arquivo(s) reescritos. Confira com \`my check citations\` e comite os dois juntos.`);
	return code;
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
