//! O que este pacote faz que não dá pra conferir lendo: a PRECEDÊNCIA entre as duas
//! fontes, e o id que sai do conteúdo.
//!
//! A casa é um `mkdtemp` e o pacote entra por `import()` DINÂMICO — `import`
//! estático é içado acima da linha que seta `MY_HOME`, e o módulo leria a casa de
//! verdade. Foi assim que uma migração apagou 41 linhas fora do git nesta casa
//! (20/08), e é a razão de `home()` ser função em vez de const.

import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CASA = mkdtempSync(join(tmpdir(), "resources-"));
const REAL = process.env.MY_HOME;
process.env.MY_HOME = CASA;

afterAll(() => {
  if (REAL === undefined) delete process.env.MY_HOME;
  else process.env.MY_HOME = REAL;
  rmSync(CASA, { recursive: true, force: true });
});

const escreve = (rel: string, body: string) => {
  const p = join(CASA, "03_resources", rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, body);
};

escreve("references/clis/uma.md", "---\naliases: outra, terceira\n---\n\n# uma página\n\ncorpo\n");
escreve("references/clis/morta.md", "---\nmentions: nao/existe\n---\n\n# aponta pro vazio\n");
// MESMO NOME do embarcado, pra medir quem ganha.
escreve("databases/surrealdb.md", "# a versão da casa\n\nesta é a local\n");

const r = await import("./index.ts");

test("as duas fontes entram, e a CASA ganha por nome", async () => {
  const todos = await r.index(true);
  const surreal = todos.filter((x) => x.name === "databases/surrealdb");
  // Uma só: o embarcado tem o mesmo nome e cede.
  expect(surreal.length).toBe(1);
  expect(surreal[0]!.body).toContain("a versão da casa");
  // E o embarcado continua existindo pro caso de a casa não ter — este teste prova
  // a precedência, não o sumiço.
  expect((await r.index()).some((x) => x.name.includes("clis/uma"))).toBe(true);
});

test("o id é o SHA-1 do corpo, e dois corpos iguais são um recurso só", () => {
  const a = r.resource({ name: "a", kind: "references", lens: "hacker", answers: "x", at: "", body: "abc" });
  const b = r.resource({ name: "b-outro-nome", kind: "notes", lens: "hipster", answers: "y", at: "", body: "abc" });
  expect(a.id).toBe("a9993e364706816aba3e25717850c26c9cd0d89d"); // vetor canônico de SHA-1
  expect(b.id).toBe(a.id);
  expect(r.short(a)).toBe("#a9993e3");
});

test("um alias acha a página, que é o caso que o nome sozinho perde", async () => {
  expect((await r.read(["terceira"]))[0]?.name).toBe("references/clis/uma");
});

test("`mentions` pro vazio é achado, e o resto não é", async () => {
  const achados = await r.check();
  expect(achados.some((f) => f.says.includes("nao/existe"))).toBe(true);
  expect(achados.length).toBe(1);
});
