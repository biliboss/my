//! The check of the measures: a hand-built `.jsonl` transcript with KNOWN answers,
//! so the arithmetic is asserted instead of eyeballed — against a fixture, never a
//! real session or a real repo.
//!
//! The `amostrasDeEventos` block that opened this file died on 19/08 with the
//! function it tested. That reader parsed `_events/<verbo>_completed__<slug>/`, and
//! `_events/` was deleted on 17/08 — so the import at the top resolved to nothing and
//! **the whole file stopped loading**, taking the five `claude-session` tests below
//! down with it. They had not run since.
//!
//! A module-load failure prints `# Unhandled error between tests`, which the
//! ratchet's `/^\(fail\)/` regex did not match — measured 19/08, and fixed in
//! @src/check/ratchet.ts in the same commit as this. A dead test that fails LOUDLY is
//! a bug; one that fails silently is the reason nobody knew.

import { afterAll, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SCRIPT = join(import.meta.dir, "metrics.ts");

// =============================================================================
// claude-session — o subcomando que decompõe o .jsonl do Claude Code
// =============================================================================

const FAKE_HOME = join(tmpdir(), `metrics-home-${Date.now()}`);
const SESSAO = "11111111-2222-3333-4444-555555555555";

const turno = (iso: string, nome: string, input: object) =>
  JSON.stringify({ timestamp: iso, message: { content: [{ type: "tool_use", name: nome, input }] } });

// Linha do tempo desenhada: 0s Bash, 1s Read, e então 300s DE BURACO até o Edit.
// Total 310s. Escrita em +301s. Maior buraco = 300s, logo após o segundo Read.
const jsonl = [
  turno("2026-08-14T12:00:00Z", "Bash", { command: "ls" }),
  turno("2026-08-14T12:00:01Z", "Read", { file_path: "/a" }),
  turno("2026-08-14T12:05:01Z", "Edit", { file_path: "/b" }),
  turno("2026-08-14T12:05:10Z", "mcp__claude-in-chrome__navigate", { url: "x" }),
  "", // linha vazia: o parser tem que sobreviver a ela
  turno("2026-08-14T12:05:10Z", "mcp__claude-in-chrome__computer", { action: "screenshot" }),
].join("\n");

const dir = join(FAKE_HOME, ".claude/projects/-fake-repo");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${SESSAO}.jsonl`), jsonl);

const exec = async (args: string[]) => {
  const p = Bun.spawn(["bun", "run", SCRIPT, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HOME: FAKE_HOME },
  });
  return { out: await new Response(p.stdout).text(), err: await new Response(p.stderr).text(), code: await p.exited };
};

test("acha a sessão pelo uuid e soma o total", async () => {
  const { out, code } = await exec(["claude-session", "--session", SESSAO, "--json"]);
  expect(code).toBe(0);
  const j = JSON.parse(out);
  expect(j.total_s).toBe(310);
  expect(j.calls).toBe(5);
});

test("os 12 verbos de browser viram UMA família", async () => {
  const j = JSON.parse((await exec(["claude-session", "--session", SESSAO, "--json"])).out);
  expect(j.familias.browser.calls).toBe(2);
  expect(j.familias["mcp:claude-in-chrome"]).toBeUndefined();
});

test("o BURACO é achado, e no lugar certo", async () => {
  const j = JSON.parse((await exec(["claude-session", "--session", SESSAO, "--json"])).out);
  expect(j.maior_buraco.s).toBe(300);
  expect(j.maior_buraco.depois).toBe("Read");
});

test("o arranque é o tempo até a primeira ESCRITA, não até a primeira call", async () => {
  const j = JSON.parse((await exec(["claude-session", "--session", SESSAO, "--json"])).out);
  expect(j.arranque_s).toBe(301);
});

// CONTROLE NEGATIVO: sessão que não existe tem que FALHAR, não devolver zeros.
// Um relatório de zeros passa despercebido; um erro, não.
test("sessão inexistente falha em vez de reportar vazio", async () => {
  const { code, err } = await exec(["claude-session", "--session", "00000000-0000-0000-0000-000000000000"]);
  expect(code).not.toBe(0);
  expect(err).toContain("não achada");
});

afterAll(() => {
  rmSync(FAKE_HOME, { recursive: true, force: true });
});
