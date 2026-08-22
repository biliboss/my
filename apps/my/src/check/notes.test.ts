//! The check of the check: run `notes.ts` against a throwaway `03_resources/notes/` whose
//! right answers are known, and assert the verdict.
//!
//! Negative fixture is `Untitled-1.md` on purpose — the exact editor-default
//! name that sat unenforced in this repo's real `03_resources/notes/` until issue #16.
//!
//! depends_on: src/check/notes.ts
//! impacts:    —

import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHECK = join(import.meta.dir, "notes.ts");

/** A `03_resources/notes/` with one valid note, one CONTEXT.md (exempt), and one
 *  `Untitled-1.md` — the real, previously-unenforced break. */
function fixture() {
  const notes = mkdtempSync(join(tmpdir(), "notes-check-"));
  writeFileSync(join(notes, "CONTEXT.md"), "# notes\n");
  writeFileSync(join(notes, "2026-08-15T0731Z_alguma-ideia.md"), "# ideia\n");
  writeFileSync(join(notes, "Untitled-1.md"), "\n\nhttps://example.com\n");
  return notes;
}

const run = async (notes: string, ...args: string[]) => {
  const p = Bun.spawn(["bun", "run", CHECK, "--root", notes, ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(p.stdout).text();
  const err = await new Response(p.stderr).text();
  return { out: out + err, code: await p.exited };
};

test("flags Untitled-1.md and fails, leaves the properly-named note alone", async () => {
  const { out, code } = await run(fixture());
  expect(out).toContain("Untitled-1.md");
  expect(out).not.toContain("alguma-ideia.md: error");
  expect(code).toBe(1);
});

test("CONTEXT.md is exempt", async () => {
  const { out } = await run(fixture());
  expect(out).not.toContain("CONTEXT.md: error");
});

test("a 03_resources/notes/ with only well-named files passes", async () => {
  const notes = mkdtempSync(join(tmpdir(), "notes-check-clean-"));
  writeFileSync(join(notes, "2026-08-15T0731Z_alguma-ideia.md"), "# ideia\n");
  const { out, code } = await run(notes);
  expect(code).toBe(0);
  expect(out).toContain("0 03_resources/notes/ fora do contrato de ID");
});
