#!/usr/bin/env bun
//! A JANELA — abre uma URL no `packages/my-canvas` e volta.
//!
//! `my tools canvas open <url> [--title t] [--monitor cursor|primary|<id>] [--size WxH] [--at X,Y]`
//!
//! É `tools` pelo teste da casa: o my-canvas tem release próprio (Electrobun
//! empacotado, 27 MB de binário nativo), e um bug dele não se conserta no mesmo
//! commit do chamador.
//!
//! DOIS CHAMADORES JÁ EXISTEM — `my graph` e `my company graph` — e é por isso que
//! isto virou arquivo em vez de continuar copiado nos dois. Os dois chamam
//! `open(url, title)` posicional, então MONITOR E TAMANHO ENTRAM COMO TERCEIRO
//! ARGUMENTO OPCIONAL: mudar a aridade quebraria os dois sem um erro de tipo em
//! quem só passa dois.
//!
//! MONITOR VAI POR NOME, NÃO POR COORDENADA. A falha que isto evita: `--at 1920,0`
//! só está certo enquanto o segundo monitor estiver à direita e com aquela
//! largura — desconectar um cabo transforma a mesma linha de comando numa janela
//! fora da tela. Quem resolve nome em retângulo é o `my-canvas`, que é quem tem o
//! `Screen` do Electrobun na mão.
//!
//! `localhost` E NÃO UM HOST QUALIFICADO: o ATS do macOS bloqueia http:// num
//! WKWebView empacotado, e a chave que o build do my-canvas põe
//! (`NSAllowsLocalNetworking`) cobre nome NÃO qualificado. Com `my-graph.localhost` a
//! janela abre em branco e o log nativo diz que carregou — medido 20/08.
//!
//! depends_on: packages/my-canvas

/** Onde a janela nasce. Tudo opcional: sem nada, o my-canvas centra na área útil
 *  do monitor onde o cursor está. */
export type Where = {
	/** `cursor` (padrão) · `primary` · o id de um display · o índice na lista. */
	monitor?: string;
	width?: number;
	height?: number;
	/** Deslocamento DENTRO do monitor escolhido, não coordenada de tela. */
	x?: number;
	y?: number;
};

/** O launcher do app empacotado. `build/` não é versionado: quem nunca rodou o build
 *  recebe a instrução, não um erro de arquivo. */
export function launcher(): string {
	return new URL("../../../../packages/my-canvas/build/dev-macos-arm64/MyApp-dev.app/Contents/MacOS/launcher", import.meta.url).pathname;
}

export async function ready(): Promise<boolean> {
	return await Bun.file(launcher()).exists();
}

/** Só o que foi PEDIDO atravessa. Uma variável presente e vazia não é "não
 *  disse": o my-canvas leria `""`, `Number("")` é 0, e a janela nasceria com
 *  largura zero em vez de cair no padrão dele. */
function env(where: Where): Record<string, string> {
	const out: Record<string, string> = {};
	if (where.monitor) out.MY_CANVAS_MONITOR = where.monitor;
	if (where.width !== undefined) out.MY_CANVAS_WIDTH = String(where.width);
	if (where.height !== undefined) out.MY_CANVAS_HEIGHT = String(where.height);
	if (where.x !== undefined) out.MY_CANVAS_X = String(where.x);
	if (where.y !== undefined) out.MY_CANVAS_Y = String(where.y);
	return out;
}

export async function open(url: string, title = "my-canvas", where: Where = {}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
	if (!(await ready())) return { ok: false, error: "my-canvas não construído — rode: cd packages/my-canvas && bun run build" };
	// SPAWN DESACOPLADO: a janela sobrevive ao comando. Ninguém fica com o terminal
	// preso olhando um desenho.
	Bun.spawn([launcher()], {
		env: { ...process.env, MY_CANVAS_URL: url, MY_CANVAS_TITLE: title, ...env(where) },
		stdout: "ignore", stderr: "ignore", stdin: "ignore",
	}).unref();
	return { ok: true, url };
}

/** `--size 1200x800` e `--at 40,20`. Um par num argumento só porque largura sem
 *  altura não quer dizer nada, e duas flags separadas deixam metade cair. */
function pair(argv: string[], flag: string, sep: RegExp): [number, number] | null {
	const at = argv.indexOf(flag);
	if (at < 0) return null;
	const parts = (argv[at + 1] ?? "").split(sep).map(Number);
	if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
	return [parts[0], parts[1]];
}

export function parse(argv: string[]): Where {
	const m = argv.indexOf("--monitor");
	const size = pair(argv, "--size", /x/i);
	const at = pair(argv, "--at", /,/);
	return {
		...(m > -1 && argv[m + 1] ? { monitor: argv[m + 1] } : {}),
		...(size ? { width: size[0], height: size[1] } : {}),
		...(at ? { x: at[0], y: at[1] } : {}),
	};
}

export async function main(argv: string[]): Promise<number> {
	if (argv[0] !== "open" || !argv[1]) return (console.error("uso: my tools canvas open <url> [--title t] [--monitor cursor|primary|<id>] [--size WxH] [--at X,Y]"), 2);
	const t = argv.indexOf("--title");
	const r = await open(argv[1], t > -1 ? argv[t + 1] : undefined, parse(argv));
	if (!r.ok) return (console.error(`my tools canvas: ${r.error}`), 1);
	console.log(r.url);
	return 0;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));
