//! Cria `docs/00_system_design_big_picture.md` + `01_system_design_layers.md`
//! num projeto — a forma de @03_resources/rules/design/system_design.md.
//!
//!   my system_design new nimbus-v1
//!
//! Só escreve os DOIS docs fixos. `NN_system_design_<fluxo>.md` (02 em
//! diante) é sempre escrito à mão — o corte de fluxo é julgamento, a mesma
//! régua de `callstack_notation` sobre corte de seção.
//!
//! O prólogo (raiz, template, validação do slug, o escritor) mora em
//! @src/system_design/model.ts, junto com `normalize.ts`.
//! depends_on: src/system_design/model.ts

import { DOCS_FIXOS, docsDe, escreveDoc, morre, projetoDoArgv } from "./model.ts";

const { slug, projeto } = projetoDoArgv("new");
const docs = docsDe(projeto);

for (const [arquivo, tplNome] of DOCS_FIXOS) {
	if (!escreveDoc(docs, arquivo, tplNome)) morre(`já existe: 01_projects/${slug}/docs/${arquivo}`);
	console.log(`01_projects/${slug}/docs/${arquivo}`);
}

console.log("o esqueleto está lá; NN_system_design_<fluxo>.md (02+) é à mão, um por fluxo que merece desenho.");
console.log(`callstack.md/outline.md soltos? my system_design normalize ${slug}`);
