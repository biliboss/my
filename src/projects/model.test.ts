//! O que `Bun.YAML` faz com o front matter de projeto — medido, não suposto.
//!
//! Este teste existe porque `projects/model.ts` DEIXOU de ter parser próprio
//! (19/08) e passou a usar o `frontMatter()` de `runs.ts`, que é YAML de verdade.
//! Parser à mão devolvia todo valor como o texto cru; YAML TIPA o escalar. A
//! troca é segura só enquanto os casos abaixo continuarem valendo — e o que os
//! garante é este arquivo, não a leitura de quem trocou.
//!
//! depends_on: src/projects/model.ts · src/runs.ts
//! impacts:    —

import { expect, test } from "bun:test";
import { campo, expandir, slugs } from "./model.ts";
import { frontMatter } from "../runs.ts";

test("`_parked` é gaveta, não projeto — `_` na frente é namespace", () => {
	// Ele cobrava front matter, área, prazo e run (4 achados) de uma pasta cuja
	// razão de existir, no CONTEXT.md dela, é "sair da lista de 01_projects/".
	const todos = slugs();
	expect(todos).not.toContain("_parked");
	expect(todos.filter((s) => s.startsWith("_"))).toEqual([]);
	// E não varreu junto quem é projeto de verdade. A prova é que a pasta que
	// SOBRA em `01_projects/` aparece — não uma contagem.
	//
	// Aqui morava `length > 20` e `toContain("acme")`, e as duas caíram em
	// 19/08 quando 21 projetos foram estacionados de uma vez: sobraram DOIS, e o
	// acme era um dos que saíram. Censo dentro de teste é bomba-relógio —
	// ele não mede a regra, mede quantos projetos existiam no dia em que alguém
	// escreveu o número.
	expect(todos.length).toBeGreaterThan(0);
	expect(todos).toContain("auto-system");
});

/** Monta o front matter como ele é escrito no disco, e devolve só o mapa. */
const fm = (corpo: string) => frontMatter(`---\n${corpo}\n---\n# título\n`).fm;

test("o `~` de um caminho sobrevive — só um `~` sozinho é null no YAML", () => {
	// O caso que mais assusta no papel: `repo_local: ~/src/acme-mono` é o valor mais
	// comum do repo inteiro. Se o YAML o lesse como null, todo projeto perderia a
	// chave de uma vez.
	expect(campo(fm("repo_local: ~/src/acme-mono"), "repo_local")).toBe("~/src/acme-mono");
	expect(expandir(campo(fm("repo_local: ~/src/acme-mono"), "repo_local")!)).toMatch(/^\/.*\/src\/acme-mono$/);

	// E o `~` pelado É null — vira ausência, que é o achado certo pra ele.
	expect(campo(fm("repo_local: ~"), "repo_local")).toBeUndefined();
});

test("valor que o YAML coagiria sai STRING — `expandir()` chama `.startsWith`", () => {
	// Sem o `String()` do `campo`, cada um destes entrega um não-string pro
	// `expandir()`/`existsSync()` e o check morre de TypeError em vez de acusar.
	expect(campo(fm("repo_local: 12345"), "repo_local")).toBe("12345");
	expect(campo(fm("main_branch: 2024-01-01"), "main_branch")).toBe("2024-01-01");
	expect(campo(fm("main_branch: true"), "main_branch")).toBe("true");

	// A prova de que é o `campo` que segura, e não sorte: o valor cru é number.
	expect(typeof fm("repo_local: 12345").repo_local).toBe("number");
	expect(() => expandir(campo(fm("repo_local: 12345"), "repo_local")!)).not.toThrow();
});

test("placeholder do molde não é declaração", () => {
	// `repo: <owner>/<name>` é o template passando por resposta: a chave existe,
	// então o consumidor acredita e vai procurar um repositório chamado
	// literalmente `<owner>/<name>`. Medido 19/08 em `auto-system` e `nimbus-v1`.
	expect(campo(fm("repo: <owner>/<name>"), "repo")).toBeUndefined();
	expect(campo(fm("repo_local: <slug>"), "repo_local")).toBeUndefined();

	// E o que NÃO é placeholder continua passando — a regra é o valor INTEIRO
	// entre `<>`, não um `<` no meio, senão uma descrição legítima sumiria.
	expect(campo(fm("description: compara <a> com <b>"), "description")).toBe("compara <a> com <b>");
	expect(campo(fm("repo: biliboss/me"), "repo")).toBe("biliboss/me");
});

test("chave vazia é o mesmo buraco que chave ausente", () => {
	// O caso mais comum do disco: alguém digitou a chave e parou. O parser antigo
	// filtrava valor vazio; o YAML devolve null, e o `campo` normaliza os dois.
	expect(campo(fm("repo:"), "repo")).toBeUndefined();
	expect(campo(fm("repo: outra_coisa"), "nao_existe")).toBeUndefined();
	expect(campo(fm('repo: ""'), "repo")).toBeUndefined();
});

test("chave com dígito ou hífen é LIDA — era o buraco do parser à mão", () => {
	// O motivo da task: o regex antigo era `^([a-z_]+):`, então uma chave com
	// dígito ou hífen sumia em silêncio e virava `missing_frontmatter` falso.
	expect(campo(fm("repo_local2: ~/x"), "repo_local2")).toBe("~/x");
	expect(campo(fm("main-branch: main"), "main-branch")).toBe("main");
});

test("sem cerca, `body` volta intacto — é como o check sabe que é `bare`", () => {
	// `missing_frontmatter` tem dois textos diferentes, e o que os separa é este
	// sinal. Se `frontMatter` passasse a fatiar o corpo sempre, o achado mentiria.
	const cru = "# só o título\n";
	expect(frontMatter(cru).body).toBe(cru);
	expect(frontMatter("---\nrepo: x\n---\n# t\n").body).not.toBe("---\nrepo: x\n---\n# t\n");
});

test("front matter torto não derruba o check — vira ausência", () => {
	// YAML inválido: o `frontMatter` engole e devolve `{}`. O projeto aparece como
	// sem chaves, que é exatamente o que ele é enquanto ninguém conserta o bloco.
	expect(campo(fm("repo: [nao\n  fecha:"), "repo")).toBeUndefined();
});
