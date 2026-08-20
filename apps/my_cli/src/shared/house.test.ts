//! A DESCOBERTA POR FORMA, com controle positivo e negativo.
//!
//! Existe porque hoje `house.check()` devolve `{}` — nenhum sistema exporta `check`
//! ainda — e um `{}` de varredura correta é idêntico a um `{}` de varredura quebrada.
//! O controle positivo é a única coisa que separa os dois.
//!
//! depends_on: src/shared/house.ts

import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDe, modulos } from "./house.ts";

const fixture = (nome: string, fonte: string): string => {
	const f = join(mkdtempSync(join(tmpdir(), "house-")), nome);
	writeFileSync(f, fonte);
	return f;
};

test("CONTROLE POSITIVO: um módulo que exporta `check()` é achado, e o achado dele passa", () => {
	const f = fixture("bom.ts", `export function check() { return [{ path: "a/b.md", says: "podre" }]; }\n`);
	expect(checkDe(f)?.()).toEqual([{ path: "a/b.md", says: "podre" }]);
});

test("CONTROLE NEGATIVO: sem `check` exportado, e um `check` que não é função, não contam", () => {
	expect(checkDe(fixture("sem.ts", `export const outra = 1;\n`))).toBeUndefined();
	expect(checkDe(fixture("nao_fn.ts", `export const check = 42;\n`))).toBeUndefined();
});

test("módulo que nem carrega não derruba a varredura — não declara check, e pronto", () => {
	expect(checkDe(fixture("quebrado.ts", `import "vscode";\nexport function check() { return []; }\n`))).toBeUndefined();
});

test("os sistemas saem do disco: pasta de `src/`, sem `interfaces/` nem `*.test.ts`", () => {
	const sistemas = new Set(modulos().map((m) => m.system));
	expect(sistemas.has("check")).toBe(true);
	expect(sistemas.has("shared")).toBe(true);
	expect(sistemas.has("interfaces")).toBe(false);
	expect(modulos().some((m) => m.file.endsWith(".test.ts"))).toBe(false);
});
