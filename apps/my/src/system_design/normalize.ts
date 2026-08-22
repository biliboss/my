//! Projeto com `callstack.md`/`outline.md` soltos na raiz (a forma anterior)
//! ganha `docs/` — @03_resources/rules/design/system_design.md, seção
//! "Normalizar um projeto antigo".
//!
//!   my system_design normalize nimbus-v1
//!
//! PROPÕE, não decide sozinho: cria os dois docs fixos (vazios, prontos pra
//! preencher) e IMPRIME o que existe pra migrar — nunca corta fluxo em
//! `NN_system_design_<fluxo>.md` sozinho, porque esse corte é julgamento
//! (mesma régua de `callstack_notation` sobre corte de seção).
//!
//! O prólogo (raiz, template, validação do slug, o escritor) mora em
//! @src/system_design/model.ts, junto com `new.ts`.
//! depends_on: src/system_design/model.ts

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DOCS_FIXOS, docsDe, escreveDoc, projetoDoArgv } from "./model.ts";

const { slug, projeto } = projetoDoArgv("normalize");

const callstack = join(projeto, "callstack.md");
const outline = join(projeto, "outline.md");
const temCallstack = existsSync(callstack);
const temOutline = existsSync(outline);

if (!temCallstack && !temOutline) {
	console.log(`01_projects/${slug}/ não tem callstack.md nem outline.md na raiz — nada pra normalizar.`);
	console.log(`sem desenho nenhum ainda? my system_design new ${slug}`);
	process.exit(0);
}

const docs = docsDe(projeto);

const jaExiste: string[] = [];
const criado: string[] = [];

for (const [arquivo, tplNome] of DOCS_FIXOS)
	(escreveDoc(docs, arquivo, tplNome) ? criado : jaExiste).push(arquivo);

console.log(`01_projects/${slug}/docs/ pronto pra receber o split.`);
if (criado.length) console.log(`criado: ${criado.join(", ")}`);
if (jaExiste.length) console.log(`já existia, não sobrescrito: ${jaExiste.join(", ")}`);

console.log("\no que existe pra migrar (à MÃO — corte de fluxo é julgamento):");
if (temCallstack) {
	const secoes = readFileSync(callstack, "utf8")
		.split("\n")
		.filter((l) => l.startsWith("## "))
		.map((l) => l.replace(/^##\s+/, ""));
	console.log(`  callstack.md tem ${secoes.length} seção(ões) — cada uma vira candidata a NN_system_design_<fluxo>.md:`);
	secoes.forEach((s) => console.log(`    - ${s}`));
}
if (temOutline) console.log("  outline.md — o que é fase/gap/decisão vira prosa em 01_system_design_layers.md; o que é grafo de relação vira 00_system_design_big_picture.md.");
console.log(`\nquando docs/ cobrir tudo que importa, apague callstack.md/outline.md à mão — este comando não apaga nada.`);
