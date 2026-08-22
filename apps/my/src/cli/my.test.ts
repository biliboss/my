//! A REGRA da primeira tela: todo verbo de topo tem frase própria.
//!
//! Pasta aninhada pode ficar sem `@verb` — o help dela é o que se abre depois
//! de já saber o que se procura. A de TOPO não: `my --help` é a vitrine, e
//! `3 subcomandos` ali é contagem no lugar da descrição. Foi o que a medição de
//! 22/08 achou em oito verbos, e justo nos centrais (`chat`, `stages`, `a2a`,
//! `streams`, `processes`, `kanban`, `events`, `company`).
//!
//! Lido do FONTE de `my.ts`, nunca importando: importar `my.ts` RODA a CLI.

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { scan } from "./core/scan";

const SOURCE = readFileSync(`${import.meta.dir}/my.ts`, "utf8");
const DESCRIBED = new Set([...SOURCE.matchAll(/@verb\([^)]*\)\s*"?([\w/]+)"?\(\)/g)].map((m) => m[1]!));

test("todo verbo de TOPO tem frase própria — nenhum cai em `N subcomandos`", () => {
  const bare = scan()
    .filter((n) => !n.file)
    .map((n) => n.name)
    .filter((name) => !DESCRIBED.has(name));
  expect(bare).toEqual([]);
});

test("`@verb` sem pasta no disco não vira comando, e o teste acusa a frase órfã", () => {
  const onDisk = new Set(scan().map((n) => n.name));
  const orphans = [...DESCRIBED].filter((key) => !key.includes("/") && !onDisk.has(key));
  expect(orphans).toEqual([]);
});
