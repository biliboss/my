//! The check of the check: a CONTEXT.md at 100 lines passes, one at 101 fails, and a
//! non-CONTEXT.md markdown file — however long — is never even looked at.
//!
//! Against a throwaway tree, same shape as `runs.test.ts`: this checker's whole job
//! is counting lines, so the fixture IS the assertion.

import { afterAll, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, cpSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const RAIZ = join(tmpdir(), `check-context-${Date.now()}`);
const CHECK = join(RAIZ, "src/check/context.ts");

// `\n` NO FIM, porque é o que o disco real tem — todo arquivo POSIX termina em
// quebra. A fixture antiga usava só `join("\n")` e media um arquivo que nenhum
// editor produz; foi por isso que ela deixou passar um off-by-one que punha nove
// `CONTEXT.md` de exatamente 100 linhas na lista de acima do teto. Fixture que não
// se parece com o disco testa o código contra um mundo que não existe.
const linhas = (n: number) => `${Array.from({ length: n }, (_, i) => `linha ${i}`).join("\n")}\n`;
const write = (rel: string, n: number) => {
  const p = join(RAIZ, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, linhas(n));
};

// `MY_HOME` É QUEM DIZ QUAL CASA, e não mais o `.git` da fixture. O check lia a raiz
// por ÂNCORA enquanto código e conteúdo dividiam pasta; desde 20/08 ele lê
// `file.ts#home`, que é a CASA — e sem esta linha a fixture rodava contra o
// `~/src/me` de verdade, medindo os CONTEXT.md do repositório em vez dos três que
// este arquivo escreve. Passava por acidente antes, e três testes ficaram vermelhos
// no instante em que a leitura ficou correta.
//
// O `.git` FICA: o `code()` de `home/paths.ts` ainda sobe até ele, e sem o diretório
// o check morre na carga, dentro da fixture, apontando pra assertion em vez de pra cá.
mkdirSync(join(RAIZ, ".git"), { recursive: true });
mkdirSync(join(RAIZ, "src/check"), { recursive: true });
cpSync(join(import.meta.dir, "context.ts"), CHECK);
// The check is copied ALONE into the fixture, so every module it imports has to be
// copied with it — at the same relative path, because that is what the import says.
// Missing this fails loudly but misleadingly: the run dies before printing anything,
// so the test reports "expected output, received empty" and points at the assertion
// instead of at the fixture.
mkdirSync(join(RAIZ, "src/shared"), { recursive: true });
// `argv.ts` moved to `@my/shared` on 22/08, and a bare specifier does not
// resolve from a fixture in /tmp. Symlinking the package into the fixture's
// node_modules is what keeps the copied check runnable.
mkdirSync(join(RAIZ, "node_modules/@my"), { recursive: true });
symlinkSync(join(import.meta.dir, "../../../../packages/shared"), join(RAIZ, "node_modules/@my/shared"), "dir");
cpSync(join(import.meta.dir, "../shared/file.ts"), join(RAIZ, "src/shared/file.ts"));
// `shared/file.ts` REEXPORTA `home/paths.ts` desde 20/08, e a fixture copia módulo a
// módulo — sem estes dois o check morre com `export 'home' not found`, que é o mesmo
// sintoma enganoso que o comentário acima descreve.
mkdirSync(join(RAIZ, "src/home"), { recursive: true });
cpSync(join(import.meta.dir, "../home/paths.ts"), join(RAIZ, "src/home/paths.ts"));
// O contrato NÃO é copiado: `home/paths.ts` o importa com `import type`, que a
// transpilação apaga — dentro da fixture não existe `node_modules` pra resolver
// `@my/interfaces`, e copiá-lo seria remendar um problema que não existe.

write("CONTEXT.md", 100); // no teto, exatamente — não é achado
write("03_resources/00_company/CONTEXT.md", 101); // um acima — é o defeito
write("steps/RESUMO.md", 500); // não se chama CONTEXT.md — controle negativo

const exec = async (args: string[] = []) => {
  const p = Bun.spawn(["bun", "run", CHECK, ...args], {
    cwd: RAIZ,
    env: { ...process.env, MY_HOME: RAIZ },
    stdout: "pipe",
    stderr: "pipe",
  });
  return { out: await new Response(p.stdout).text(), code: await p.exited };
};

test("CONTEXT.md exatamente no teto não é achado", async () => {
  const j = JSON.parse((await exec(["--json"])).out);
  expect(j.achados.map((a: { caminho: string }) => a.caminho)).not.toContain("CONTEXT.md");
});

test("CONTEXT.md um acima do teto é ERRO e derruba o exit code", async () => {
  const { out, code } = await exec();
  expect(out).toContain("03_resources/00_company/CONTEXT.md");
  expect(out).toContain("1 acima do teto");
  expect(code).toBe(1);
});

// O CONTROLE NEGATIVO: um markdown de 500 linhas que não se chama CONTEXT.md
// nunca aparece — sem esta asserção um walk que ignorasse o nome do arquivo
// passaria no teste de cima do mesmo jeito.
test("arquivo que não se chama CONTEXT.md nunca é achado, por maior que seja", async () => {
  const { out } = await exec();
  expect(out).not.toContain("RESUMO.md");
});

test("--json devolve os achados com quanto cada um excede", async () => {
  const j = JSON.parse((await exec(["--json"])).out);
  expect(j.achados).toHaveLength(1);
  expect(j.achados[0].excede).toBe(1);
});

test("passando só o caminho staged, só ele é considerado", async () => {
  // `CONTEXT.md` da raiz está no teto (não é achado); passar só ele não deve
  // enxergar o `03_resources/00_company/CONTEXT.md` que excede.
  const { out, code } = await exec(["CONTEXT.md"]);
  expect(out).not.toContain("03_resources/00_company/CONTEXT.md");
  expect(code).toBe(0);
});

afterAll(() => rmSync(RAIZ, { recursive: true, force: true }));
