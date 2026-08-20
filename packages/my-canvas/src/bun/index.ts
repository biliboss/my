//! my-canvas — a superfície. Uma janela nativa que abre uma URL, e nada mais.
//!
//! A URL VEM DO AMBIENTE (`MY_CANVAS_URL`), não de argv: o launcher do Electrobun é
//! quem executa este processo, e os argumentos que ele repassa não são contrato.
//! Ambiente atravessa spawn sem depender do formato de linha de comando dele.
//!
//! `open()` NÃO PRECISA DE RPC — é o `ask()` que precisa, e ele ainda não existe.
//! Trazer o RPC agora seria pagar a complexidade da resposta antes de alguém ter
//! uma pergunta pra fazer.

import { BrowserWindow } from "electrobun/bun";

const url = process.env.MY_CANVAS_URL ?? "about:blank";
const title = process.env.MY_CANVAS_TITLE ?? "my-canvas";
// ponytail: fullscreen é o tamanho da tela, não a API de fullscreen do sistema —
// o modo nativo joga a janela pra um Space novo no macOS, que é exatamente o que
// o askuser mediu e recusou em 19/08. Se um dia alguém quiser o Space, é um modo
// novo, não uma troca deste.
const w = Number(process.env.MY_CANVAS_WIDTH ?? 1600);
const h = Number(process.env.MY_CANVAS_HEIGHT ?? 1000);

const win = new BrowserWindow({
	title,
	url,
	frame: { x: 0, y: 0, width: w, height: h },
});

// A URL NO CONSTRUTOR NÃO NAVEGA SOZINHA — medido 20/08: a janela abre com título
// certo e conteúdo em branco. `loadURL` no webview é o que de fato manda o WKWebView
// buscar a página, e o próprio código do Electrobun deixa a pista ("if we're manually
// calling loadURL/loadHTML below").
win.webview.loadURL(url);
