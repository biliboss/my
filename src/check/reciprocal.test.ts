//! The check of the check: a pair that closes must be silent, a half-declared edge
//! must be reported, and `--level error` must actually fail.
//!
//! It runs against the real repo instead of a fixture, on purpose: `reciprocal` shells
//! out to `citations`, which is rooted at the repo — faking a tree would mean faking
//! that call too, and then the test would be asserting on the mock.
//!
//! depends_on: src/check/reciprocal.ts
//! impacts:    —

import { expect, test } from "bun:test";
import { join } from "node:path";

const CHECK = join(import.meta.dir, "reciprocal.ts");

const run = async (args: string[] = []) => {
  const p = Bun.spawn(["bun", "run", CHECK, ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(p.stdout).text();
  return { out, code: await p.exited };
};

test("a closed pair is not reported", async () => {
  const { out } = await run(["--json"]);
  const { missing } = JSON.parse(out) as { missing: { expected: string }[] };
  // 004_notificar declares `impacts: … src/inbox/capture.ts`, and capture.ts
  // declares `depends_on: … 02_areas/00_workflows/02_system/003_notificar/CONTEXT.md`. That edge closes.
  expect(
    missing.some((m) => m.expected.includes("capture.ts should declare depends_on: 02_areas/00_workflows/02_system/003_notificar/CONTEXT.md")),
  ).toBe(false);
});

test("a half-declared edge is reported, pointing at the line", async () => {
  const { out } = await run(["--json"]);
  const { missing, edges } = JSON.parse(out) as { missing: { file: string; line: number }[]; edges: number };
  expect(edges).toBeGreaterThan(0);
  expect(missing.length).toBeGreaterThan(0);
  // Every finding must carry a real line, otherwise the output cannot be clicked.
  expect(missing.every((m) => m.line > 0)).toBe(true);
});

test("warn passes, error fails — the hook only reacts to error", async () => {
  expect((await run()).code).toBe(0);
  expect((await run(["--level", "error"])).code).toBe(1);
});

// Measured 20/08: `--fix --write` prepended a `---` block to `src/check/pre-commit`, an
// extensionless bash script, ABOVE its shebang. That file is symlinked as the repo's git
// hook, so every commit died with `---: command not found`. The slice below is the one
// that did it, and it stays in the test for that reason.
test("--write never writes frontmatter into a file that is not markdown", async () => {
  const hook = join(import.meta.dir, "pre-commit");
  const { out } = await run(["--fix", "--write", "--only", "src/check/**"]);
  expect(out).toContain("skipped: src/check/pre-commit");
  expect((await Bun.file(hook).text()).split("\n")[0]).toBe("#!/usr/bin/env bash");
});
