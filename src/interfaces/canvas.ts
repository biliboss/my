//! `canvas` — DRAFT. A superfície onde um agente DESENHA, e a única janela desta
//! casa. Tipos só; nada implementado atrás disto ainda.
//!
//! ── POR QUE ELE EXISTE ───────────────────────────────────────────────────────
//!
//! ESTA CASA TEM QUATRO JANELAS PRA AGENTE — `askuser` (Neutralino + Next +
//! RocksDB), `popuper` (Electron), `agent-deck` (Tauri) e o `Window` que estava
//! desenhado em `tools.ts` e nunca virou código. Nenhuma delas é o problema; TER
//! QUATRO é. Este arquivo só se justifica se as outras três morrem — e enquanto
//! não morrerem, ele é a quinta.
//!
//! O CORTE VEM DO `askuser`, e ele já estava escrito lá: *"a janela é SUPERFÍCIE,
//! não peça"*. O que sai do `askuser` é a janela; o que FICA é a espinha dele —
//! RocksDB, rodada, `fecha()`, o `409`, e expirar sem ninguém contando tempo.
//! Disco é dele. Pixel é daqui.
//!
//! ── O FILE, E A REGRA QUE ELE DOBRA ──────────────────────────────────────────
//!
//! PELO TESTE DO `tools.ts` — *quem este repo consegue mudar em UM commit* — o
//! canvas é `tools`: mora em `github.com/biliboss/my-canvas`, com release próprio,
//! igual `my-graph`. Ele ganha arquivo mesmo assim, e a razão é a direção da
//! quebra: `tools` agrupa programa que QUEBRA A GENTE de fora pra dentro, e um
//! outage lá tem dono óbvio. Toda superfície desta casa passa por aqui — quando o
//! canvas cai, não cai um verbo, cai a capacidade de PERGUNTAR. Isso não é um
//! adaptador entre outros vinte.
//!
//! ── TAURI, E A MEDIÇÃO QUE PARECE CONTRADIZER ────────────────────────────────
//!
//! O `askuser` MEDIU Tauri em 19/08 e apagou: toolchain Rust, `cargo build` ~1 min,
//! `target/` ~1 GB — contra ~2 MB do Neutralino. A medição continua verdadeira e
//! não é ela que mudou: mudou o REQUISITO.
//!
//! A janela do `askuser` só carregava uma URL, então dava pra entregá-la com a API
//! nativa DESLIGADA — e foi assim que ela nasceu. O canvas precisa de monitor,
//! posição, fullscreen sob controle, IPC de volta da página e lista do que está
//! aberto: exatamente a API que estava desligada. Neutralino aqui custaria religar
//! e reescrever tudo o que o `agent-deck` — que JÁ é Tauri — já faz.
//!
//! ── O SERVIDOR MORA DENTRO ───────────────────────────────────────────────────
//!
//! Decidido em 20/08. O canvas sobe um servidor local seu: serve o que foi
//! empurrado, mantém um SSE pra redesenhar sem recarregar, e aceita um POST com o
//! que a página respondeu. É o que faz `Content` aceitar HTML e não só `Url` — sem
//! ele, todo consumidor precisa subir um app Next só pra mostrar uma tela.
//!
//! `my-graph` continua vindo por `Url`: ele TEM servidor, e duplicar a tela dele
//! aqui criaria a segunda verdade que o `askuser` recusou por escrito.
//!
//! external:    Tauri · WebView do sistema
//! implemented: nada
//! planned:     github.com/biliboss/my-canvas
//! depends_on:  src/shared/result.ts
//! substitui:   o namespace `Window` de src/interfaces/tools.ts — e ele SAI de lá
//!              no mesmo commit em que este nascer, não depois
//! checks:      declarado AQUI, nunca importado. `check()` devolve `Finding[]` e o
//!              runner lê a forma, então um check não custa dependência.

