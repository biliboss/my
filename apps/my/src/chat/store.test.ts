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

import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

const { allMessages, append, busPath, getCursor, listChannels, registerChannel, setCursor } = await import("@my/chat");

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

// =============================================================================
// read-back on append — the four torn lines of 21/08
// =============================================================================

test("append reads its own line back: what it returns is what the file holds", () => {
	const m = append({ channel: "t", from: "gabriel", to: "bob", text: "com acento: ação e coração" });
	expect(allMessages().find((x) => x.seq === m.seq)).toEqual(m);
});

test("append raises on a torn line instead of returning a message the file lost", () => {
	append({ channel: "t", from: "gabriel", to: "bob", text: "primeira" });
	// A REAL TEAR, not a simulated one: a writer that died mid-row leaves a
	// fragment with NO newline, and the next append glues onto it. This is the
	// shape of the 4 lines that tore in _today's channels on 21/08.
	appendFileSync(busPath(), "9\tt\tgabriel");

	expect(() => append({ channel: "t", from: "bob", to: "gabriel", text: "segunda" })).toThrow(/torn line/);

	// And the tear is real: seq 2 exists nowhere as a row of its own, because its
	// bytes are inside the glued line. Nobody would have noticed on a read — the
	// glued line still PARSES, with every column shifted by one.
	const rows = readFileSync(busPath(), "utf8").split("\n").filter(Boolean);
	expect(rows.some((r) => r.startsWith("2\t"))).toBe(false);
	expect(rows.some((r) => r.startsWith("9\tt\tgabriel2\t"))).toBe(true);
});

// =============================================================================
// cursors fold with max — the rewind `.bus_acks.jsonl` was immune to
// =============================================================================

test("setCursor never rewinds: a stale acknowledgement folds with max", () => {
	// This is the listen sequence: a batch is addressed BEFORE its handler runs
	// and acknowledged AFTER, so a slow handler writes its (older) `to` last.
	setCursor("t", "bob", 9); // the fast wake finished first
	setCursor("t", "bob", 3); // the slow one returns later, carrying a stale `to`
	expect(getCursor("t", "bob")).toBe(9);
});

test("a rewound cursor would re-deliver: the inbox stays empty after the stale write", () => {
	for (const text of ["um", "dois", "tres"]) append({ channel: "t", from: "gabriel", to: "bob", text });
	setCursor("t", "bob", 3);
	setCursor("t", "bob", 1);
	const pending = allMessages().filter((m) => m.channel === "t" && m.seq > getCursor("t", "bob") && m.to === "bob");
	expect(pending).toEqual([]);
});

// =============================================================================
// the parse is a tail — every byte before the offset is frozen by append-only
// =============================================================================

test("a line written by ANOTHER writer shows up on the next read", () => {
	append({ channel: "t", from: "gabriel", to: "bob", text: "minha" });
	appendFileSync(busPath(), ["2", "t", "outro-processo", "bob", "2026-08-21T13:20:30Z", "de fora", "", ""].join("\t") + "\n");
	expect(allMessages().map((m) => m.text)).toEqual(["minha", "de fora"]);
});

test("a trailing fragment is not parsed until its newline lands", () => {
	append({ channel: "t", from: "gabriel", to: "bob", text: "inteira" });
	const half = ["2", "t", "gabriel", "bob", "2026-08-21T13:20:30Z"].join("\t");
	appendFileSync(busPath(), half);
	expect(allMessages().map((m) => m.text)).toEqual(["inteira"]);

	appendFileSync(busPath(), ["", "pela metade", "", ""].join("\t") + "\n");
	expect(allMessages().map((m) => m.text)).toEqual(["inteira", "pela metade"]);
});

test("accents do not shift the offset: the byte parsed to is a byte, not a character", () => {
	append({ channel: "t", from: "gabriel", to: "bob", text: "ação, coração, não — três acentos" });
	append({ channel: "t", from: "bob", to: "gabriel", text: "depois" });
	expect(allMessages().map((m) => m.seq)).toEqual([1, 2]);
	expect(allMessages()[1]!.text).toBe("depois");
});

test("the file being replaced by a LONGER one is re-read from zero", () => {
	// The dangerous half of the offset: a bigger file passes a size check while its
	// bytes are somebody else's. This is what the migration does to a house that
	// already read its `.my_chat.tsv`, and it is what the anchor exists to catch.
	append({ channel: "t", from: "gabriel", to: "bob", text: "curta" });
	rmSync(busPath());
	const outra = ["1", "outro", "quem", "todos", "2026-08-21T13:20:30Z", "uma linha bem mais comprida que a que estava ali antes", "", ""].join("\t");
	writeFileSync(busPath(), "seq\tchannel\tfrom\tto\tat\ttext\tthread\tanswers\n" + outra + "\n" + outra.replace("1\t", "2\t") + "\n");
	expect(allMessages().map((m) => m.seq)).toEqual([1, 2]);
});

test("the file being replaced by a shorter one is re-read from zero", () => {
	append({ channel: "t", from: "gabriel", to: "bob", text: "antes" });
	expect(allMessages()).toHaveLength(1);
	rmSync(busPath());
	append({ channel: "t", from: "gabriel", to: "bob", text: "depois" });
	expect(allMessages().map((m) => m.text)).toEqual(["depois"]);
});

test("registerChannel: chave natural é o nome — a segunda chamada não duplica o CANAL", () => {
	const criado = registerChannel("plantao", ["gabriel", "bob"]);
	registerChannel("plantao", ["gabriel"]);
	const canais = listChannels().filter((c) => c.name === "plantao");
	expect(canais).toHaveLength(1);
	// Entrar de novo com o mesmo nome não duplica o membro nem move o created_at.
	expect(canais[0]!.members).toEqual(["gabriel", "bob"]);
	expect(canais[0]!.created_at).toBe(criado.created_at);
});

test("registerChannel: membro é UNIÃO — a segunda chamada ACRESCENTA, nunca substitui", () => {
	registerChannel("plantao", ["gabriel", "bob"]);
	const depois = registerChannel("plantao", ["qa"]);
	expect(depois.members).toEqual(["gabriel", "bob", "qa"]);
	expect(listChannels().find((c) => c.name === "plantao")!.members).toEqual(["gabriel", "bob", "qa"]);
});

test("registerChannel: a ORDEM contra `append` deixou de importar — o join depois do primeiro `say` sobrevive", () => {
	// A regressão que o find-or-create custava: `append` cria o canal com lista
	// VAZIA na primeira mensagem, e daí em diante todo join virava no-op silencioso
	// — as 13 linhas `join` do `_today` e o membro de time entrando em `teams up`.
	append({ channel: "novo", from: "gabriel", to: "all", text: "primeira" });
	registerChannel("novo", ["designer"]);
	append({ channel: "novo", from: "designer", to: "all", text: "segunda" });
	registerChannel("novo", ["qa"]);
	expect(listChannels().find((c) => c.name === "novo")!.members).toEqual(["designer", "qa"]);
});

test("registerChannel: vírgula no nome viraria DOIS membros — vira espaço na escrita", () => {
	const c = registerChannel("plantao", ["bob,eve"]);
	expect(c.members).toEqual(["bob eve"]);
	expect(listChannels().find((x) => x.name === "plantao")!.members).toEqual(["bob eve"]);
});

test("registerChannel: slot em branco sobrevive à união — é o achado NO NAME do check", () => {
	registerChannel("plantao", ["bob", ""]);
	registerChannel("plantao", ["qa"]);
	expect(listChannels().find((c) => c.name === "plantao")!.members).toEqual(["bob", "", "qa"]);
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
