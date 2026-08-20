//! `my-browser` — DRAFT. A base de DESKTOP da família. Tipos só, nada atrás disto.
//!
//! ── SOZINHO ELE NÃO TEM VALOR, e é por isso que é `packages/` ──────────────────
//!
//! Um `apps/*` é uma coisa que alguém abre. Este não é: ninguém quer "abrir o
//! browser". O que se quer é o `my-graph` VIRANDO aplicativo, o `my-kanban` com
//! ícone no Dock, uma pergunta do `my` na frente do que a pessoa está fazendo. O
//! browser é o chão dos três — some ele e cada um reescreve janela do seu jeito, que
//! é exatamente o estado de onde esta casa está saindo.
//!
//! QUATRO JANELAS EXISTIAM, e TER QUATRO era o problema, nunca qual delas: `askuser`
//! (Neutralino), `popuper` (Electron), `agent-deck` (Tauri) e um namespace `Window`
//! desenhado em `packages/interfaces/tools.ts` que nunca virou código. Este arquivo só se
//! paga se os quatro morrerem — enquanto não morrerem, ele é o quinto.
//!
//! O CORTE VEM DO `askuser`, e estava escrito lá antes de existir este pacote: *"a janela
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
//! ── CDP EXISTE AQUI, E É UMA CAPACIDADE, NUNCA UM DADO ───────────────────────
//!
//! A pergunta que abriu isto foi *"não é CDP, e eu não sei se tem protocolo pra
//! listener"*. Tem, e a resposta é mais estreita do que "tem": **Electrobun escolhe o
//! MOTOR por webview** — `renderer: "native"` (WKWebView no macOS, WebView2 no
//! Windows, WebKitGTK no Linux) ou `renderer: "cef"` (Chromium embarcado). Verificado
//! no fonte em 20/08, não presumido:
//!
//!   COM `cef`  a inicialização varre **9222–9232** por uma porta livre e a passa em
//!              `CefSettings.remote_debugging_port` (caindo em 9222 se nenhuma). É
//!              CDP de verdade: `Page`, `Network`, `Fetch`, `Runtime`, `DOM` — o
//!              mesmo protocolo que o pydoll fala, e por isso um driver pronto
//!              ATACA esta janela sem nós escrevermos driver nenhum.
//!   COM `native` NÃO HÁ CDP. O WKWebView fala o Web Inspector da Apple, que não é
//!              TCP e não é este protocolo. Toda automação abaixo RECUSA com
//!              `reason: "unsupported"`, e recusar é o contrato — um verbo que
//!              devolve vazio num motor sem CDP é indistinguível de uma página vazia.
//!
//! A PORTA NÃO CHEGA AO PROCESSO BUN. Ela mora numa global do lado nativo
//! (`g_remoteDebugPort`), usada só pra abrir o DevTools; nada a exporta. Então quem
//! implementar `drive()` DESCOBRE: varre 9222–9232 por `/json/version`, e casa o
//! alvo pela `url` da superfície em `/json/list`. Está escrito aqui porque é o
//! primeiro lugar onde uma implementação vai supor que existe um getter e não existe.
//!
//! ── TRÊS CAMADAS DE LISTENER, E ELAS NÃO SE SUBSTITUEM ───────────────────────
//!
//!   RPC / `host-message`   a página COOPERA. É o caminho das nossas telas, é tipado,
//!                          e é o único que funciona em `native`. É o `Event` daqui.
//!   eventos do webview     `dom-ready`, `did-navigate`, `did-navigate-in-page`,
//!                          `did-commit-navigation`. Sem cooperação, mas GROSSOS:
//!                          dizem que navegou, nunca o que a página fez.
//!   CDP                    tudo o mais — requisição, resposta, corpo, console,
//!                          exceção, mutação de DOM, diálogo nativo. Só em `cef`.
//!
//! Automação usa a terceira. `listen()` continua sendo a primeira, e as duas convivem
//! porque respondem perguntas diferentes: uma é o que NOSSA página emitiu, a outra é
//! o que QUALQUER página fez.
//!
//! ── POR QUE UM `Driver` FINO E NÃO UM PYDOLL EM TYPESCRIPT ───────────────────
//!
//! O que este pacote deve é o ENDEREÇO — `Opened.cdp`, a porta e o alvo. Com ele,
//! pydoll, Playwright e a `qa-drive` desta casa atacam a janela hoje, sem uma linha
//! nossa. Reescrever localizador, humanização de mouse e HAR aqui seria reconstruir
//! um projeto inteiro pra ter a mesma coisa pior.
//!
//! O `Driver` abaixo é o que sobra depois disso: os verbos que um agente usa numa
//! frase — achar, clicar, digitar, ler, esperar, interceptar, tirar foto — sem subir
//! um segundo runtime pra pedir um `innerText`. Passou disso, `cdp` está ali.
//!
//! DUAS ARMADILHAS MEDIDAS QUE ESTE DESENHO EVITA:
//!
//!   `executeJavascript` do Electrobun é FIRE-AND-FORGET: não devolve valor. Então
//!   `eval()` aqui é `Runtime.evaluate` do CDP, e em `native` a volta só existe se a
//!   página chamar `window.__electrobunSendToHost` — cooperação, de novo.
//!
//!   DIÁLOGO NATIVO CONGELA A SESSÃO INTEIRA (medido na `qa-drive`, contra CDP): um
//!   `confirm()` aberto trava TODO comando na aba até alguém responder. Por isso
//!   `dialog()` é ARMADO ANTES do ato que abre o diálogo, e não depois.
//!
//! ── COMO ELE SE ATUALIZA ─────────────────────────────────────────────────────
//!
//! Uma base de desktop tem que responder isso, senão cada app inventa o seu. O
//! updater do Electrobun manda DELTA binário (`bsdiff`/`bspatch`) entre hashes de
//! versão — atualização de ~4 KB — e escolhe o manifesto pelo `channel` do
//! `version.json`. `Channel` está no vocabulário abaixo por causa disso: `canary` é
//! o que deixa esta casa comer a própria comida sem arrastar quem só usa.
//!
//! ── O NOME MUDOU: ERA `my-canvas` (20/08) ────────────────────────────────────
//!
//! `canvas` dizia SUPERFÍCIE DE DESENHO, e é o que ele NÃO é: nada aqui desenha um
//! pixel — quem desenha é a página, e o `Content` que ela recebe é HTML ou uma URL.
//! O que este pacote faz é ABRIR e CONTROLAR uma janela com um webview dentro, que é
//! literalmente um browser sem cromo.
//!
//! O nome errado tinha custo: ele convidava um `draw()`, um `clear()`, um contexto 2D
//! — a API que um canvas tem e esta não pode ter, porque o motor é o WKWebView.
//!
//! ── A FORMA DESTE ARQUIVO ────────────────────────────────────────────────────
//!
//! UM ARQUIVO, e não uma pasta `interfaces/`. A pasta é o que se faz quando UM
//! arquivo não cabe mais, e "não cabe mais" é medição, não previsão — enquanto
//! couber, uma superfície de leitura só. Quando passar, isso é uma pergunta pro
//! dono, não uma decisão de quem está escrevendo.
//!
//! external:    Electrobun · WKWebView (macOS) · WebView2 (Windows) · CEF (CDP) ·
//!              Chrome DevTools Protocol · pydoll/Playwright como drivers de fora
//! implemented: nada
//! planned:     packages/my-browser/
//! usado_por:   apps/my-graph · apps/my-kanban · apps/my · skills/qa-drive
//! substitui:   o namespace `Window` de src/interfaces/tools.ts (Neutralino), que
//!              SAI no mesmo commit em que este nascer — não depois

