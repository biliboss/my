//! O que `my vscode set` LÊ do banco — contra um arquivo descartável, nunca o
//! `~/.me/me.db` de verdade.
//!
//! `ME_DB` é setado antes da primeira CHAMADA de `db()`, e isso basta desde
//! 19/08: @src/shared/db.ts lê o caminho a cada chamada. Antes ele congelava na
//! carga do módulo, e "setar antes do import" NÃO era proteção nenhuma numa
//! rodada multi-arquivo — outro arquivo de teste importava `db.ts` primeiro (por
//! `tasks/model.ts`) e fixava o banco REAL pra todo mundo. O `db().delete(folder)`
//! lá embaixo rodou no `~/.me/me.db` do Gabriel e apagou 17 pastas.
//!
//! Por isso os imports voltaram a ser estáticos: o `await import()` dinâmico
//! existia só pra ordenar env-antes-de-módulo, e essa ordem era uma garantia
//! falsa — dava a impressão de proteção sem proteger.
//!
//! depends_on: src/vscode/set.ts · src/shared/db.ts

import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "me-set-"));
process.env.ME_DB = join(dir, "test.db");
process.env.WS_FILE = join(dir, "main.code-workspace");

const { db, dbPath } = await import("../shared/db.ts");
const { folder, folderTag } = await import("../shared/schema.ts");
const { arranja, current, parseToken, writeWorkspace } = await import("./set.ts");

// O CINTO DE SEGURANÇA, e ele fica mesmo com o conserto em `db.ts`: este arquivo
// APAGA linhas, então uma regressão futura em `dbPath()` volta a custar o banco
// do Gabriel. Falhar aqui é barato; descobrir pelo `ls` da barra vazia não é.
if (!process.env.ME_DB?.startsWith(dir)) {
  throw new Error(`recusando rodar: ME_DB é ${process.env.ME_DB}, e tem que estar em ${dir}`);
}
if (dbPath() !== process.env.ME_DB) {
  throw new Error(`recusando rodar: db() abriria ${dbPath()}, não ${process.env.ME_DB}`);
}

afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("a barra sai na ordem de `position`, com as tags de cada pasta", () => {
  db()
    .insert(folder)
    .values([
      { path: "me/02_areas/00_workflows", label: "workflows", position: 20 },
      { path: "orion-mono", position: 10 },
      // CONTROLE NEGATIVO: escondida não aparece, e é o `--drop` funcionando.
      { path: "me/00_inbox", position: 5, hidden: true },
    ])
    .run();
  db()
    .insert(folderTag)
    .values([
      { path: "orion-mono", tag: "trabalho" },
      { path: "orion-mono", tag: "sistema" },
    ])
    .run();

  const list = current();

  // Ordem por `position`, não por inserção nem alfabética.
  expect(list.map((f) => f.path)).toEqual(["orion-mono", "me/02_areas/00_workflows"]);
  // 0..N: a pasta com duas tags traz as duas, a sem tag traz lista vazia —
  // é o `leftJoin` que garante a segunda, e um `inner` a apagaria.
  expect(list[0]!.tags.sort()).toEqual(["sistema", "trabalho"]);
  expect(list[1]!.tags).toEqual([]);
  // `label` nulo é "use o rótulo gerado", e tem que chegar nulo em vez de "".
  expect(list[0]!.label).toBeNull();
  expect(list[1]!.label).toBe("workflows");
});

test("a chave natural do par recusa tag repetida na criação", () => {
  expect(() => db().insert(folderTag).values({ path: "orion-mono", tag: "trabalho" }).run()).toThrow();
});

test("o token separa caminho, rótulo e as N tags", () => {
  expect(parseToken("me/00_inbox")).toEqual({ path: "me/00_inbox", label: null, tags: [] });
  expect(parseToken('me/00_inbox:"inbox"')).toEqual({ path: "me/00_inbox", label: "inbox", tags: [] });
  expect(parseToken("orion-mono@trabalho@sistema")).toEqual({
    path: "orion-mono",
    label: null,
    tags: ["trabalho", "sistema"],
  });
  // `:""` é o DESFAZER do override: volta pro rótulo gerado, então chega nulo.
  expect(parseToken('me/00_inbox:""')).toEqual({ path: "me/00_inbox", label: null, tags: [] });
  // CONTROLE NEGATIVO: `@` DENTRO do rótulo é rótulo, não tag — é por isso que a
  // tag é cortada pela direita e só fora das aspas.
  expect(parseToken('me/00_inbox:"agente@casa"')).toEqual({
    path: "me/00_inbox",
    label: "agente@casa",
    tags: [],
  });
});