/** O que este sistema achou podre. Declarado aqui em vez de importado: o runner lê
 *  a forma, então ter um check não custa dependência de hub. */
export interface Finding {
	path: string;
	says: string;
}

import type { Shared } from "./shared";

export declare namespace CanvasSystem {
	/** Uma superfície aberta. Vem do canvas, nunca do chamador — id escolhido de
	 *  fora é id que colide entre dois agentes que não se conhecem. */
	export type SurfaceId = string;

	export type Url = `http://${string}` | `https://${string}`;

	/** HTML completo, servido pelo servidor de dentro. */
	export type Html = string;

	/** O QUE VAI NA TELA, e as duas formas não são intercambiáveis: `url` é uma tela
	 *  que tem dono e servidor próprios, `html` é uma tela que só existe nesta
	 *  chamada. Um app com servidor que manda `html` está duplicando a própria tela. */
	export type Content = { url: Url } | { html: Html };

	/** COMO a janela se comporta, e não que tamanho ela tem. `panel` é a de decisão —
	 *  pequena, acima de tudo, sem entrar no Exposé; é a forma que uma pergunta
	 *  precisa pra não ser respondida por um agente desatento. */
	export type Mode = "fullscreen" | "window" | "panel";

	/** Onde na tela, por NOME. Coordenada crua existe, mas quem pede "canto de baixo
	 *  à direita" não deveria fazer aritmética com a resolução do monitor. */
	export type Place =
		| "center" | "top" | "bottom" | "left" | "right"
		| "top-left" | "top-right" | "bottom-left" | "bottom-right"
		| { x: number; y: number };

	export interface Monitor {
		id: string;
		name: string;
		primary: boolean;
		bounds: { x: number; y: number; width: number; height: number };
	}

	export interface Options {
		/** O que vai na barra e no Dock. Sem ele, duas janelas desta casa ficam
		 *  indistinguíveis e o Dock mostra o nome do runtime. */
		title?: string;
		mode?: Mode;
		/** Ausente = o monitor onde está o foco, não o primário. */
		monitor?: string;
		place?: Place;
		/** Ignorado em `fullscreen`. */
		size?: { width: number; height: number };
		/** Padrão `true` só em `panel`: uma janela que fica o dia todo roubando foco
		 *  atrapalha mais do que ajuda (medido no `askuser`, 19/08). */
		alwaysOnTop?: boolean;
		/** SEM MOLDURA A JANELA FICA PRESA quando a página é servida de fora — não há
		 *  `-webkit-app-region: drag` numa tela que não é nossa. Só use em quiosque, ou
		 *  em tela que ninguém precisa mover. */
		borderless?: boolean;
		/** Fecha sozinha depois de N ms. O portão que impede uma pergunta esquecida de
		 *  segurar um agente pra sempre. */
		timeout?: Shared.Millis;
	}

	export interface Opened {
		ok: true;
		id: SurfaceId;
		title?: string;
		mode: Mode;
		at: Shared.Instant;
	}

	/** POR QUE NÃO ABRIU, e as quatro se respondem diferente: sem runtime se resolve
	 *  instalando, `spawn` é máquina cheia, `unreachable` é o servidor da URL que não
	 *  subiu, e `no_display` é sessão sem tela — o caso do agente em SSH, onde abrir
	 *  janela nunca vai funcionar e insistir é laço infinito. */
	export type Fail = {
		ok: false;
		error: string;
		reason: "not_installed" | "spawn" | "unreachable" | "no_display" | "not_found";
	};

	/** COMO A SUPERFÍCIE TERMINOU. São QUATRO, e o quarto é o motivo do `askuser`
	 *  existir: *"pulou"* é a pessoa que VIU e decidiu não decidir agora. Tratar
	 *  `skipped` ou `timeout` como `answered` é seguir com uma decisão que ninguém
	 *  tomou — e é o que toda API de prompt permite por omissão.
	 *
	 *  `closed` é a janela fechada no X: não houve leitura, e é diferente de pular. */
	export type How = "answered" | "skipped" | "timeout" | "closed";

