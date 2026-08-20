#!/usr/bin/env bun
//! O viewer do grafo: o LINK de uma leitura, se tem alguém servindo, e abrir.
//!
//! `github.com/biliboss/my-graph` — nosso código, release DELE.
//!
//!     my tools graph url                          o grafo como ele abre
//!     my tools graph url --open shared,tools      dois arquivos abertos em anel
//!     my tools graph url --sel kanban::Metrics --ext --hub-hidden -d compact -t aura
//!     my tools graph up                           está servindo? exit 0/1
//!     my tools graph open --sel tools             abre no browser
//!
//! A URL É O ESTADO. O viewer não guarda nada: `lib/viewer-state.ts` de lá lê
//! tudo do hash (`#open=…&sel=…&d=…&ext=1&hub=0&t=…`), então uma leitura do grafo
//! é uma string que esta casa cola num card, num commit ou numa conversa — e que
//! continua certa depois do código mudar, porque o desenho é renderizado na hora
//! de abrir.
//!
//! PARÂMETRO NO DEFAULT É OMITIDO, e não é economia de bytes: o `serialize()` de
//! lá faz exatamente isso, e uma URL que escreve `d=comfortable` à mão passa a
//! carregar uma escolha que ninguém fez — no dia em que o default de lá mudar,
//! ela congela o antigo. Os defaults estão em `~/src/my-graph/lib/viewer-state.ts`
//! (`comfortable`, `monokai`, sem externals, sem hub escondido) e são DELE.
//!
//! `up()` é async e `url()` não: perguntar se alguém serve é falar com um
//! programa de fora, montar um link é aritmética de string. Falha de fora aqui é
//! EVENTO — `up()` devolve `false` pra servidor no chão, e nunca joga.
//!
//! depends_on: ~/src/my-graph/lib/viewer-state.ts
//! impacts:    src/interfaces/tools.ts · src/tools/check.ts

import { flag } from "../shared/gh.ts";

/** Caddy (`/opt/homebrew/etc/Caddyfile`) manda `my-graph.localhost` pro Next em
 *  `:4173`. http e não https: nada aqui sai da máquina. */
export const BASE = "http://my-graph.localhost";

export type Density = "compact" | "balanced" | "comfortable";

/** O que o viewer mostra — cada campo é um parâmetro do hash. */
export type View = {
	/** Arquivos com as interfaces abertas em anel. */
	open?: string[];
	/** `kanban`, ou `kanban::Metrics` pra uma interface dele. */
	selected?: string;
	density?: Density;
	/** Desenha os `src/…` citados; desligado por default. */
	externals?: boolean;
	/** Esconde as setas que ENTRAM no hub. */
	hideHub?: boolean;
	/** Um nome de paleta do `ui/Themes.tsx` de lá — aberto, a lista é DELE. */
	theme?: string;
};

/** Os defaults do viewer, copiados de `lib/viewer-state.ts`. Copiados e não
 *  importados: o app é outro checkout, com release própria — se ele mudar um
 *  default, o link daqui continua válido, só passa a citar o valor explicitamente
 *  até alguém sincronizar esta linha. */
const DEFAULTS = { density: "comfortable" as Density, theme: "monokai" };

/** A URL de uma leitura. Espelha o `serialize()` do viewer: campo no default sai
 *  da URL, e `hub=0` (não `hub=1`) é como lá se pede o hub escondido. */
export function url(view: View = {}): string {
	const p = new URLSearchParams();
	if (view.open?.length) p.set("open", view.open.join(","));
	if (view.selected) p.set("sel", view.selected);
	if (view.density && view.density !== DEFAULTS.density) p.set("d", view.density);
	if (view.externals) p.set("ext", "1");
	if (view.hideHub) p.set("hub", "0");
	if (view.theme && view.theme !== DEFAULTS.theme) p.set("t", view.theme);
	const q = p.toString();
	return `${BASE}/${q ? `#${q}` : ""}`;
}

/** Tem alguém servindo? Uma resposta HTTP qualquer basta: quem responde é o Caddy
 *  quando o Next está de pé, e recusa a conexão quando não está. */
export async function up(timeoutMs = 3000): Promise<boolean> {
	try {
		const r = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(timeoutMs), redirect: "manual" });
		return r.status < 500;
	} catch {
		// Conexão recusada, DNS, timeout: as três respondem a mesma pergunta —
		// ninguém está servindo. O texto do erro é do sistema operacional, não uma
		// informação sobre o grafo.
		return false;
	}
}

/** Abre no browser. `open(1)` é do macOS, e é o mesmo mecanismo que um clique. */
export function open(view: View = {}): { ok: true; url: string } | { ok: false; error: string } {
	const link = url(view);
	const r = Bun.spawnSync(["open", link], { stdout: "ignore", stderr: "pipe" });
	if (r.exitCode !== 0) return { ok: false, error: new TextDecoder().decode(r.stderr).trim() || `open exited ${r.exitCode}` };
	return { ok: true, url: link };
}

/** `--open a,b`, `--sel x`, `-d`, `--ext`, `--hub-hidden`, `-t`. */
function viewOf(argv: string[]): View {
	const list = flag(argv, "--open");
	const density = flag(argv, "-d") ?? flag(argv, "--density");
	return {
		open: list ? list.split(",").filter(Boolean) : undefined,
		selected: flag(argv, "--sel") ?? flag(argv, "--selected"),
		density: density as Density | undefined,
		externals: argv.includes("--ext") || argv.includes("--externals"),
		hideHub: argv.includes("--hub-hidden"),
		theme: flag(argv, "-t") ?? flag(argv, "--theme"),
	};
}

export async function main(argv: string[]): Promise<number> {
	const verbo = argv[0];
	const view = viewOf(argv.slice(1));

	if (verbo === "url") return (console.log(url(view)), 0);

	if (verbo === "up") {
		const servindo = await up();
		// Exit 1 quando está no chão: é o que deixa `my tools graph up && …` valer,
		// e é a mesma convenção dos checks desta casa.
		console.log(servindo ? `up ${BASE}` : `down ${BASE} — o Next de ~/src/my-graph não está em :4173`);
		return servindo ? 0 : 1;
	}

	if (verbo === "open") {
		if (!(await up())) {
			console.error(`my tools graph open: ninguém servindo em ${BASE} — suba o viewer em ~/src/my-graph`);
			return 1;
		}
		const r = open(view);
		if (!r.ok) return (console.error(`my tools graph open: ${r.error}`), 1);
		console.log(r.url);
		return 0;
	}

	console.error("uso: my tools graph <url|up|open> [--open a,b] [--sel x] [-d compact|balanced|comfortable] [--ext] [--hub-hidden] [-t tema]");
	return 2;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));
