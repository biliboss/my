//! The check of the check: `my references <nome>` dentro de uma referência é achado —
//! e as quatro coisas que PARECEM achado e não são.
//!
//! Contra uma árvore descartável em `tmpdir()`, nunca dentro de `src/`: o índice de
//! @src/references.ts varre um diretório inteiro, e cinco sessões escrevem em `src/`
//! neste segundo.
//!
//! depends_on: src/check/references.ts
//! impacts:    —

import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { achados } from "./references.ts";

/** Uma casa de mentira com quatro referências, e uma delas cheia de armadilha. */
function fixture(): string {
	const raiz = mkdtempSync(join(tmpdir(), "check-refs-"));
	const dir = join(raiz, "02_areas/00_workflows/00_main/references");
	mkdirSync(dir, { recursive: true });

	writeFileSync(join(dir, "out_tasks.md"), "---\ntype: reference\n---\n\n# out_tasks\n\nsozinha.\n");
	writeFileSync(join(dir, "qa_driver.md"), "---\ntype: reference\n---\n\n# qa_driver\n\nsozinha.\n");
	writeFileSync(
		join(dir, "in_tasks.md"),
		[
			"---",
			"type: reference",
			"---",
			"",
			"# in_tasks",
			"",
			"o outro lado é `my references out_tasks`.", // ACHADO
			"",
			"quem pede as duas escreve assim:",
			"```bash",
			"my references qa_driver", // fence: exemplo de sintaxe, não travessia
			"```",
			"",
			"e pra pedir ESTA: `my references in_tasks`.", // a si mesma
			"",
			"o comando aceita nome livre: `my references nao_existe_no_indice`.", // fora do índice
			"",
		].join("\n"),
	);
	// CONTEXT.md ROTEIA — é o trabalho dele, e ele não é referência.
	writeFileSync(join(dir, "..", "CONTEXT.md"), "---\ntype: context\n---\n\n`my references out_tasks qa_driver`\n");
	return raiz;
}

test("uma referência citando OUTRA é achado, e é o único da fixture", () => {
	const raiz = fixture();
	const found = achados(raiz).map((a) => ({ cita: a.cita, file: a.file }));

	expect(found).toHaveLength(1);
	expect(found[0]!.cita).toBe("out_tasks");
	expect(found[0]!.file).toContain("in_tasks.md");
	rmSync(raiz, { recursive: true, force: true });
});

// CONTROLE NEGATIVO, e é ele que segura o check: sem estas quatro exclusões o número
// vira ruído e ninguém lê a lista até o fim.
test("fence, auto-citação, nome fora do índice e CONTEXT.md NÃO são achado", () => {
	const raiz = fixture();
	const citados = achados(raiz).map((a) => a.cita);

	expect(citados).not.toContain("qa_driver"); // dentro de ```bash
	expect(citados).not.toContain("in_tasks"); // a si mesma
	expect(citados).not.toContain("nao_existe_no_indice"); // não está no índice
	// O `CONTEXT.md` cita duas e não pode aparecer: rotear é o trabalho dele.
	expect(achados(raiz).map((a) => a.file).join(" ")).not.toContain("CONTEXT.md");
	rmSync(raiz, { recursive: true, force: true });
});
