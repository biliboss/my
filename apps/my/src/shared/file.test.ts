//! The check of the anchor: `repoRoot` has to give the same answer from any depth, and
//! it has to REFUSE rather than guess when there is no repo above.
//!
//! The fixture is a throwaway tree in `tmpdir()` — never inside `src/`, which four
//! sessions are writing to at any moment.
//!
//! depends_on: src/shared/file.ts
//! impacts:    —

import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repoRoot } from "./file.ts";

const RAIZ = mkdtempSync(join(tmpdir(), "repo-root-"));
mkdirSync(join(RAIZ, "src/check/um/dois"), { recursive: true });

test("a resposta não depende da PROFUNDIDADE de quem pergunta", () => {
  mkdirSync(join(RAIZ, ".git"), { recursive: true });

  // O acidente de 18/08 em uma linha: com `join(dir, "../..")` estas três chamadas
  // devolveriam três respostas, e duas estariam erradas.
  expect(repoRoot(join(RAIZ, "src/check"))).toBe(RAIZ);
  expect(repoRoot(join(RAIZ, "src/check/um"))).toBe(RAIZ);
  expect(repoRoot(join(RAIZ, "src/check/um/dois"))).toBe(RAIZ);
});

test("acha a raiz de um WORKTREE, onde `.git` é ARQUIVO e não diretório", () => {
  const wt = mkdtempSync(join(tmpdir(), "repo-root-wt-"));
  mkdirSync(join(wt, "src"), { recursive: true });
  writeFileSync(join(wt, ".git"), "gitdir: /algum/lugar/.git/worktrees/x\n");

  expect(repoRoot(join(wt, "src"))).toBe(wt);
  rmSync(wt, { recursive: true, force: true });
});

// CONTROLE NEGATIVO: sem `.git` acima, ele LANÇA. Devolver `/` seria pior que o bug
// que este arquivo conserta — um root errado escreve arquivo de verdade no lugar errado.
test("sem repo acima, lança em vez de chutar", () => {
  expect(() => repoRoot("/")).toThrow(/não achei a raiz do repo/);
});

afterAll(() => rmSync(RAIZ, { recursive: true, force: true }));
