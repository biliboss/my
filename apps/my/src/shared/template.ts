//! Um template do disco vira o arquivo que nasce da geração.
//!
//! Existe porque três geradores — @src/projects/new.ts, @src/sprints/new.ts e
//! @src/shared/work/new.ts — carregavam a MESMA linha copiada
//! (`s.replace(/^<!--[\s\S]*?-->\n+/, '')`), e ela passou a estar errada nos três
//! no mesmo dia: em 18/08 todo markdown desta casa ganhou frontmatter OKF, e um
//! strip que só conhece comentário HTML deixa o `type: template` do MOLDE vazar
//! pro arquivo gerado — que aí declara ser template e não é.
//!
//! `shared/` e não uma quarta cópia: a regra desta pasta é primitiva com DOIS
//! chamadores, e esta tem três.
//!
//! depends_on: 03_resources/templates/system/
//! impacts:    src/projects/new.ts · src/sprints/new.ts · src/shared/work/new.ts · src/system_design/model.ts

/** Só o que o STAMPER escreve: um bloco de frontmatter com `type:` e nada mais.
 *
 *  A precisão aqui é o que separa "tirar o carimbo do molde" de "apagar o
 *  frontmatter do arquivo gerado": o template de projeto carrega um bloco
 *  `---\nprojeto: <slug>\narea: …\n---` que é o frontmatter de QUEM NASCE, e um
 *  strip guloso de `^---…---` levaria os cinco campos que o gerador preenche
 *  depois — calado, e o projeto nasceria sem área e sem dono. */
const CARIMBO = /^---\n(type:[^\n]*\n)---\n+/;

/** O corpo do template, sem o que é do MOLDE, com o `type` de quem NASCE.
 *
 *  Sai da frente, nesta ordem, porque é nesta ordem que estão no arquivo:
 *
 *  1. o carimbo OKF do próprio template (`type: template`) — o gerado tem tipo
 *     próprio, e herdar este diria que todo projeto é um molde;
 *  2. o bloco `<!-- TEMPLATE … -->`, que é a REGRA da forma e mora no molde.
 *     Repetido em cada arquivo gerado ele vira ruído que ninguém lê duas vezes.
 *
 *  E o `type` entra: no frontmatter que o molde já traz, como PRIMEIRA chave, ou
 *  num bloco novo se não houver nenhum. Nunca um segundo bloco — dois
 *  frontmatters é um documento que nenhum parser lê inteiro.
 *
 *  `type` é obrigatório de propósito: é o único campo que o OKF exige
 *  (@03_resources/notes/2026-08-14T0111Z_okf-so-obriga-o-type-o-resto-e-recomendacao.md),
 *  e gerar arquivo sem ele seria criar, a cada projeto novo, mais um markdown
 *  fora do contrato que o resto da casa acabou de cumprir. */
export function doTemplate(body: string, type: string): string {
	const semCarimbo = body.replace(CARIMBO, "");
	const semCabecalho = semCarimbo.replace(/^<!--[\s\S]*?-->\n+/, "");
	return semCabecalho.startsWith("---\n")
		? `---\ntype: ${type}\n${semCabecalho.slice(4)}`
		: `---\ntype: ${type}\n---\n\n${semCabecalho}`;
}

if (import.meta.main) {
	const t = (body: string, type: string) => doTemplate(body, type);
	// 1. A forma REAL dos templates desta casa: comentário primeiro, e depois o
	//    frontmatter de quem nasce. O `type` entra nele, e os campos ficam.
	const real = "<!--\nTEMPLATE — a regra da forma\n-->\n\n---\nprojeto: <slug>\ndono: <nome>\n---\n\n# <título>\n";
	const feito = t(real, "project");
	console.assert(feito === "---\ntype: project\nprojeto: <slug>\ndono: <nome>\n---\n\n# <título>\n", `1 falhou:\n${feito}`);
	console.assert(!feito.includes("TEMPLATE —"), "1: o comentário do molde vazou");
	console.assert(feito.split("---\n").length === 3, "1: nasceram dois frontmatters");
	// 2. O mesmo molde depois de carimbado por 18/08 — o carimbo sai, o resto igual.
	console.assert(t(`---\ntype: template\n---\n\n${real}`, "project") === feito, "2: o carimbo do molde vazou");
	// 3. Molde sem frontmatter nenhum: ganha um bloco novo.
	console.assert(t("<!--\nx\n-->\n\n# t\n", "task") === "---\ntype: task\n---\n\n# t\n", "3 falhou");
	// 4. Molde pelado.
	console.assert(t("# t\n", "sprint") === "---\ntype: sprint\n---\n\n# t\n", "4 falhou");
	// 5. O CONTROLE NEGATIVO: um bloco que NÃO é o carimbo não pode ser removido.
	//    Sem `CARIMBO` sendo estrito, este teste perde `projeto:` e `dono:`.
	const semComentario = "---\nprojeto: <slug>\ndono: <nome>\n---\n\n# t\n";
	console.assert(t(semComentario, "project").includes("projeto: <slug>"), "5: o strip comeu o frontmatter do gerado");
	console.log("ok · doTemplate (5 casos, com controle negativo)");
}
