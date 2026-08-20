//! O que os dois comandos de `system_design` compartilham: onde o template mora,
//! qual projeto o argv nomeia, e como um doc fixo vai pro disco.
//!
//! Lib, não comando — sem `main` e importada por `new.ts`/`normalize.ts`, então
//! @src/cli/core/scan.ts não a expõe como subverbo.
//!
//! Existe porque `new.ts` e `normalize.ts` carregavam ~21 linhas de prólogo
//! idêntico, e `TPL` apontava pra `03_resources/templates/system/system_design`
//! nos DOIS — o caminho que sai de sincronia quando o template muda de casa, e
//! só falha em runtime. Mesmo padrão de `tasks/model.ts`, `sprints/model.ts` e
//! `projects/model.ts`.
//!
//! Os DOIS templates entram por caminho inteiro, e não pela pasta: `DOCS_FIXOS`
//! abaixo lê exatamente estes dois arquivos, e citar só a pasta os fazia ler como
//! ÓRFÃOS no `my check resources` enquanto sustentavam o comando inteiro.
//!
//! depends_on: 03_resources/templates/system/system_design/big_picture.md · 03_resources/templates/system/system_design/layers.md · src/shared/template.ts
//! impacts:    src/system_design/new.ts · src/system_design/normalize.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { home, template } from "../shared/file.ts";
import { doTemplate } from "../shared/template.ts";

export const RAIZ = home();
export const PROJETOS = join(RAIZ, "01_projects");
export const TPL = template("system/system_design");

/** Os DOIS docs fixos, na ordem em que são escritos: nome no destino ← nome no
 *  template. `NN_system_design_<fluxo>.md` (02 em diante) não entra aqui de
 *  propósito — o corte de fluxo é julgamento, e nenhum comando o faz sozinho. */
export const DOCS_FIXOS: ReadonlyArray<readonly [string, string]> = [
	["00_system_design_big_picture.md", "big_picture.md"],
	["01_system_design_layers.md", "layers.md"],
];

export const morre = (msg: string): never => {
	console.error(msg);
	process.exit(1);
};

/** O projeto que o argv nomeia, já conferido no disco — ou morre com o `uso:`.
 *
 *  A validação mora aqui e não em cada comando porque a mensagem de erro é
 *  parte do contrato do verbo: dois textos pra mesma falha é o que faz o humano
 *  achar que são dois problemas. */
export function projetoDoArgv(uso: string): { slug: string; projeto: string } {
	const slug = process.argv[2];
	if (!slug) morre(`uso: my system_design ${uso} <slug-do-projeto>`);
	const projeto = join(PROJETOS, slug);
	if (!existsSync(projeto)) morre(`projeto não existe: 01_projects/${slug}/`);
	return { slug: slug!, projeto };
}

export function docsDe(projeto: string): string {
	const docs = join(projeto, "docs");
	mkdirSync(docs, { recursive: true });
	return docs;
}

/** Escreve um doc fixo, e devolve `false` se ele JÁ existia — nunca sobrescreve.
 *
 *  O que fazer com o `false` é do chamador, e é onde os dois comandos divergem:
 *  `new` morre (o verbo promete criar), `normalize` pula e reporta (o verbo
 *  promete propor). Um booleano em vez de um parâmetro "morre vs pula" porque a
 *  decisão é a única coisa diferente entre eles — e ela cabe no `if` de quem
 *  chama, sem virar flag. */
export function escreveDoc(docs: string, arquivo: string, tplNome: string): boolean {
	const destino = join(docs, arquivo);
	if (existsSync(destino)) return false;
	writeFileSync(destino, doTemplate(readFileSync(join(TPL, tplNome), "utf8"), "system_design"));
	return true;
}
