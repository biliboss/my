//! `my-canvas` — DRAFT. A base de DESKTOP da família. Tipos só, nada atrás disto.
//!
//! ── SOZINHO ELE NÃO TEM VALOR, e é por isso que é `packages/` ──────────────────
//!
//! Um `apps/*` é uma coisa que alguém abre. Este não é: ninguém quer "abrir o
//! canvas". O que se quer é o `my-graph` VIRANDO aplicativo, o `my-kanban` com
//! ícone no Dock, uma pergunta do `my` na frente do que a pessoa está fazendo. O
//! canvas é o chão dos três — some ele e cada um reescreve janela do seu jeito, que
//! é exatamente o estado de onde esta casa está saindo.
//!
//! QUATRO JANELAS EXISTIAM, e TER QUATRO era o problema, nunca qual delas: `askuser`
//! (Neutralino), `popuper` (Electron), `agent-deck` (Tauri) e um namespace `Window`
//! desenhado em `packages/interfaces/tools.ts` que nunca virou código. Este arquivo só se
//! paga se os quatro morrerem — enquanto não morrerem, ele é o quinto.
//!
//! O CORTE VEM DO `askuser`, e estava escrito lá antes de existir canvas: *"a janela
//! é SUPERFÍCIE, não peça"*. Sai a janela; fica a espinha — a rodada, o `fecha()`, o
//! `409`, expirar sem ninguém contando tempo. Disco é dele. Pixel é daqui.
//!
//! ── ELECTROBUN, E O QUE ELE APAGA DESTE DESENHO ──────────────────────────────
//!
//! Trocado em 20/08. O desenho anterior era Tauri e carregava DUAS decisões que
//! existiam só pra contornar o que o runtime não dava — as duas caem, e é isso que
//! justifica a troca. Verificado no fonte do Electrobun, não de memória:
//!
//!   O SERVIDOR DE DENTRO MORREU. O desenho anterior subia um HTTP local pra servir
//!   `html` e um SSE pra redesenhar. Electrobun serve o bundle por um esquema
//!   próprio (`views://`, atendido nativamente a partir de um ASAR) e aceita HTML
//!   inline por `loadHTML`. Servidor pra mostrar tela vira código que existia só
//!   pra existir.
//!
//!   O POST DE VOLTA MORREU. Era a pergunta em aberto do `Window`: como a página
//!   devolve a resposta. Electrobun tem RPC TIPADO e bidirecional (`defineElectrobunRPC`),
//!   WebSocket por baixo, chave AES-256-GCM por webview. A página chama
//!   `window.electrobun.rpc.request.<verbo>()`; o processo bun chama de volta por
//!   `win.webview.rpc.request.<verbo>()`. `Answer` e `Event` andam por aí.
//!
//! E BUN É O PROCESSO PRINCIPAL, que é a razão de não ser Electron: esta casa
//! inteira já é Bun, então o shell não traz um segundo runtime junto.
//!
//! ── O QUE ELE NÃO DÁ, E ISSO É CONTRATO TAMBÉM ───────────────────────────────
//!
//! MONITOR NÃO É OPÇÃO DE JANELA. `frame` recebe `{x, y, width, height}` e mais
//! nada; escolher tela é aritmética NOSSA sobre `GetAllDisplays`. Por isso
//! `monitors()` é verbo aqui em vez de um campo em `Options` — a conta existe, e o
//! desenho tem que dizer de quem ela é. Quem pede "canto de baixo à direita" não
//! deveria multiplicar resolução na mão, e é o que `Place` compra.
//!
//! `shot()` ESTÁ DECLARADO E NÃO VERIFICADO. Não achei captura de tela na API, e
//! declarar sem medir é como um contrato começa a mentir — quem for implementar
//! confere primeiro, e se não existir, ou sai daqui ou entra por FFI com o custo
//! escrito ao lado. É o único membro deste arquivo nesse estado.
//!
//! ── COMO ELE SE ATUALIZA ─────────────────────────────────────────────────────
//!
//! Uma base de desktop tem que responder isso, senão cada app inventa o seu. O
//! updater do Electrobun manda DELTA binário (`bsdiff`/`bspatch`) entre hashes de
//! versão — atualização de ~4 KB — e escolhe o manifesto pelo `channel` do
//! `version.json`. `Channel` está no vocabulário abaixo por causa disso: `canary` é
//! o que deixa esta casa comer a própria comida sem arrastar quem só usa.
//!
//! ── A FORMA DESTE ARQUIVO ────────────────────────────────────────────────────
//!
//! UM ARQUIVO, e não uma pasta `interfaces/`. A pasta é o que se faz quando UM
//! arquivo não cabe mais, e "não cabe mais" é medição, não previsão — enquanto
//! couber, uma superfície de leitura só. Quando passar, isso é uma pergunta pro
//! dono, não uma decisão de quem está escrevendo.
//!
//! external:    Electrobun · WKWebView (macOS) · WebView2 (Windows) · CEF (opcional)
//! implemented: nada
//! planned:     packages/my-canvas/
//! usado_por:   apps/my-graph · apps/my-kanban · apps/my
//! substitui:   o namespace `Window` de src/interfaces/tools.ts (Neutralino), que
//!              SAI no mesmo commit em que este nascer — não depois

