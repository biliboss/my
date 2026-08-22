//! my-canvas — a superfície. Uma janela nativa que abre uma URL, e nada mais.
//!
//! A URL VEM DO AMBIENTE (`MY_CANVAS_URL`), não de argv: o launcher do Electrobun é
//! quem executa este processo, e os argumentos que ele repassa não são contrato.
//! Ambiente atravessa spawn sem depender do formato de linha de comando dele.
//!
//! `open()` NÃO PRECISA DE RPC — é o `ask()` que precisa, e ele ainda não existe.
//! Trazer o RPC agora seria pagar a complexidade da resposta antes de alguém ter
//! uma pergunta pra fazer.
//!
//! A JANELA NASCIA EM (0,0), SEMPRE, E A FALHA QUE ISTO EVITA É DUPLA: (0,0) é o
//! canto do monitor PRINCIPAL, e num Mac esse canto está debaixo da barra de
//! menu — a barra de título nasce coberta; e quem lê o grafo num monitor com o
//! editor no outro recebia a janela sempre no monitor errado, e arrastava à mão
//! toda vez. O Electrobun 1.18.1 já sabe responder isso (`Screen`,
//! `Display { bounds, workArea, scaleFactor, isPrimary }`).
//!
//! A ARITMÉTICA NÃO MORA AQUI, mora em `place.ts`: importar ESTE arquivo abre uma
//! janela, então nada testável pode viver dentro dele.

import { BrowserWindow, Screen } from "electrobun/bun";
import { place, type Monitor } from "./place.ts";

const url = process.env.MY_CANVAS_URL ?? "about:blank";
const title = process.env.MY_CANVAS_TITLE ?? "my-canvas";

/** Só o que foi PEDIDO vira número. Variável ausente é "não disse", e `Number("")`
 *  é 0 — que centraria a janela no canto em vez de cair no padrão. */
const num = (v: string | undefined) => (v === undefined || v.trim() === "" ? undefined : Number(v));

const frame = place(Screen.getAllDisplays() as Monitor[], Screen.getCursorScreenPoint(), {
	monitor: process.env.MY_CANVAS_MONITOR,
	width: num(process.env.MY_CANVAS_WIDTH),
	height: num(process.env.MY_CANVAS_HEIGHT),
	x: num(process.env.MY_CANVAS_X),
	y: num(process.env.MY_CANVAS_Y),
});

// ponytail: fullscreen é o tamanho da tela, não a API de fullscreen do sistema —
// o modo nativo joga a janela pra um Space novo no macOS, que é exatamente o que
// o askuser mediu e recusou em 19/08. Se um dia alguém quiser o Space, é um modo
// novo, não uma troca deste.
const win = new BrowserWindow({ title, url, frame });

// A URL NO CONSTRUTOR NÃO NAVEGA SOZINHA — medido 20/08: a janela abre com título
// certo e conteúdo em branco. `loadURL` no webview é o que de fato manda o WKWebView
// buscar a página, e o próprio código do Electrobun deixa a pista ("if we're manually
// calling loadURL/loadHTML below").
win.webview.loadURL(url);
