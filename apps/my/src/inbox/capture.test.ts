//! The check for `inbox/capture`: the request becomes a FOLDER in the backlog, its
//! name is the identity, and a second capture never eats the first.
//!
//! A bad name is found late (the item is there, it just says nothing in the
//! sidebar); a collision LOSES a request — and the stamp is what every file of that
//! item is named after, so two items sharing one is not a cosmetic problem.

import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { slug } from "../shared/file.ts";

const script = join(import.meta.dir, "capture.ts");

/** Runs the real script against a throwaway inbox. */
const capture = async (dir: string, ...args: string[]) =>
  await Bun.$`bun run ${script} ${args}`.env({ ...process.env, INBOX_DIR: dir }).quiet().nothrow();

/** An inbox is a folder with a CONTEXT.md — same shape as the house one. */
function inbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "inbox-"));
  writeFileSync(join(dir, "CONTEXT.md"), "# test inbox\n");
  return dir;
}

const backlog = (dir: string) => readdirSync(join(dir, "backlog")).sort();

test("the name comes from the text: unaccented, hyphenated, six words", () => {
  expect(slug("Arrumar a organização do cockpit hoje de manhã, por favor")).toBe(
    "arrumar-a-organizacao-do-cockpit-hoje",
  );
  // text that leaves nothing behind still needs a name
  expect(slug("!!!  ")).toBe("request");
});

test("o pedido vira PASTA no backlog, nomeada pelo que ele é", async () => {
  const dir = inbox();
  await capture(dir, "primeiro pedido");

  expect(backlog(dir)).toEqual(["001_primeiro_pedido"]);
  const text = readFileSync(join(dir, "backlog", "001_primeiro_pedido", "CONTEXT.md"), "utf8");
  expect(text).toContain("primeiro pedido");
  // a data sai do NOME e vai pro frontmatter — é ela que ordena a fila
  expect(text).toMatch(/^created: \d{4}-\d{2}-\d{2}T/m);
});

test("o NNN conta pra cima, e é a ordem de chegada num `ls`", async () => {
  const dir = inbox();
  await capture(dir, "pedido um");
  await capture(dir, "pedido dois");
  await capture(dir, "pedido um"); // título repetido: o pior caso pro nome

  // ordem de chegada sem ler nada, e nenhum número repetido
  expect(backlog(dir)).toEqual(["001_pedido_um", "002_pedido_dois", "003_pedido_um"]);
});

test("um título longo corta na PALAVRA, nunca no meio dela", async () => {
  const dir = inbox();
  await capture(dir, "specialized_skills — criar skills especializadas por papel: coding, design, qa, product");

  const [name] = backlog(dir);
  const title = readFileSync(join(dir, "backlog", name, "CONTEXT.md"), "utf8").match(/^# (.*)$/m)![1];
  expect(title).not.toMatch(/desi…$/);
  // palavra inteira, e a vírgula pendurada no corte também sai
  expect(title.replace(/…$/, "").split(" ").pop()).toBe("coding");
  // e o corpo continua inteiro — cortar é do título, nunca do pedido
  expect(readFileSync(join(dir, "backlog", name, "CONTEXT.md"), "utf8")).toContain("qa, product");
  // o nome é underscore_case, sem carimbo na frente
  expect(name).toMatch(/^\d{3}_[a-z0-9_]+$/);
});

test("uma pasta que não é inbox é recusada, não criada", async () => {
  const dir = mkdtempSync(join(tmpdir(), "notinbox-"));
  const out = await capture(dir, "pedido perdido");
  expect(out.exitCode).toBe(1);
  expect(out.stderr.toString()).toContain("não é uma inbox");
});
