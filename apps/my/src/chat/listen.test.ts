//! `listen.ts` é o verbo que justifica o sistema: prova aqui que um LOTE de
//! várias mensagens vira UMA entrega (não N), que o `max_wait` entrega mesmo com
//! tráfego contínuo, e que o cursor só anda quando o handler retorna — um
//! handler que estoura tem que ver o mesmo lote de novo.
//!
//! `MY_HOME` isolado por `import()` DINÂMICO — mesma regra e o mesmo porquê de
//! `store.test.ts`: um `import` estático de `store.ts` já roda ANTES da linha
//! que seta `process.env.MY_HOME`, içado pelo ES modules.
//!
//! E A ENV É DEVOLVIDA NO FIM (`afterAll`). Enquanto `MY_HOME` só era lido por
//! `chat/store.ts`, vazá-la não custava nada; desde 20/08 ela é a raiz da CASA
//! inteira (`shared/file.ts#home`), e `bun test` roda vários arquivos no MESMO
//! processo — nove testes de `workflows`, `projects`, `resources` e `check`
//! quebraram porque este arquivo tinha apontado a casa deles pra um `mkdtemp`.
//! Teste que suja env global suja o vizinho, e o vizinho é quem falha.
//!
//! depends_on: src/chat/listen.ts · src/chat/store.ts

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, expect, test } from "bun:test";

const HOME = mkdtempSync(join(tmpdir(), "chat-listen-test-"));
const REAL_HOME = process.env.MY_HOME;
process.env.MY_HOME = HOME;

afterAll(() => {
	if (REAL_HOME === undefined) delete process.env.MY_HOME;
	else process.env.MY_HOME = REAL_HOME;
	rmSync(HOME, { recursive: true, force: true });
});

const { listen } = await import("./listen.ts");
const { append, busPath, getCursor } = await import("./store.ts");

beforeEach(() => {
	rmSync(busPath(), { force: true });
	rmSync(join(HOME, ".my_chat_cursors"), { recursive: true, force: true });
});

// `listen.ts` faz poll a cada 200ms (`POLL_MS`, fixo — ver o header dele). As
// margens abaixo são generosas de propósito: apertar o sono contra o poll dá
// teste instável, não teste rápido.

test("N mensagens escritas juntas chegam num lote SÓ, depois do silêncio (debounce trailing)", async () => {
	const batches: number[][] = [];
	const handle = listen(
		"t",
		"bob",
		(batch) => {
			batches.push(batch.messages.map((m) => m.seq));
		},
		{ debounce: 150, max_wait: 5000 },
	);

	append({ channel: "t", from: "a", to: "bob", text: "1" });
	append({ channel: "t", from: "b", to: "bob", text: "2" });
	append({ channel: "t", from: "c", to: "bob", text: "3" });

	// Antes do primeiro poll (200ms): nada entregue ainda — é a borda TRAILING.
	await Bun.sleep(60);
	expect(batches).toHaveLength(0);

	await Bun.sleep(600);
	handle.stop();

	expect(batches).toHaveLength(1);
	expect(batches[0]).toEqual([1, 2, 3]);
	expect(getCursor("t", "bob")).toBe(3);
});

test("max_wait entrega mesmo com tráfego que nunca sossega", async () => {
	const batches: number[][] = [];
	const handle = listen(
		"t",
		"bob",
		(batch) => {
			batches.push(batch.messages.map((m) => m.seq));
		},
		{ debounce: 1000, max_wait: 500 },
	);

	// Escreve a cada 150ms — sempre dentro da janela de debounce de 1000ms, então
	// SEM `max_wait` isto nunca dispararia.
	const writer = setInterval(() => append({ channel: "t", from: "a", to: "bob", text: "x" }), 150);
	await Bun.sleep(1200);
	clearInterval(writer);
	handle.stop();

	expect(batches.length).toBeGreaterThan(0);
});

test("handler que estoura NÃO avança o cursor — o mesmo lote volta na próxima batida", async () => {
	let calls = 0;
	const seen: number[][] = [];
	const handle = listen(
		"t",
		"bob",
		(batch) => {
			calls++;
			if (calls === 1) throw new Error("simulated crash");
			seen.push(batch.messages.map((m) => m.seq));
		},
		{ debounce: 80, max_wait: 5000 },
	);

	append({ channel: "t", from: "a", to: "bob", text: "1" });
	await Bun.sleep(600); // primeira batida: estoura, cursor não anda
	expect(calls).toBe(1);
	append({ channel: "t", from: "a", to: "bob", text: "2" }); // chega DEPOIS do crash
	await Bun.sleep(600); // segunda batida: reprocessa #1 junto com #2
	handle.stop();

	expect(calls).toBe(2);
	expect(seen).toEqual([[1, 2]]); // o lote reprocessado inclui o que a primeira falhou
	expect(getCursor("t", "bob")).toBe(2);
});
