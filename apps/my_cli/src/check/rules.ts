//! Toda regra está na pasta que o `TYPE:` dela nomeia, e cada slug existe uma vez só?
//!
//!   bun run src/check/rules.ts            # the verdict (or `my check rules`)
//!   bun run src/check/rules.ts --json     # --json | --jsonl | --tsv
//!   bun run src/check/rules.ts --fix      # plan the moves
//!   bun run src/check/rules.ts --fix --write
//!
//!   --json → { regras:int · fora_do_lugar:int · findings:[…] }
//!            catraca: rules.fora_do_lugar = fora_do_lugar — ABSOLUTA (teto 0)
//!
//! The rules left META.md on 17/08 and became one file each under
//! `03_resources/rules/<type>/<slug>.md`. That move bought a cheap fetch and sold
//! a second source: the family is now written TWICE — once in the path, once in
//! the `TYPE:` line that `meta.ts#type` reads. This file is the price of that,
//! and it is the whole reason the split is allowed to stand.
//!
//! The second assertion is not decoration: a task cites `#worktree_and_staging`
//! and `meta.ts#find` resolves by name across the tree. Two files with the same
//! basename in different families would make the citation land on whichever the
//! sort put first — silently, and differently after a rename.
//!
//! depends_on: src/meta.ts · 03_resources/rules · src/shared/findings.ts
//! impacts:    src/check/all.ts

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { emit } from "../shared/findings.ts";
import { home } from "../shared/file.ts";

const ROOT = home();
const RULES = join(ROOT, "03_resources", "rules");

const argv = Bun.argv.slice(2);
const wantsFix = argv.includes("--fix");
const wantsWrite = argv.includes("--write");

/** `TYPE: execution` — the same read `meta.ts#type` does, kept in one shape. */
const typeOf = (body: string) => body.split("\n").find((l) => l.startsWith("TYPE:"))?.slice(5).trim() ?? "";

if (!existsSync(RULES)) {
  console.log("03_resources/rules/ não existe — nada a checar");
  process.exit(0);
}

const files = readdirSync(RULES, { recursive: true }).filter(
  (f): f is string => typeof f === "string" && f.endsWith(".md"),
);

type Finding = { file: string; message: string; to?: string };
const findings: Finding[] = [];
const seen = new Map<string, string>();

for (const rel of files.sort()) {
  const slug = rel.slice(rel.lastIndexOf("/") + 1, -3);
  const folder = rel.includes("/") ? rel.slice(0, rel.indexOf("/")) : "";
  const declared = typeOf(readFileSync(join(RULES, rel), "utf8"));

  const twin = seen.get(slug);
  if (twin) findings.push({ file: rel, message: `slug repetido: já existe em ${twin}` });
  seen.set(slug, rel);

  if (!declared) findings.push({ file: rel, message: "sem linha TYPE:" });
  else if (declared !== folder) {
    findings.push({ file: rel, message: `TYPE: ${declared} mas está em ${folder || "(raiz)"}/`, to: `${declared}/${slug}.md` });
  }
}

// `--fix` MOVE arquivo, então ele roda FORA do `emit`: escrever no disco não é
// formato de saída, e um `--fix --json` que renomeasse em silêncio seria pior que um
// que não faz nada. O log de cada movimento, porém, sai no MEIO da saída humana —
// entre os achados e o total, exatamente onde saía antes — porque a catraca lê essa
// saída e ordem trocada é diff que ninguém pediu.
const moved = wantsFix
  ? findings
      .filter((f) => f.to)
      .map((f) => {
        if (wantsWrite) {
          const dest = join(RULES, f.to!);
          mkdirSync(dirname(dest), { recursive: true });
          renameSync(join(RULES, f.file), dest);
        }
        return `  ${wantsWrite ? "movido" : "mover"}: ${f.file} → ${f.to}`;
      })
  : [];

process.exit(
  emit(argv, {
    json: { regras: files.length, fora_do_lugar: findings.length },
    findings,
    cols: (f) => [f.file, f.message, f.to],
    human: () => {
      for (const f of findings) console.log(`03_resources/rules/${f.file}: error · ${f.message}`);
      for (const line of moved) console.log(line);
      console.log(`${files.length} regras · ${findings.length} fora do lugar`);
    },
  }),
);
