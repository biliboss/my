//! O que este arquivo pode errar de verdade: o endereço do verbo PELADO
//! (`chat/index` é `my chat`), o `AND` entre dois termos, e o acento.

import { expect, test } from "bun:test";
import { flatten, search, type Entry } from "./apropos";
import type { Node } from "./cli/core/scan";

// O arquivo é REAL de propósito: `flatten` lê o docstring do disco, e apontar
// pra um caminho inventado testaria o mock em vez do comando.
const REAL = `${import.meta.dir}/apropos.ts`;
const leaf = (name: string, path: string): Node => ({ name, path, file: REAL, children: [] });

test("o subverbo `index` é endereçado como o verbo pelado", () => {
  const tree: Node[] = [{ name: "chat", path: "chat", children: [leaf("index", "chat/index"), leaf("say", "chat/say")] }];
  expect(flatten(tree).map((e) => e.command)).toEqual(["chat", "chat say"]);
});

test("o endereço é o caminho inteiro, e o nome nu não some dentro dele", () => {
  const tree: Node[] = [{ name: "herdr", path: "herdr", children: [{ name: "agents", path: "herdr/agents", children: [leaf("list", "herdr/agents/list")] }] }];
  expect(flatten(tree).map((e) => e.command)).toEqual(["herdr agents list"]);
});

const ENTRIES: Entry[] = [
  { command: "agents dispatch", summary: "despacha trabalho endereçado pra sessão" },
  { command: "kanban move", summary: "move um card de coluna" },
  { command: "kanban list", summary: "os boards, ou os cards de um" },
];

test("dois termos é AND, nunca OR", () => {
  expect(search(ENTRIES, ["kanban", "card"]).map((e) => e.command)).toEqual(["kanban move", "kanban list"]);
  expect(search(ENTRIES, ["kanban", "coluna"]).map((e) => e.command)).toEqual(["kanban move"]);
});

test("o termo sem acento acha a palavra com acento", () => {
  expect(search(ENTRIES, ["sessao"]).map((e) => e.command)).toEqual(["agents dispatch"]);
  expect(search(ENTRIES, ["ENDERECADO"]).map((e) => e.command)).toEqual(["agents dispatch"]);
});

test("termo que não casa devolve lista vazia, não a lista inteira", () => {
  expect(search(ENTRIES, ["worktree"])).toEqual([]);
});