/** O que este sistema achou podre. Declarado aqui em vez de importado: o runner lê
 *  a FORMA, então ter um check não custa dependência de hub. */
export interface Finding {
	path: string;
	says: string;
}

export declare namespace CanvasSystem {
	/** ISO 8601, `Z`. Declarado aqui e não importado: um pacote publicável não
	 *  depende do `shared` de uma casa pra saber o que é um instante. */
	export type Instant = string;
	export type Millis = number;

	/** Uma superfície aberta. Vem do canvas, NUNCA do chamador — id escolhido de fora
	 *  é id que colide entre dois agentes que não se conhecem. */
	export type SurfaceId = string;

	export type Url = `http://${string}` | `https://${string}` | `views://${string}`;

	/** HTML completo. Vai por `loadHTML`, sem servidor no meio. */
	export type Html = string;

	/** O QUE VAI NA TELA, e as duas formas não são intercambiáveis: `url` é uma tela
	 *  que tem dono e servidor próprios, `html` é uma tela que só existe nesta
	 *  chamada. Um app com servidor que manda `html` está duplicando a própria tela. */
	export type Content = { url: Url } | { html: Html };

	/** COMO a janela se comporta, e não que tamanho ela tem. `panel` é a de DECISÃO —
	 *  pequena, acima de tudo, sem entrar no Exposé; é a forma que uma pergunta
	 *  precisa pra não ser respondida por um agente desatento. */
	export type Mode = "fullscreen" | "window" | "panel";

	/** A barra de título, na palavra do próprio Electrobun (`titleBarStyle`).
	 *  `hiddenInset` é o que dá tela sem cromo COM os semáforos ainda arrastáveis —
	 *  `hidden` puro numa página servida de fora prende a janela, porque não existe
	 *  `-webkit-app-region: drag` numa tela que não é nossa. */
	export type TitleBar = "default" | "hidden" | "hiddenInset";

	/** Onde na tela, por NOME. Coordenada crua existe e é o que vai pro `frame`; o
	 *  nome existe pra quem pede não fazer a conta. */
	export type Place =
		| "center" | "top" | "bottom" | "left" | "right"
		| "top-left" | "top-right" | "bottom-left" | "bottom-right"
		| { x: number; y: number };

	/** O canal de atualização. Aberto porque quem publica pode inventar o seu, e
	 *  fechado descartaria em silêncio um canal que o `version.json` já usa. */
	export type Channel = "stable" | "canary" | (string & {});

	export interface Monitor {
		id: string;
		name: string;
		primary: boolean;
		bounds: { x: number; y: number; width: number; height: number };
	}

	export interface Options {
		/** O que vai na barra e no Dock. Sem ele, o Dock mostra o nome do runtime e
		 *  duas janelas desta casa ficam indistinguíveis. */
		title?: string;
		mode?: Mode;
		titleBar?: TitleBar;
		/** Ausente = o monitor onde está o FOCO, não o primário. A diferença é a
		 *  pergunta na cara ou a pergunta atrás. */
		monitor?: string;
		place?: Place;
		/** Ignorado em `fullscreen`. */
		size?: { width: number; height: number };
		/** Padrão `true` só em `panel`: janela que fica o dia todo roubando foco
		 *  atrapalha mais do que ajuda (medido no `askuser`, 19/08). */
		alwaysOnTop?: boolean;
		/** Fundo transparente. Só com `passthrough` decidido junto — transparente sem
		 *  passthrough é uma área que parece vazia e come o clique. */
		transparent?: boolean;
		/** O clique atravessa a região transparente e chega em quem está atrás. */
		passthrough?: boolean;
		/** Fecha sozinha depois de N ms. O portão que impede uma pergunta esquecida de
		 *  segurar um agente pra sempre. */
		timeout?: Millis;
	}

	export interface Opened {
		ok: true;
		id: SurfaceId;
		title?: string;
		mode: Mode;
		at: Instant;
	}

	/** POR QUE NÃO ABRIU, e as cinco se respondem diferente: sem runtime se resolve
	 *  instalando, `spawn` é máquina cheia, `unreachable` é o servidor da URL que não
	 *  subiu, `not_found` é id que não existe mais, e `no_display` é sessão sem tela —
	 *  o caso do agente em SSH, onde abrir janela nunca vai funcionar e insistir é
	 *  laço infinito. */
	export type Fail = {
		ok: false;
		error: string;
		reason: "not_installed" | "spawn" | "unreachable" | "no_display" | "not_found";
	};

