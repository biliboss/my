//! What every script in this house does the same way: find the repo, name a thing
//! from human text, read a piped body.
//!
//! Three primitives, and each is here because it ALREADY had two callers — not
//! because one day it might. Before this, `inbox.ts` and `notificar.ts` carried
//! them copy-pasted, and the comment on each copy said "same lock as the other
//! script", which is duplication announcing itself.
//!
//! What does NOT belong here: clipboard, `herdr pane send-text`, request-line
//! assembly. Each has exactly ONE caller today, and a primitive with one caller
//! is an abstraction invented ahead of need.
//!
//! `createWithoutCollision` and `suffixed` lived here until 20/08 and went out
//! whole with the inbox that needed them: an inbox is a folder with a `CONTEXT.md`
//! now (@01_projects/inbox-v1/docs/00_system_design_big_picture.md), the item is a
//! section appended to it, and appends do not collide. The atomic-create lock they
//! carried was real — it was born of three duplicated notifications on 13/08 — but
//! a lock with zero callers is dead code that reads like policy.
//!
//! depends_on: —
//! impacts:    src/inbox/capture.ts · src/check/citations.ts · src/system_design/model.ts · src/CONTEXT.md
//!
//! `depends_on` is empty on purpose and that is a claim, not an omission: a shared
//! primitive that needs something from this repo is not shared, it is coupled. The
//! `impacts` list IS the two-caller rule from 02_areas/design/010 made checkable — the day
//! it has one entry, this file should be inlined back into its only caller.

import { existsSync, fstatSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The root of this checkout, found by ANCHOR and never by counting `../`.
 *
 * Ten files carried `join(import.meta.dir, "../..")` — and one of them carried
 * `"../../.."`, because it sat one level deeper. That arithmetic is a bug waiting for
 * whoever moves a file: the count is silently wrong and only fails at runtime, in a
 * path that does not exist. Measured 18/08, and written into `check/notes.ts` by the
 * person it bit: `03_resources/notes` moved and the `../..` did not, so `just check`
 * died with ENOENT on every run — the check that guards the ID contract was itself
 * the reason the gate was red.
 *
 * Walking UP to the directory that holds `.git` survives the move, because the answer
 * stops depending on where the asker sits. `.git` and not `CLAUDE.md`: a worktree
 * (`git worktree add`) has `.git` as a FILE, not a directory, and this house measures
 * against HEAD in a worktree — `existsSync` accepts both, so the same call works there.
 *
 * Throws instead of guessing. A wrong root writes real files into a wrong place, and
 * this is called at module load, so the failure is loud and immediate.
 */
export function repoRoot(from = import.meta.dir): string {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, ".git"))) return dir;
    if (dirname(dir) === dir) throw new Error(`não achei a raiz do repo (nenhum .git de ${from} pra cima)`);
  }
}

/** A CASA e o CHECKOUT, reexportados de `home/paths.ts`.
 *
 *  UMA IMPLEMENTAÇÃO SÓ, e isto é a regra de migração do @CLAUDE.md aplicada em
 *  miniatura: `home()` nasceu AQUI em 20/08, ganhou um contrato próprio no mesmo dia
 *  (@src/interfaces/home.ts) e a cópia daqui foi embora no mesmo fôlego. Duas funções
 *  com o mesmo nome e o mesmo trabalho divergem na primeira mudança, e a que diverge
 *  é sempre a que alguém esqueceu.
 *
 *  A REEXPORTAÇÃO FICA porque dezenove arquivos já importam daqui, e trocar o import
 *  de todos eles no mesmo commit da mudança de semântica faria o diff esconder a
 *  mudança. `home/paths.ts` é o endereço novo; este é o encaminhamento. */
export { code as repoRootOf, root as home, trees } from "../home/paths.ts";

/** A filename from human text: lowercase, unaccented, hyphenated, first six words.
 *
 *  Six words are enough to find the file in the sidebar, and the cut exists
 *  because whoever drops a request will not stop to name it — `request-3.md` says
 *  nothing, and a 200-character slug says nothing either. */
export const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-")
    .slice(0, 48) || "request";

/**
 * The body piped in on stdin, or an empty string when nothing was piped.
 *
 * `!isTTY` is NOT enough, and the symptom misleads: run by a harness that hands
 * down an open fd 0 with no writer, `text()` waits forever, and the script looks
 * stuck on its LAST line (this was misdiagnosed as a herdr bug on 14/08).
 * `fstat` on fd 0 tells a pipe/file apart from "open and nobody will write".
 */
export async function readStdin(): Promise<string> {
  try {
    const st = fstatSync(0);
    if (st.isFIFO() || st.isFile()) return await Bun.stdin.text();
  } catch {
    /* no usable stdin: the body comes from argv, which is the normal case */
  }
  return "";
}
