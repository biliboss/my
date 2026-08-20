//! `store.ts`: o TSV redondo (escreve, lê, escapa) e a MIGRAÇÃO do barramento
//! velho — a parte que não dá pra confiar sem rodar, porque um migrador errado
//! finge que funcionou.
//!
//! `MY_HOME` aponta pra um `mkdtempSync`, e `store.ts` entra por `import()`
//! DINÂMICO — nunca `import` estático. ES modules IÇAM todo `import` estático
//! pro topo do arquivo, então ele rodaria ANTES da linha que seta `MY_HOME`,
//! por mais que apareça depois no texto. Medido nesta casa da pior forma
//! possível: a primeira versão deste teste usava `import` estático depois de
//! setar a env, e mesmo assim escreveu no `~/src/me` REAL — porque o import já
//! tinha carregado `home()` (então uma const de módulo) antes da atribuição.
//! `home()` virou função por causa disso (ver `store.ts`), e AQUI o `import()`
//! dinâmico garante que a env já está no lugar quando o módulo carrega.
//!
//! E A ENV É DEVOLVIDA NO FIM (`afterAll`). Enquanto `MY_HOME` só era lido por
//! `chat/store.ts`, vazá-la não custava nada; desde 20/08 ela é a raiz da CASA
//! inteira (`shared/file.ts#home`), e `bun test` roda vários arquivos no MESMO
//! processo — nove testes de `workflows`, `projects`, `resources` e `check`
//! quebraram porque este arquivo tinha apontado a casa deles pra um `mkdtemp`.
//! Teste que suja env global suja o vizinho, e o vizinho é quem falha.
//!
//! depends_on: src/chat/store.ts

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, expect, test } from "bun:test";

const HOME = mkdtempSync(join(tmpdir(), "chat-store-test-"));
const REAL_HOME = process.env.MY_HOME;
process.env.MY_HOME = HOME;

afterAll(() => {
	if (REAL_HOME === undefined) delete process.env.MY_HOME;
	else process.env.MY_HOME = REAL_HOME;
	rmSync(HOME, { recursive: true, force: true });
});

const { allMessages, append, busPath, getCursor, listChannels, registerChannel, setCursor } = await import("./store.ts");

const OLD_BUS = join(HOME, ".my_agents_chat.tsv");
const OLD_MARKS = join(HOME, ".my_agents_chat");

function reset() {
	for (const p of [busPath(), OLD_BUS, OLD_MARKS, join(HOME, ".my_chat_cursors"), join(HOME, ".my_chat_channels.tsv")]) {
		rmSync(p, { recursive: true, force: true });
	}
}

beforeEach(reset);

test("append dá seq crescente e devolve a mensagem escrita", () => {
	const a = append({ channel: "t", from: "gabriel", to: "bob", text: "oi" });
	const b = append({ channel: "t", from: "bob", to: "gabriel", text: "e aí" });
	expect(a.seq).toBe(1);
	expect(b.seq).toBe(2);
	expect(allMessages().map((m) => m.text)).toEqual(["oi", "e aí"]);
});

test("tab e quebra de linha no texto viram espaço — não corrompem a linha depois", () => {
	append({ channel: "t", from: "gabriel", to: "bob", text: "linha um\ncom\ttab" });
	const [m] = allMessages();
	expect(m!.text).toBe("linha um com tab");
});

test("thread/answers ausentes voltam `undefined`, não string vazia", () => {
	append({ channel: "t", from: "gabriel", to: "bob", text: "sem thread" });
	const [m] = allMessages();
	expect(m!.thread).toBeUndefined();
	expect(m!.answers).toBeUndefined();
});

test("cursor: ausente é 0, e `setCursor` é lido de volta por (canal, quem)", () => {
	expect(getCursor("t", "bob")).toBe(0);
	setCursor("t", "bob", 7);
	expect(getCursor("t", "bob")).toBe(7);
	expect(getCursor("outro-canal", "bob")).toBe(0); // cursor é por canal
});

test("registerChannel: chave natural é o nome — a segunda chamada não duplica", () => {
	registerChannel("plantao", ["gabriel", "bob"]);
	registerChannel("plantao", ["ninguem-devia-entrar"]);
	const canais = listChannels().filter((c) => c.name === "plantao");
	expect(canais).toHaveLength(1);
	expect(canais[0]!.members).toEqual(["gabriel", "bob"]);
});

test("migração: 4 colunas velhas viram 8, com seq=ordem da linha e channel/thread/answers vazios", () => {
	writeFileSync(
		OLD_BUS,
		["2026-08-18T18:53:02Z\tgabriel\tqa-workflow\tprimeira linha", "2026-08-18T18:59:48Z\tqa-workflow\tgabriel\tsegunda linha"].join("\n") + "\n",
	);
	mkdirSync(OLD_MARKS, { recursive: true });
	writeFileSync(join(OLD_MARKS, "qa-workflow.at"), "1");

	const all = allMessages(); // dispara a migração na primeira leitura
	expect(all).toHaveLength(2);
	expect(all[0]).toEqual({
		seq: 1,
		channel: "",
		from: "gabriel",
		to: "qa-workflow",
		at: "2026-08-18T18:53:02Z",
		text: "primeira linha",
		thread: undefined,
		answers: undefined,
	});
	expect(all[1]!.seq).toBe(2);

	// a marca velha (linha 1 lida) virou cursor do canal "" — seq da última lida.
	expect(getCursor("", "qa-workflow")).toBe(1);

	// o arquivo velho e as marcas velhas saem do disco — a migração é eliminação
	// total, não duplicação de dado em dois formatos.
	expect(existsSync(OLD_BUS)).toBe(false);
	expect(existsSync(OLD_MARKS)).toBe(false);
});

test("migração roda uma vez só: escrever de novo depois não recria o arquivo velho", () => {
	writeFileSync(OLD_BUS, "2026-08-18T18:53:02Z\tgabriel\tqa-workflow\tx\n");
	allMessages(); // migra
	append({ channel: "", from: "gabriel", to: "qa-workflow", text: "y" });
	const rows = readFileSync(busPath(), "utf8").split("\n").filter(Boolean);
	expect(rows).toHaveLength(3); // header + linha migrada + linha nova
});
