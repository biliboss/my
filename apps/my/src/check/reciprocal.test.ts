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
import { home as RAIZ_FN } from "../shared/file.ts";

const RAIZ = RAIZ_FN();

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
// hook, so every commit died with `---: command not found`.
//
// ESTE TESTE JÁ FOI DUAS COISAS ERRADAS, e as duas custaram uma manhã cada:
//
//   · ELE ESCREVIA NO REPO VIVO. `--fix --write` sem sandbox, contra a árvore de quem
//     está rodando a suíte. Sobreviveu porque a única escrita que ele provocava era a
//     que o próprio check recusava — e no dia em que a árvore mudou, ele escreveu
//     `depends_on` num arquivo de verdade. Agora é `--fix` seco: a decisão de forma é
//     tomada e IMPRESSA antes de qualquer escrita, então o dry-run mede a mesma regra.
//
//   · ELE DEPENDIA DE UM ESTADO TRANSITÓRIO. Afirmava `skipped: src/check/pre-commit`,
//     o que só valia enquanto ALGUÉM declarasse `impacts:` apontando pra lá sem a
//     recíproca. Consertar o `install.ts` fechou esse par — e o teste ficou vermelho
//     por causa de um conserto. Teste que quebra quando o repo melhora está medindo o
//     repo, não a regra.
//
// O que sobra é a REGRA, e ela não drifta: nenhuma escrita proposta pode ter como
// alvo um arquivo cuja forma o check não conhece.
test("--fix never proposes writing into a file whose shape the check does not know", async () => {
  const hook = join(import.meta.dir, "pre-commit");
  const { out } = await run(["--fix"]);
  const alvos = out
    .split("\n")
    .map((l) => l.match(/^(\S+):\s+\w+:\s+\+=/)?.[1])
    .filter((f): f is string => Boolean(f));
  // A REGRA NÃO É "só .ts e .md", e escrever este teste foi o que mostrou isso: o
  // `--fix` propõe alvo `.yaml`, `.svelte` e `.html`, e está CERTO — todos eles já
  // declaram o campo, e anexar a uma linha existente é seguro em qualquer extensão.
  // A primeira versão desta asserção reprovou os três e estava medindo a extensão em
  // vez do risco.
  //
  // O RISCO É O BLOCO NOVO NO TOPO, e o arquivo que não pode recebê-lo é o que
  // COMEÇA COM SHEBANG: ali a primeira linha é contrato com o kernel, e um `---`
  // acima dela transforma o arquivo em `---: command not found`.
  // `.ts` COM SHEBANG É SEGURO, e a segunda versão desta asserção reprovou um — num
  // `.ts` o campo entra DEPOIS do último `//!`, nunca na linha 0. O perigo é o
  // arquivo sem header e sem extensão conhecida, onde a única forma que sobra é
  // prepender um bloco `---`.
  const comShebang: string[] = [];
  for (const alvo of new Set(alvos)) {
    if (alvo.endsWith(".ts")) continue;
    const f = Bun.file(join(RAIZ, alvo));
    if ((await f.exists()) && (await f.text()).startsWith("#!")) comShebang.push(alvo);
  }
  expect(comShebang).toEqual([]);
  // E a testemunha do dia: o hook continua começando pelo shebang.
  expect((await Bun.file(hook).text()).split("\n")[0]).toBe("#!/usr/bin/env bash");
});