/** O que este sistema achou podre. Declarado aqui em vez de importado: o runner lê
 *  a FORMA, então ter um check não custa dependência de hub. */
export interface Finding {
	path: string;
	says: string;
}

export declare namespace BrowserSystem {
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

	/** O MOTOR. `native` é o padrão do Electrobun e o barato: zero MB extras, é o
	 *  WebKit/Edge que a máquina já tem. `cef` embarca Chromium — pesa, e compra a
	 *  ÚNICA coisa que o outro não dá: CDP. Escolher `cef` "por garantia" é pagar
	 *  centenas de MB por uma janela que só mostra um grafo. */
	export type Renderer = "native" | "cef";

	/** COMO A JANELA SE COMPORTA, e não que tamanho ela tem. `panel` é a de DECISÃO —
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
		/** Padrão `native`. `cef` é o que liga `drive()` — ver o cabeçalho. */
		renderer?: Renderer;
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

	/** ONDE UM DRIVER DE FORA SE PLUGA. `port` é o que a varredura 9222–9232 achou;
	 *  `target` é o alvo desta superfície dentro dela, porque uma porta atende TODAS as
	 *  webviews CEF do processo — atacar a porta sem o alvo é dirigir a janela do
	 *  vizinho, e o erro é silencioso. `webSocketDebuggerUrl` vem do `/json/list` e é o
	 *  que pydoll e Playwright aceitam direto. */
	export interface Cdp {
		port: number;
		target: string;
		webSocketDebuggerUrl: string;
	}

