#!/usr/bin/env bun
//! A JANELA — abre uma URL no `packages/my-canvas` e volta.
//!
//! `my tools canvas open <url> [--title t]`
//!
//! É `tools` pelo teste da casa: o my-canvas tem release próprio (Electrobun
//! empacotado, 27 MB de binário nativo), e um bug dele não se conserta no mesmo
//! commit do chamador.
//!
//! DOIS CHAMADORES JÁ EXISTEM — `my graph` e `my company graph` — e é por isso que
//! isto virou arquivo em vez de continuar copiado nos dois.
//!
//! `localhost` E NÃO UM HOST QUALIFICADO: o ATS do macOS bloqueia http:// num
//! WKWebView empacotado, e a chave que o build do my-canvas põe
//! (`NSAllowsLocalNetworking`) cobre nome NÃO qualificado. Com `my-graph.localhost` a
//! janela abre em branco e o log nativo diz que carregou — medido 20/08.
//!
//! depends_on: packages/my-canvas

/** O launcher do app empacotado. `build/` não é versionado: quem nunca rodou o build
 *  recebe a instrução, não um erro de arquivo. */
export function launcher(): string {
	return new URL("../../../../packages/my-canvas/build/dev-macos-arm64/MyApp-dev.app/Contents/MacOS/launcher", import.meta.url).pathname;
}

export async function ready(): Promise<boolean> {
	return await Bun.file(launcher()).exists();
}

export async function open(url: string, title = "my-canvas"): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
	if (!(await ready())) return { ok: false, error: "my-canvas não construído — rode: cd packages/my-canvas && bun run build" };
	// SPAWN DESACOPLADO: a janela sobrevive ao comando. Ninguém fica com o terminal
	// preso olhando um desenho.
	Bun.spawn([launcher()], {
		env: { ...process.env, MY_CANVAS_URL: url, MY_CANVAS_TITLE: title },
		stdout: "ignore", stderr: "ignore", stdin: "ignore",
	}).unref();
	return { ok: true, url };
}

export async function main(argv: string[]): Promise<number> {
	if (argv[0] !== "open" || !argv[1]) return (console.error("uso: my tools canvas open <url> [--title t]"), 2);
	const t = argv.indexOf("--title");
	const r = await open(argv[1], t > -1 ? argv[t + 1] : undefined);
	if (!r.ok) return (console.error(`my tools canvas: ${r.error}`), 1);
	console.log(r.url);
	return 0;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));