// A escrita do `main.code-workspace` era do `regen`, que morreu em 18/08. O que
// dói quando quebra é o que este teste cerca: o `folders` reescrito INTEIRO (sem
// sobrar entrada da barra anterior) e as `settings` intactas — um `slice` errado
// nos índices come a chave de baixo e o VS Code recusa o workspace sem dizer
// onde.
test("reescreve só o `folders`, preserva as escondidas e as settings", () => {
  writeFileSync(
    process.env.WS_FILE!,
    `{
\t"folders": [
\t\t{
\t\t\t"name": "▸ velha",
\t\t\t"path": "me/velha"
\t\t},

\t\t/*
\t\t{ "name": "escondida", "path": "me/escondida" }
\t\t*/
\t],
\t"settings": { "files.exclude": { "**/.git": true } }
}
`,
  );

  writeWorkspace([
    { path: "orion-mono", label: null, tags: [] },
    { path: "me/02_areas/00_workflows", label: "workflows", tags: [] },
  ]);

  const out = readFileSync(process.env.WS_FILE!, "utf8");
  // O arquivo é JSONC — comentário de bloco (as escondidas), comentário de linha
  // (o cabeçalho delas) e vírgula sobrando. Tirar os três é o que deixa um
  // `JSON.parse` afirmar a ESTRUTURA em vez de casar string.
  const ws = JSON.parse(
    out
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/,(\s*[\]}])/g, "$1"),
  );

  // Sem rótulo o nome é o da PASTA; com override, o texto digitado.
  expect(ws.folders).toEqual([
    { name: "▸ orion-mono", path: "orion-mono" },
    { name: "▸ workflows", path: "me/02_areas/00_workflows" },
  ]);
  // CONTROLE NEGATIVO: a barra anterior não pode sobreviver ao redesenho.
  expect(out).not.toContain("me/velha");
  // O bloco comentado e as settings atravessam intactos.
  expect(out).toContain('{ "name": "escondida", "path": "me/escondida" }');
  expect(ws.settings["files.exclude"]).toEqual({ "**/.git": true });
});

test("tag de pasta que não existe é recusada pela foreign key", () => {
  // Só passa com `PRAGMA foreign_keys = ON`, que é OFF por default no SQLite —
  // este teste é o que prova que o pragma do `db()` está de pé.
  expect(() => db().insert(folderTag).values({ path: "nao/existe", tag: "x" }).run()).toThrow();
});

// ── arranja: os quatro modos que saíram do TODO em 19/08 ───────────────────
// Testável sem banco e sem workspace porque `arranja` é pura — e é justamente
// onde mora toda a decisão de ORDEM, que é a que quebra em silêncio.

const item = (path: string, label: string | null = null) => ({ path, label, tags: [] as string[] });
const paths = (r: ReturnType<typeof arranja>) => (typeof r === "string" ? r : r.map((f) => f.path));

test("--at <n> é 1-based, e o número é o LUGAR", () => {
	const antes = [item("a"), item("b"), item("c")];
	expect(paths(arranja(antes, [item("novo")], "at", "1"))).toEqual(["novo", "a", "b", "c"]);
	expect(paths(arranja(antes, [item("novo")], "at", "2"))).toEqual(["a", "novo", "b", "c"]);
	// a última posição válida é `n = quantas sobram + 1`
	expect(paths(arranja(antes, [item("novo")], "at", "4"))).toEqual(["a", "b", "c", "novo"]);
});

test("--at fora da faixa RECUSA em vez de grudar na ponta", () => {
	// Grudar na ponta é o comando decidindo por você, e barra é memória
	// muscular: a pessoa clica onde estava, não onde faz sentido.
	expect(arranja([item("a")], [item("x")], "at", "9")).toContain("--at 9");
	expect(arranja([item("a")], [item("x")], "at", "0")).toContain("1-based");
	expect(arranja([item("a")], [item("x")], "at", "meio")).toContain("1-based");
});

test("--at aceita âncora, e recusa âncora que não está na barra", () => {
	const antes = [item("a"), item("b")];
	expect(paths(arranja(antes, [item("x")], "at", "after:a"))).toEqual(["a", "x", "b"]);
	expect(paths(arranja(antes, [item("x")], "at", "before:b"))).toEqual(["a", "x", "b"]);
	expect(arranja(antes, [item("x")], "at", "after:sumiu")).toContain("não está na barra");
});

test("--at MOVE quem já estava, não duplica", () => {
	const antes = [item("a"), item("b"), item("c")];
	expect(paths(arranja(antes, [item("c")], "at", "1"))).toEqual(["c", "a", "b"]);
});

test("--drop tira da barra e --label não move nada", () => {
	const antes = [item("a"), item("b", "velho"), item("c")];
	expect(paths(arranja(antes, [item("b")], "drop"))).toEqual(["a", "c"]);

	const rotulado = arranja(antes, [item("b", "novo")], "label");
	expect(paths(rotulado)).toEqual(["a", "b", "c"]); // a ORDEM não mexeu
	expect(typeof rotulado === "string" ? null : rotulado[1].label).toBe("novo");
});

test("rótulo com espaço na frente indenta ANTES do `▸`", () => {
	// O VS Code não tem pasta aninhada em multi-root; espaço no rótulo é o único
	// jeito de mostrar "este código é DESTE projeto". Com o `▸` colado à
	// esquerda, o recuo depois dele lê como rótulo torto, não como filho.
	db().delete(folder).run();
	db()
		.insert(folder)
		.values([
			{ path: "me/01_projects/askuser", label: "askuser", position: 10 },
			{ path: "askuser", label: "  código", position: 20 },
		])
		.run();
	writeWorkspace(current());
	const ws = readFileSync(process.env.WS_FILE!, "utf8");
	expect(ws).toContain('"name": "▸ askuser"');
	expect(ws).toContain('"name": "  ▸ código"');
});