	export interface Opened {
		ok: true;
		id: SurfaceId;
		title?: string;
		mode: Mode;
		/** O motor que de fato subiu — não o que foi pedido. Um pedido de `cef` sem o
		 *  bundle CEF presente cai pra `native`, e quem não conferir vai chamar
		 *  `drive()` achando que tem CDP. */
		renderer: Renderer;
		/** Presente SÓ em `cef`. A ausência é a resposta pra "dá pra automatizar?". */
		cdp?: Cdp;
		at: Instant;
	}

	/** POR QUE NÃO ABRIU, e as cinco se respondem diferente: sem runtime se resolve
	 *  instalando, `spawn` é máquina cheia, `unreachable` é o servidor da URL que não
	 *  subiu, `not_found` é id que não existe mais, e `no_display` é sessão sem tela —
	 *  o caso do agente em SSH, onde abrir janela nunca vai funcionar e insistir é
	 *  laço infinito.
	 *
	 *  `unsupported` é a SEXTA e chegou com a automação: o verbo existe, a superfície
	 *  existe, e o MOTOR dela não fala CDP. Não é erro de quem chamou nem falha de
	 *  execução — é uma capacidade ausente, e devolver vazio no lugar dela faria
	 *  "página sem esse elemento" e "janela sem protocolo" se parecerem iguais.
	 *
	 *  `detached` é o alvo que sumiu por baixo: a superfície navegou, o webview
	 *  recarregou, e o handle aponta pro que não está mais lá. */
	export type Fail = {
		ok: false;
		error: string;
		reason:
			| "not_installed"
			| "spawn"
			| "unreachable"
			| "no_display"
			| "not_found"
			| "unsupported"
			| "detached";
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

	// ── AUTOMAÇÃO ───────────────────────────────────────────────────────────────

	/** COMO SE ACHA UM NÓ. Três formas porque três coisas diferentes: `css` é o que se
	 *  escreve, `xpath` é o que resolve texto e eixo que CSS não alcança, e `role` é a
	 *  árvore de acessibilidade — que é a única que sobrevive a um refactor de classe.
	 *  Preferir `role` quando existir nome acessível é o que separa um teste que
	 *  documenta intenção de um que documenta markup. */
	export type Selector =
		| { css: string }
		| { xpath: string }
		| { role: string; name?: string };

	/** UM NÓ ACHADO, E ELE É LOCALIZADOR, NUNCA PONTEIRO. O `objectId` do CDP vale só
	 *  pra conexão que o criou e morre a cada navegação; guardar um handle assim é
	 *  como uma suíte começa a agir no nó errado sem reclamar (medido na `qa-drive`).
	 *  Então o nó carrega COMO se reachar, e quem reachar diferente do que achou marca
	 *  `stale` em vez de agir calado. */
	export interface Node {
		ref: string;
		selector: Selector;
		/** Assinatura de quando foi achado — tag, papel, nome. É o que faz `stale` ser
		 *  detectável em vez de teórico. */
		fingerprint: string;
		stale?: boolean;
	}

	/** O QUE ESPERAR, e o padrão errado é `visible` pra tudo: um nó que existe e está
	 *  desabilitado passa em `visible` e engole o clique. */
	export type Until = "present" | "visible" | "hidden" | "gone" | "enabled";

	/** UMA REGRA DE REDE. `when` casa a URL (glob, como o `setNavigationRules` do
	 *  Electrobun já usa); `then` decide o destino dela.
	 *
	 *  `observe` é o modo que a maioria quer e quase ninguém pede: não muda nada, só
	 *  faz a requisição APARECER em `wire()`. Interceptar pra não modificar é o jeito
	 *  caro de olhar. */
	export interface NetRule {
		when: string;
		then:
			| { observe: true }
			| { block: true }
			| { fulfill: { status?: number; headers?: Record<string, string>; body: string } }
			| { modify: { headers?: Record<string, string>; body?: string } };
	}

	/** UMA TROCA NA REDE. `body` só vem quando foi PEDIDO — o CDP manda contagem de
	 *  bytes nos eventos e o corpo exige um comando à parte, feito enquanto a página
	 *  ainda o segura. Pedir corpo de tudo é gravar a internet inteira em RAM. */
	export interface Wire {
		surface: SurfaceId;
		method: string;
		url: string;
		status?: number;
		headers?: Record<string, string>;
		bytes?: number;
		body?: string;
		at: Instant;
	}

	/** O QUE A PÁGINA FALOU SOZINHA — `console.*` e exceção não capturada. É o que um
	 *  agente precisa pra dizer "quebrou" em vez de "a tela ficou branca". */
	export interface Log {
		surface: SurfaceId;
		level: "log" | "info" | "warn" | "error" | "debug" | (string & {});
		text: string;
		stack?: string;
		at: Instant;
	}

	/** UM DIÁLOGO NATIVO. Armado ANTES do ato que o abre — ver o cabeçalho: um diálogo
	 *  aberto congela toda a sessão CDP daquela aba, não só o comando que o disparou. */
	export interface Dialog {
		kind: "alert" | "confirm" | "prompt" | "beforeunload" | (string & {});
		message: string;
		accept: boolean;
		text?: string;
	}
}

/** A BASE. Quem abre nomeia o que quer VER, nunca como desenhar.
 *
 *  Tudo `Promise`, e isso não é estilo: cada verbo atravessa FFI e um webview que
 *  ainda não existe no instante da chamada. Um contrato síncrono aqui seria uma
 *  mentira que só aparece no primeiro `await` esquecido. */
export interface Browser {
	/** O runtime responde? A única checagem honesta pra algo com release próprio. */
	check(): Promise<Finding[]>;

