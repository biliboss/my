#!/usr/bin/env bun
//! `my graph <arquivo>` — a vista de UM contrato: o nó selecionado e as interfaces
//! dele abertas em anel, numa janela do my-canvas.
//!
//!     my graph packages/interfaces/graph.ts
//!     my graph graph                          o nome basta, o `.ts` é opcional
//!     my graph graph --url                    só o link, não abre nada
//!
//! É UMA PÁGINA, NÃO UM ESTADO DO CANVAS. Tentou-se primeiro `#only=` no grafo — o nó,
//! o anel de interfaces, e a vizinhança. Funcionava e respondia a pergunta errada: um
//! círculo com satélites diz QUANTAS interfaces existem e nada sobre o que elas dizem.
//! A pergunta de quem abre um contrato é "o que tem aqui dentro e por quê", e isso é
//! uma árvore com a prosa colada, não um diagrama.
//!
//! O NOME É CONFERIDO CONTRA O GRAFO SERVIDO, não contra o disco. Um arquivo que
//! existe mas está fora do `MY_GRAPH_ROOT` do servidor abriria uma janela num nó que
//! não existe — e o viewer responde a isso com painel vazio, que é indistinguível de
//! bug (é a issue #8 do my-graph).
//!
//! depends_on: apps/my/src/tools/graph.ts · apps/my/src/tools/canvas.ts
//! impacts:    packages/interfaces/graph.ts

import { basename } from "node:path";
import { up } from "./tools/graph.ts";
import { open as abreJanela } from "./tools/canvas.ts";

/** O viewer atrás do Caddy responde nos dois; a janela empacotada só aceita este. */
const DIRETO = "http://localhost:4173";

/** `packages/interfaces/graph.ts`, `./graph.ts` ou `graph` — tudo vira `graph`. */
export function idDe(alvo: string): string {
	return basename(alvo).replace(/\.ts$/, "");
}

export function url(id: string): string {
	return `${DIRETO}/i/${encodeURIComponent(id)}`;
}

/** Os nós que o servidor conhece AGORA. É a única fonte honesta: o disco pode ter o
 *  arquivo e o servidor estar apontado pra outra árvore. */
export async function nos(): Promise<string[]> {
	const r = await fetch(`${DIRETO}/api/graph`, { signal: AbortSignal.timeout(5000) });
	const g = (await r.json()) as { nodes: { id: string }[] };
	return g.nodes.map(n => n.id);
}

export async function main(argv: string[]): Promise<number> {
	const alvo = argv.find(a => !a.startsWith("--"));
	if (!alvo) return (console.error("uso: my graph <arquivo|nome> [--url]"), 2);
	const id = idDe(alvo);

	if (!(await up())) {
		console.error(`my graph: ninguém servindo em ${DIRETO} — suba: cd apps/my-graph && bun run dev --port 4173`);
		return 1;
	}

	const conhecidos = await nos();
	if (!conhecidos.includes(id)) {
		// Lista o que existe em vez de só recusar: o erro que ensina é o que não
		// obriga o chamador a ir procurar o nome noutro lugar.
		console.error(`my graph: "${id}" não está no grafo servido. Tem: ${conhecidos.join(" ")}`);
		return 1;
	}

	const link = url(id);
	if (argv.includes("--url")) return (console.log(link), 0);

	const r = await abreJanela(link, `Interface View - ${id}`);
	if (!r.ok) return (console.error(`my graph: ${r.error}`), 1);
	console.log(link);
	return 0;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));
