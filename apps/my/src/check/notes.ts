//! Todo arquivo de `03_resources/notes/` obedece o contrato de ID — `<timestamp>_<slug>.md`?
//!
//!   bun run src/check/notes.ts             # the whole 03_resources/notes/ folder
//!   bun run src/check/notes.ts <files…>     # only these (pre-commit's staged list)
//!   bun run src/check/notes.ts --json
//!   bun run src/check/notes.ts --root <dir> # notes.test.ts points this at a fixture
//!
//!   --json → { padrao:str · achados:[…] }
//!            catraca: notes.fora_do_contrato = achados.length
//!
//! 03_resources/notes/CONTEXT.md is explicit: one note = one file, ID is the timestamp
//! (`date -u +%Y-%m-%dT%H%MZ`), immutable, and it is what `[[wiki]]` links from
//! other notes point at. `03_resources/notes/` was the one folder in this repo with a rigid
//! name contract and zero enforcement — `03_resources/notes/Untitled-1.md` (editor default
//! name, no ID) sat there and `just check` stayed green. Found 15/08.
//!
//! `CONTEXT.md` itself is exempt: it is the map, not a note.
//!
//! depends_on: 03_resources/notes/CONTEXT.md · src/shared/argv.ts
//! impacts:    src/check/all.ts

import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { has, value } from "@biliboss/shared/argv";
import { home } from "../shared/file.ts";

const ROOT = home();

const ID_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{4}Z_.*\.md$/;


// `03_resources/notes` and not `notes`: the folder moved into `03_resources/` and this
// line did not, so `just check` died with ENOENT on every run — the check that
// guards the ID contract was itself the reason the gate was red. Found 18/08.
// `--root` aponta pra uma fixture; sem ele, a pasta real. Guardar o "veio de fora"
// separado do caminho importa: o relatório mostra caminho relativo ao REPO na
// execução normal e relativo à fixture quando `--root` manda, e colapsar os dois
// imprimiria `../../..` no teste.
const rootFlag = value("root");
const NOTES = rootFlag ?? join(ROOT, "03_resources", "notes");
const args = process.argv
  .slice(2)
  .filter((a, i, arr) => !a.startsWith("--") && arr[i - 1] !== "--root");

/** Every `.md` in `03_resources/notes/` (top-level, no subfolders by design), or only the
 *  ones named on the command line — same shape as `citations.ts`/`context.ts`. */
function targets(): string[] {
  const all = readdirSync(NOTES, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "CONTEXT.md")
    .map((e) => join(NOTES, e.name));

  if (args.length === 0) return all;

  const wanted = new Set(
    args.map((f) => (f.startsWith("/") ? f : join(ROOT, f))).filter((f) => f.startsWith(NOTES + "/")),
  );
  return all.filter((f) => wanted.has(f));
}

const achados = targets()
  .filter((f) => statSync(f).isFile())
  .filter((f) => !ID_PATTERN.test(relative(NOTES, f)))
  .map((f) => (rootFlag === undefined ? relative(ROOT, f) : relative(NOTES, f)))
  .sort();

if (has("json")) {
  console.log(JSON.stringify({ padrao: ID_PATTERN.source, achados }, null, 2));
} else if (achados.length === 0) {
  console.log("0 03_resources/notes/ fora do contrato de ID");
} else {
  for (const a of achados) {
    console.log(`${a}: error · nome não casa \\d{4}-\\d{2}-\\d{2}T\\d{4}Z_.*\\.md`);
  }
  console.log(`\n${achados.length} arquivo(s) em 03_resources/notes/ fora do contrato de ID`);
}

process.exit(achados.length ? 1 : 0);