	/** O runtime está instalado? Separado de `open` de propósito: baixar na primeira
	 *  chamada é uma espera que o chamador merece prever. */
	ready(): Promise<boolean>;

	/** As telas físicas. Sem isto, `place` e `monitor` são chute — e o Electrobun não
	 *  escolhe monitor por opção, então a conta é daqui. */
	monitors(): Promise<BrowserSystem.Monitor[]>;

	/** Abre e VOLTA. A superfície sobrevive à chamada — é o que o `my-graph` quer,
	 *  porque ninguém fica olhando um grafo com o terminal preso. */
	open(
		content: BrowserSystem.Content,
		opts?: BrowserSystem.Options,
	): Promise<BrowserSystem.Opened | BrowserSystem.Fail>;

	/** Abre e ESPERA. Bloquear é a feature: pergunta que não segura o chamador é
	 *  pergunta que um agente desatento responde sozinho. A diferença entre este
	 *  verbo e `open` não é técnica, é quem manda no tempo. */
	ask(
		content: BrowserSystem.Content,
		opts?: BrowserSystem.Options,
	): Promise<BrowserSystem.Answer | BrowserSystem.Fail>;

	/** Redesenha o que já está aberto, pelo RPC — sem recarregar e sem piscar. É o
	 *  verbo que faz uma superfície virar PROGRESSO em vez de N janelas. */
	render(
		id: BrowserSystem.SurfaceId,
		content: BrowserSystem.Content,
	): Promise<{ ok: true; id: BrowserSystem.SurfaceId } | BrowserSystem.Fail>;

