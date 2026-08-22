//! The check for the three moves: `pull`, `process` and `drop`.
//!
//! What hurts when it breaks is never the writing — it is the refusing. A human with
//! an editor silently answers an item twice, pulls something that is already out, or
//! drops a request with no reason and nothing complains. These tests are those
//! refusals, plus the one invariant the whole design rests on: THE STATE IS THE
//! PLACE, so every move has to actually move the folder.

import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main as pull } from "./pull.ts";
import { main as process_ } from "./process.ts";
import { main as drop } from "./drop.ts";

const NAME = "001_pedido_um";

/** An inbox with one item waiting in the backlog. */
function inbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "inbox-"));
  writeFileSync(join(dir, "CONTEXT.md"), "# t\n");
  mkdirSync(join(dir, "backlog", NAME), { recursive: true });
  writeFileSync(
    join(dir, "backlog", NAME, "CONTEXT.md"),
    "---\ntype: request\ncreated: 2026-08-20T09:00:00.000Z\n---\n\n# pedido um\n\ncorpo do pedido um\n",
  );
  return dir;
}

test("pull move a PASTA do backlog pro root — o estado é o lugar", async () => {
  const dir = inbox();
  expect(await pull([NAME, "--to", dir, "--quiet"])).toBe(0);

  expect(existsSync(join(dir, NAME, "CONTEXT.md"))).toBe(true);
  expect(existsSync(join(dir, "backlog", NAME))).toBe(false);
  // o pedido continua verbatim: mover não reescreve
  expect(readFileSync(join(dir, NAME, "CONTEXT.md"), "utf8")).toContain("corpo do pedido um");
});

test("pull --next pega o mais antigo pela DATA, não pelo nome", async () => {
  const dir = inbox();
  // o 002 chegou depois: `--next` tem que continuar entregando o 001.
  const novo = "002_pedido_dois";
  mkdirSync(join(dir, "backlog", novo));
  writeFileSync(
    join(dir, "backlog", novo, "CONTEXT.md"),
    "---\ntype: request\ncreated: 2026-08-21T10:00:00.000Z\n---\n\n# pedido dois\n",
  );

  expect(await pull(["--next", "--to", dir, "--quiet"])).toBe(0);
  expect(existsSync(join(dir, NAME))).toBe(true); // o de 20/08, não o de 21/08
  expect(existsSync(join(dir, "backlog", novo))).toBe(true);
});

test("pull no que já saiu do backlog é recusado", async () => {
  const dir = inbox();
  expect(await pull([NAME, "--to", dir, "--quiet"])).toBe(0);
  expect(await pull([NAME, "--to", dir, "--quiet"])).toBe(1);
});

test("process escreve DENTRO do item e move pra archive", () => {
  const dir = inbox();
  expect(process_([NAME, "--became", "01_projects/x/", "--to", dir])).toBe(0);

  const text = readFileSync(join(dir, "archive", NAME, "CONTEXT.md"), "utf8");
  expect(text).toContain("corpo do pedido um"); // o verbatim segue lá
  expect(text).toContain("`#processed` · virou 01_projects/x/");
  expect(existsSync(join(dir, "backlog", NAME))).toBe(false);
});

test("process vale direto do backlog, sem pull antes", () => {
  const dir = inbox();
  expect(process_([NAME, "--became", "x", "--to", dir])).toBe(0);
  expect(existsSync(join(dir, "archive", NAME))).toBe(true);
});

test("responder duas vezes é recusado — registro congelado", () => {
  const dir = inbox();
  expect(process_([NAME, "--became", "x", "--to", dir])).toBe(0);
  expect(process_([NAME, "--became", "y", "--to", dir])).toBe(1);
  expect(drop([NAME, "--reason", "z", "--to", dir])).toBe(1);
  // a primeira resposta continua sendo a que valeu
  const text = readFileSync(join(dir, "archive", NAME, "CONTEXT.md"), "utf8");
  expect(text).toContain("virou x");
  expect(text).not.toContain("virou y");
});

test("stamp que não existe é recusado, e nada é escrito", () => {
  const dir = inbox();
  expect(process_(["nao_existe", "--became", "x", "--to", dir])).toBe(1);
  expect(existsSync(join(dir, "archive"))).toBe(false);
});

test("drop arquiva com o porquê — recusa também é registro", () => {
  const dir = inbox();
  expect(drop([NAME, "--reason", "o herdr já faz isso", "--to", dir])).toBe(0);
  expect(readFileSync(join(dir, "archive", NAME, "CONTEXT.md"), "utf8")).toContain(
    "`#dropped` — o herdr já faz isso",
  );
});

test("uma pasta que não é inbox é recusada", () => {
  const dir = mkdtempSync(join(tmpdir(), "notinbox-"));
  expect(process_([NAME, "--became", "x", "--to", dir])).toBe(1);
});
