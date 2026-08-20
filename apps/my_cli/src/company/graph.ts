#!/usr/bin/env bun
//! `my company graph` — a empresa desenhada: o my-graph, dentro de uma janela do
//! my-canvas.
//!
//!     my company graph              abre a janela no nó `company`
//!     my company graph --url        só imprime a URL, não abre nada
//!
//! É COMPOSIÇÃO E NÃO POSSUI UM PIXEL. O link é do `tools/graph.ts`, o desenho é do
//! my-graph, a janela é do my-canvas. Empresa que se desenha com ferramenta própria
//! fica com duas verdades sobre a própria forma, e a segunda é sempre a mais bonita
//! e a mais velha.
//!
//! `localhost:4173` E NÃO `my-graph.localhost` — medido 20/08: o ATS do macOS bloqueia
//! http:// num WKWebView empacotado, e a chave que libera (`NSAllowsLocalNetworking`,
//! posta pelo build do my-canvas) cobre nome NÃO QUALIFICADO. `my-graph.localhost`
//! passa pelo Caddy e é qualificado; a janela abre em branco e o log nativo diz que
//! carregou.
//!
//! depends_on: apps/my_cli/src/tools/graph.ts · packages/my-canvas
//! impacts:    packages/interfaces/company.ts

import { up } from "../tools/graph.ts";

/** O viewer atrás do Caddy responde nos dois; a janela só aceita este. */
const DIRETO = "http://localhost:4173";

/** A leitura que a empresa abre: o nó `company` selecionado.
 *
 *  ponytail: hoje é o grafo dos CONTRATOS com o nó da empresa em foco, porque
 *  `apps/my-company/` está vazio. Quando ele tiver os processos, isto passa a
 *  apontar um MY_GRAPH_ROOT próprio — a mudança é a raiz, não o desenho. */
export function url(): string {
	return `${DIRETO}/#sel=company`;
}

/** O launcher do app empacotado. `build/` não é versionado: quem nunca rodou o build
 *  do my-canvas recebe a instrução, não um erro de arquivo. */
function launcher(): string {
	return new URL("../../../../packages/my-canvas/build/dev-macos-arm64/MyApp-dev.app/Contents/MacOS/launcher", import.meta.url).pathname;
}

export async function open(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
	if (!(await up())) return { ok: false, error: `ninguém servindo o my-graph — suba: cd apps/my-graph && bun run dev --port 4173` };
	const bin = launcher();
	if (!(await Bun.file(bin).exists())) return { ok: false, error: `my-canvas não construído — rode: cd packages/my-canvas && bun run build` };

	const link = url();
	// SPAWN DESACOPLADO: a janela sobrevive ao comando. Grafo é coisa que se olha, e
	// ninguém fica com o terminal preso olhando um desenho.
	Bun.spawn([bin], {
		env: { ...process.env, MY_CANVAS_URL: link, MY_CANVAS_TITLE: "my company" },
		stdout: "ignore",
		stderr: "ignore",
		stdin: "ignore",
	}).unref();
	return { ok: true, url: link };
}

export async function main(argv: string[]): Promise<number> {
	if (argv.includes("--url")) return (console.log(url()), 0);
	const r = await open();
	if (!r.ok) return (console.error(`my company graph: ${r.error}`), 1);
	console.log(r.url);
	return 0;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));