	/** O que a página emitiu, conforme emite. Termina quando a superfície fecha. */
	listen(id: BrowserSystem.SurfaceId): AsyncIterable<BrowserSystem.Event>;

	/** O CONTROLE DA SUPERFÍCIE, quando ela tem CDP. `Fail{unsupported}` num motor
	 *  `native`, e isso é a resposta inteira: não existe caminho degradado: sem
	 *  Chromium não há protocolo, e emular um por injeção de script seria uma
	 *  automação que só funciona em página que colabora — que é o `listen()` que já
	 *  existe, com outro nome. */
	drive(id: BrowserSystem.SurfaceId): Promise<Driver | BrowserSystem.Fail>;

	/** PNG do que está na tela. É como um agente VÊ a própria superfície — sem isto,
	 *  ele afirma que desenhou e ninguém, nem ele, conferiu.
	 *
	 *  RESOLVIDO EM 20/08, e era o único membro não verificado deste arquivo: é
	 *  `Page.captureScreenshot` do CDP, então **existe em `cef` e não existe em
	 *  `native`** — Electrobun não expõe captura própria. Em `native` isto devolve
	 *  `Fail{unsupported}`; quem precisar de foto de uma janela nativa paga FFI, e
	 *  paga de propósito. */
	shot(
		id: BrowserSystem.SurfaceId,
		out: string,
	): Promise<{ ok: true; path: string } | BrowserSystem.Fail>;

	/** As superfícies desta casa abertas agora. Sem isto, uma janela que perdeu o dono
	 *  fica na tela e ninguém sabe quem a abriu. */
	list(): Promise<BrowserSystem.Opened[]>;

	focus(id: BrowserSystem.SurfaceId): Promise<{ ok: true; id: BrowserSystem.SurfaceId } | BrowserSystem.Fail>;

	close(id: BrowserSystem.SurfaceId): Promise<{ ok: true; id: BrowserSystem.SurfaceId } | BrowserSystem.Fail>;

	/** Tem versão nova no canal deste bundle? Ler é separado de aplicar porque
	 *  reiniciar é decisão de quem está usando, nunca do updater. */
	update(): Promise<BrowserSystem.Update | BrowserSystem.Fail>;
}

/** O QUE UM AGENTE FAZ COM UMA SUPERFÍCIE que fala CDP: QA, automação, raspagem.
 *
 *  É DE PROPÓSITO MENOR QUE O PYDOLL. O que este pacote deve é o `cdp` do `Opened` —
 *  com ele, pydoll, Playwright e a `qa-drive` desta casa dirigem a janela hoje, com
 *  localizador, humanização de mouse e HAR que já existem e que reescrever aqui seria
 *  reconstruir um projeto inteiro pra ter pior. O que fica é o que se usa numa frase,
 *  sem subir um segundo runtime pra pedir um `innerText`.
 *
 *  Ver `escape()` no fim: quando a frase não bastar, o protocolo cru está ali, e é
 *  isso que impede este contrato de crescer verbo a verbo até virar o que ele recusou
 *  ser. */
export interface Driver {
	readonly surface: BrowserSystem.SurfaceId;
	/** O endereço, pra entregar a um driver de fora. */
	readonly cdp: BrowserSystem.Cdp;

	goto(url: BrowserSystem.Url): Promise<{ ok: true; url: string } | BrowserSystem.Fail>;
	reload(): Promise<{ ok: true } | BrowserSystem.Fail>;
	url(): Promise<string>;

	/** Acha UM. `Fail{not_found}` quando não acha — nunca `null`: `null` obriga todo
	 *  chamador a inventar a mesma checagem, e metade esquece. */
	find(sel: BrowserSystem.Selector): Promise<BrowserSystem.Node | BrowserSystem.Fail>;
	all(sel: BrowserSystem.Selector): Promise<BrowserSystem.Node[]>;

