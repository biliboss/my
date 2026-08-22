//! Todo `CONTEXT.md` continua MAPA e não documento — no máximo 100 linhas?
//!
//!   bun run src/check/context.ts             # the whole repo
//!   bun run src/check/context.ts <files…>     # only these (pre-commit's staged list)
//!   bun run src/check/context.ts --fix        # same list, framed as "cut N lines"
//!   bun run src/check/context.ts --json
//!
//!   --json → { teto:int · achados:[{file,linhas}] }
//!            catraca: context.acima_do_teto = achados.LENGTH — não existe chave `acima_do_teto`
//!
//! No `--fix --write`: cutting a map down to size is a judgment call about what stays
//! and what moves to `03_resources/references/` or a sibling file — there is no automatic rewrite
//! for that. `--fix` here is the same report, worded as the task at hand, and it stops.
//!
//! Ten `CONTEXT.md` already exceed 100 lines the day this check is born, some by a
//! lot (agent-sessions 420, 03_resources/templates/cockpit 401). They stay red ON PURPOSE — @CONTEXT.md
//! "O teto de 100 linhas": each is its own run, and red is what keeps them from being
//! forgotten. This check proves the number; it never decides where the overflow goes.
//!
//! depends_on: CONTEXT.md#o-teto-de-100-linhas · 03_resources/references/scripts/system/CONTEXT.md · src/shared/argv.ts
//! impacts:    src/check/all.ts

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { has } from "@my/shared/argv";
import { home } from "../shared/file.ts";

const ROOT = home();
const TETO = 100;

const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));

// Same skip list as `citations.ts`: not source, or history that is frozen by design
// and would only add noise `--fix` can never resolve.
const SKIP_DIRS = new Set([".git", "node_modules", ".bookmarks", "_events", "worktrees"]);

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name === "CONTEXT.md") yield p;
  }
}

/** All CONTEXT.md on disk, or only the ones named on the command line — pre-commit
 *  passes its staged file list here, same shape as `citations.ts` and `gates.ts`. */
function targets(): string[] {
  if (files.length === 0) return [...walk(ROOT)];
  return files
    .map((f) => (f.startsWith("/") ? f : join(ROOT, f)))
    .filter((f) => f.endsWith("CONTEXT.md") && statSync(f, { throwIfNoEntry: false })?.isFile());
}

type Achado = { caminho: string; linhas: number; excede: number };

/** Quantas linhas o arquivo TEM — e `split("\n").length` não responde isso.
 *
 *  Um arquivo POSIX termina em `\n`, então `"a\nb\n".split("\n")` devolve
 *  `["a","b",""]`: três elementos para duas linhas. A contagem crua somava 1 em
 *  TODO arquivo bem-formado, e o efeito era um teto de 99 vestido de 100 —
 *  medido 20/08, nove `CONTEXT.md` com exatamente 100 linhas apareciam como
 *  `101 linhas, 1 acima do teto`.
 *
 *  O teste não pegava porque a fixture montava o conteúdo com `join("\n")`, que
 *  NÃO deixa quebra final: ela media um arquivo que o disco real não produz. */
const contaLinhas = (texto: string): number => {
  const partes = texto.split("\n");
  return partes.at(-1) === "" ? partes.length - 1 : partes.length;
};

const achados: Achado[] = [];
for (const f of targets()) {
  const linhas = contaLinhas(readFileSync(f, "utf8"));
  if (linhas > TETO) achados.push({ caminho: relative(ROOT, f), linhas, excede: linhas - TETO });
}
achados.sort((a, b) => b.excede - a.excede);

if (has("json")) {
  console.log(JSON.stringify({ teto: TETO, achados }, null, 2));
} else if (achados.length === 0) {
  console.log(`0 CONTEXT.md acima de ${TETO} linhas`);
} else {
  const rotulo = has("fix") ? "corte" : "error";
  for (const a of achados) {
    console.log(`${a.caminho}:${TETO}: ${rotulo} · ${a.linhas} linhas, ${a.excede} acima do teto`);
  }
  console.log(`\n${achados.length} CONTEXT.md acima de ${TETO} linhas`);
}

process.exit(achados.length ? 1 : 0);
