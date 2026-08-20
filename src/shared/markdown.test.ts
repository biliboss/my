//! `typeOf` é uma TABELA ORDENADA, e o bug mora sempre na ordem.
//!
//! Cada subpasta de `03_resources/` que tem espécie própria (`notes/`, `templates/`,
//! `rules/`, `meetings/`) precisa vir ANTES do catch-all `03_resources/ → resource`,
//! senão a regra nunca é alcançada e o check acusa o arquivo de divergir dele.
//! Medido 20/08: `meetings/` faltava, e 39 atas que declaravam `type: meeting` eram
//! a maioria do bucket `divergente`.
//!
//! depends_on: src/shared/markdown.ts
//! impacts:    —

import { expect, test } from "bun:test";
import { typeOf } from "./markdown.ts";

test("a subpasta com espécie própria ganha da catch-all de 03_resources/", () => {
	expect(typeOf("03_resources/meetings/2026-08-03_daily_he.md")).toBe("meeting");
	expect(typeOf("03_resources/notes/2026-08-14T0111Z_okf.md")).toBe("note");
	expect(typeOf("03_resources/templates/call_stack.md")).toBe("template");
	expect(typeOf("03_resources/rules/design/system_design.md")).toBe("rule");
});

test("o que não tem casa própria em 03_resources/ continua resource", () => {
	expect(typeOf("03_resources/project/research.md")).toBe("resource");
});

// A regra da pasta vence a regra de `CONTEXT.md$`, que é a última da tabela — então o
// mapa da pasta declara a espécie da pasta. É o que `03_resources/notes/CONTEXT.md`
// já fazia (`type: note`) antes de `meetings/` existir, e a ata seguiu o mesmo.
test("o CONTEXT.md de uma pasta com espécie própria herda a espécie", () => {
	expect(typeOf("03_resources/meetings/CONTEXT.md")).toBe("meeting");
	expect(typeOf("03_resources/notes/CONTEXT.md")).toBe("note");
});