	export interface Answer {
		ok: true;
		how: How;
		/** Ausente quando `how` não é `answered`. A ausência É o contrato do portão:
		 *  fechar sem responder NÃO é responder. */
		text?: string;
		/** O índice da opção, quando a página ofereceu opções. */
		chosen?: number;
		at: Shared.Instant;
	}

	/** O QUE A PÁGINA EMITIU sem fechar — um clique, um scroll, um passo concluído.
	 *  ABERTO de propósito: o `name` é escolhido pela página, que é código de outro
	 *  repo, e enum fechado descartaria em silêncio o evento que ainda não existe. */
	export interface Event {
		surface: SurfaceId;
		name: string;
		data?: unknown;
		at: Shared.Instant;
	}
}

/** `my canvas <verbo>`. Uma superfície, muitos donos: quem abre nomeia o que quer
 *  ver, nunca como desenhar. */
export interface Canvas {
	/** O runtime responde e o servidor de dentro sobe? A única checagem honesta pra
	 *  algo com release próprio — e nenhuma delas é síncrona. */
	check(): Promise<Finding[]>;

	/** O runtime está instalado? Separado de `open` de propósito: baixar na primeira
	 *  chamada é uma espera que o chamador merece prever. */
	ready(): Promise<boolean>;

	/** As telas físicas. Sem isto, `place` e `monitor` são chute — e o layout de dois
	 *  monitores é a diferença entre a pergunta na cara e a pergunta atrás. */
	monitors(): Promise<CanvasSystem.Monitor[]>;

	/** Abre e VOLTA. A superfície sobrevive à chamada — é o que `my-graph` quer,
	 *  porque ninguém fica olhando um grafo com o terminal preso. */
	open(
		content: CanvasSystem.Content,
		opts?: CanvasSystem.Options,
	): Promise<CanvasSystem.Opened | CanvasSystem.Fail>;

	/** Abre e ESPERA. Bloquear é a feature: pergunta que não segura o chamador é
	 *  pergunta que um agente desatento responde sozinho. A diferença entre este
	 *  verbo e `open` não é técnica, é quem manda no tempo. */
	ask(
		content: CanvasSystem.Content,
		opts?: CanvasSystem.Options,
	): Promise<CanvasSystem.Answer | CanvasSystem.Fail>;

	/** Redesenha o que já está aberto, pelo SSE — sem recarregar e sem piscar. É o
	 *  verbo que faz uma superfície virar PROGRESSO em vez de N janelas. */
	render(
		id: CanvasSystem.SurfaceId,
		content: CanvasSystem.Content,
	): Promise<{ ok: true; id: CanvasSystem.SurfaceId } | CanvasSystem.Fail>;

	/** O que a página emitiu, conforme emite. Termina quando a superfície fecha. */
	listen(id: CanvasSystem.SurfaceId): AsyncIterable<CanvasSystem.Event>;

	/** PNG do que está na tela. É como um agente VÊ a própria superfície — sem isto,
	 *  ele afirma que desenhou e ninguém, nem ele, conferiu. */
	shot(
		id: CanvasSystem.SurfaceId,
		out: string,
	): Promise<{ ok: true; path: string } | CanvasSystem.Fail>;

	/** As superfícies desta casa abertas agora. Sem isto, uma janela que perdeu o
	 *  dono fica na tela e ninguém sabe quem a abriu. */
	list(): Promise<CanvasSystem.Opened[]>;

	focus(id: CanvasSystem.SurfaceId): Promise<{ ok: true; id: CanvasSystem.SurfaceId } | CanvasSystem.Fail>;

	close(id: CanvasSystem.SurfaceId): Promise<{ ok: true; id: CanvasSystem.SurfaceId } | CanvasSystem.Fail>;
}