	/** COMO A SUPERFÍCIE TERMINOU. São QUATRO, e o segundo é o motivo do `askuser`
	 *  existir: *pulou* é a pessoa que VIU e decidiu não decidir agora. Tratar
	 *  `skipped` ou `timeout` como `answered` é seguir com uma decisão que ninguém
	 *  tomou — e é o que toda API de prompt permite por omissão.
	 *
	 *  `closed` é o X: não houve leitura, e é diferente de pular. */
	export type How = "answered" | "skipped" | "timeout" | "closed";

	export interface Answer {
		ok: true;
		how: How;
		/** Ausente quando `how` não é `answered`. A ausência É o contrato do portão:
		 *  fechar sem responder NÃO é responder. */
		text?: string;
		/** O índice da opção, quando a página ofereceu opções. */
		chosen?: number;
		at: Instant;
	}

	/** O QUE A PÁGINA EMITIU sem fechar — um clique, um scroll, um passo concluído.
	 *  Chega pelo RPC, não por SSE.
	 *
	 *  ABERTO de propósito: `name` é escolhido pela página, que é código de outro
	 *  pacote, e enum fechado descartaria em silêncio o evento que ainda não existe. */
	export interface Event {
		surface: SurfaceId;
		name: string;
		data?: unknown;
		at: Instant;
	}

	/** O que o updater sabe. `hash` e não só `version`: o delta é entre HASHES, e
	 *  duas builds da mesma versão existem. */
	export interface Update {
		current: { version: string; hash: string; channel: Channel };
		available?: { version: string; hash: string; bytes: number };
	}
}

/** A BASE. Quem abre nomeia o que quer VER, nunca como desenhar.
 *
 *  Tudo `Promise`, e isso não é estilo: cada verbo atravessa FFI e um webview que
 *  ainda não existe no instante da chamada. Um contrato síncrono aqui seria uma
 *  mentira que só aparece no primeiro `await` esquecido. */
export interface Canvas {
	/** O runtime responde? A única checagem honesta pra algo com release próprio. */
	check(): Promise<Finding[]>;

	/** O runtime está instalado? Separado de `open` de propósito: baixar na primeira
	 *  chamada é uma espera que o chamador merece prever. */
	ready(): Promise<boolean>;

	/** As telas físicas. Sem isto, `place` e `monitor` são chute — e o Electrobun não
	 *  escolhe monitor por opção, então a conta é daqui. */
	monitors(): Promise<CanvasSystem.Monitor[]>;

	/** Abre e VOLTA. A superfície sobrevive à chamada — é o que o `my-graph` quer,
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

	/** Redesenha o que já está aberto, pelo RPC — sem recarregar e sem piscar. É o
	 *  verbo que faz uma superfície virar PROGRESSO em vez de N janelas. */
	render(
		id: CanvasSystem.SurfaceId,
		content: CanvasSystem.Content,
	): Promise<{ ok: true; id: CanvasSystem.SurfaceId } | CanvasSystem.Fail>;

	/** O que a página emitiu, conforme emite. Termina quando a superfície fecha. */
	listen(id: CanvasSystem.SurfaceId): AsyncIterable<CanvasSystem.Event>;

	/** PNG do que está na tela. É como um agente VÊ a própria superfície — sem isto,
	 *  ele afirma que desenhou e ninguém, nem ele, conferiu.
	 *
	 *  NÃO VERIFICADO NA API (20/08). Confira antes de implementar; se não existir,
	 *  este membro sai ou ganha o custo do FFI escrito ao lado. */
	shot(
		id: CanvasSystem.SurfaceId,
		out: string,
	): Promise<{ ok: true; path: string } | CanvasSystem.Fail>;

	/** As superfícies desta casa abertas agora. Sem isto, uma janela que perdeu o dono
	 *  fica na tela e ninguém sabe quem a abriu. */
	list(): Promise<CanvasSystem.Opened[]>;

	focus(id: CanvasSystem.SurfaceId): Promise<{ ok: true; id: CanvasSystem.SurfaceId } | CanvasSystem.Fail>;

	close(id: CanvasSystem.SurfaceId): Promise<{ ok: true; id: CanvasSystem.SurfaceId } | CanvasSystem.Fail>;

	/** Tem versão nova no canal deste bundle? Ler é separado de aplicar porque
	 *  reiniciar é decisão de quem está usando, nunca do updater. */
	update(): Promise<CanvasSystem.Update | CanvasSystem.Fail>;
}