	/** Espera até a condição valer, ou desiste. SEM ISTO todo assert é uma corrida:
	 *  numa página com `fetch`, timer ou `IntersectionObserver`, uma leitura de um
	 *  tiro só consegue ver o valor de ANTES do render — medido, e é a causa nº 1 de
	 *  teste que passa na máquina de quem escreveu. */
	wait(
		sel: BrowserSystem.Selector,
		until: BrowserSystem.Until,
		timeout?: BrowserSystem.Millis,
	): Promise<BrowserSystem.Node | BrowserSystem.Fail>;

	click(node: BrowserSystem.Node): Promise<{ ok: true } | BrowserSystem.Fail>;
	/** Tecla de verdade, pelo `Input` do CDP, não `el.value = …`: um framework que
	 *  ouve `keydown` não vê atribuição, e o campo fica preenchido na tela e vazio no
	 *  estado. `clear` decide se substitui ou concatena. */
	type(node: BrowserSystem.Node, text: string, opts?: { clear?: boolean; delay?: BrowserSystem.Millis }): Promise<{ ok: true } | BrowserSystem.Fail>;
	press(key: string): Promise<{ ok: true } | BrowserSystem.Fail>;
	scroll(to: BrowserSystem.Node | { x: number; y: number }): Promise<{ ok: true } | BrowserSystem.Fail>;
	upload(node: BrowserSystem.Node, paths: string[]): Promise<{ ok: true } | BrowserSystem.Fail>;

	text(node: BrowserSystem.Node): Promise<string | BrowserSystem.Fail>;
	attrs(node: BrowserSystem.Node): Promise<Record<string, string> | BrowserSystem.Fail>;
	/** COM valor de volta, e é a diferença pro `executeJavascript` do Electrobun, que é
	 *  fire-and-forget. Isto é `Runtime.evaluate`. */
	eval<T = unknown>(js: string): Promise<T | BrowserSystem.Fail>;

	/** A ÁRVORE DE ACESSIBILIDADE, podada. Poda não é enfeite: a árvore crua de uma
	 *  página real passa das centenas de nós — cada `StaticText`, cada wrapper de
	 *  layout — e fica MAIOR que a captura de tela que ela existe pra substituir. Cada
	 *  nó volta já como `Node`, então dá pra agir sem um `find` no meio. */
	snapshot(): Promise<BrowserSystem.Node[] | BrowserSystem.Fail>;

	/** As regras valem daqui pra frente; requisição já em voo não volta atrás. */
	intercept(rules: BrowserSystem.NetRule[]): Promise<{ ok: true } | BrowserSystem.Fail>;
	/** A rede, conforme acontece. `bodies` custa: sem ele vêm bytes, com ele vem o
	 *  corpo, buscado enquanto a página ainda o segura. */
	wire(opts?: { bodies?: boolean }): AsyncIterable<BrowserSystem.Wire>;
	logs(): AsyncIterable<BrowserSystem.Log>;

	/** ARMA a resposta do PRÓXIMO diálogo. Chamar DEPOIS de abrir é tarde: a sessão já
	 *  está congelada e esta chamada não chega. */
	dialog(answer: BrowserSystem.Dialog): Promise<{ ok: true } | BrowserSystem.Fail>;

	cookies(): Promise<Array<{ name: string; value: string; domain: string; path: string; expires?: number }>>;
	setCookies(cookies: Array<{ name: string; value: string; domain: string; path?: string }>): Promise<{ ok: true } | BrowserSystem.Fail>;

	pdf(out: string): Promise<{ ok: true; path: string } | BrowserSystem.Fail>;

	/** O PROTOCOLO CRU. Um método CDP e seus parâmetros, sem tradução.
	 *
	 *  Está aqui pra este contrato PODER ficar pequeno: sem escotilha, todo domínio
	 *  que faltar vira pedido de verbo novo, e em seis meses isto é um pydoll pior. O
	 *  preço está escrito: quem chama `escape()` amarra no protocolo, não em nós, e
	 *  uma versão de Chromium que mova o método quebra o chamador — não este arquivo. */
	escape<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
}
