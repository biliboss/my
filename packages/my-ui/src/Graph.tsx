import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

//! O CANVAS DA CASA — um só, com entrada separada (`@my/my-ui/graph`)
//! porque cytoscape é peer OPCIONAL e três produtos não devem pagar por ele.
//!
//! ELE EXISTE PORQUE HAVIA QUATRO. Medido em 21/08: `my-ui/Graph.tsx` (195),
//! `apps/my-graph/ui/GraphCanvas.tsx` (418), `~/src/my-graph/ui/GraphCanvas.tsx`
//! (405) e `agent_conversation/app/graph/GraphCanvas.tsx` (218) — 1.236 linhas.
//! Normalizadas (sem comentário, sem linha vazia) as duas maiores compartilham
//! DEZESSETE linhas idênticas, e as dezessete são `}`, `};`, `selector: "node",`
//! e `useEffect(() => {`. Não eram quatro cópias de um canvas: eram quatro
//! canvas que redescobriram, cada um por conta, o MESMO ciclo de vida — e cada
//! um errou uma parte dele.
//!
//! A FALHA QUE ISTO EVITA é a que as quatro pagaram em separado: destruir o core
//! com o layout ainda tickando. `destroy()` sozinho deixa a simulação segurando
//! um core cujo renderer já é null, e o próximo tick estoura de dentro da
//! biblioteca (`Cannot read properties of null (reading 'isHeadless')`, medido
//! 20/08). A ordem é `layout.stop()` → `cy.stop()` → `cy.destroy()`, e ela mora
//! aqui uma vez.
//!
//! O QUE É DAQUI: ciclo de vida, rodar e parar layout, o roteamento de aresta, a
//! revelação por nível, o foco de seleção, o patch ao vivo, o refit no resize e
//! a costura de teste. O QUE NÃO É: o que cada nó SIGNIFICA. Estilo por domínio
//! entra como `stylesheet`, dado entra como `elements`, e o que precisa do core
//! pega ele por `register`. Layout é do pai; geometria intrínseca é do filho.

// ─── A PALETA ────────────────────────────────────────────────────────────────

/** A COR VEM DE `tokens.css` E DE MAIS LUGAR NENHUM. Um `fallback` em hex aqui
 *  seria a TERCEIRA tabela dos mesmos valores na família (as outras: o
 *  `Themes.tsx` do my-graph e o `lib/theme.ts` do agent_conversation), e um
 *  fallback é exatamente onde paleta morta se esconde — o H4 achou o verde do
 *  Aura, tema deletado em 20/08, vivo dentro de um `var(--cyan, #61ffca)`.
 *
 *  ENTÃO ELE FALHA ALTO. Duas falhas, e as duas são silenciosas sem esta guarda:
 *
 *  1. TOKEN AUSENTE — quem esqueceu `import "@my/my-ui/tokens.css"` recebe
 *     `""`, o cytoscape lê string vazia como preto, e o grafo nasce preto no
 *     preto sem um erro no console.
 *  2. TOKEN CALCULADO — `getComputedStyle().getPropertyValue()` devolve uma
 *     custom property como foi ESCRITA, não resolvida. Se `--muted` voltar a ser
 *     `color-mix(in srgb, …)`, o cytoscape recebe essa string, não entende, e
 *     pinta preto — de novo sem erro. O canvas é um `<canvas>`: ele não herda
 *     variável de CSS nem resolve função de cor.
 *
 *  Roda dentro do efeito de montagem, nunca no load do módulo: no topo do
 *  arquivo isto executaria antes do CSS entrar e reprovaria todo mundo. */
function readCss(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw)
    throw new Error(
      `@my/my-ui/graph: o token \`${name}\` está vazio. Importe "@my/my-ui/tokens.css" no ponto de entrada da aplicação.`,
    );
  if (/^(var|color-mix|light-dark)\(/.test(raw))
    throw new Error(
      `@my/my-ui/graph: o token \`${name}\` vale \`${raw}\`, e o cytoscape pinta em canvas — ele não resolve função de cor. Declare o valor final em tokens.css.`,
    );
  return raw;
}

// ─── O GRAFO POR NÍVEL (a dobra da landing) ──────────────────────────────────

export type GraphNode = {
  id: string;
  label: string;
  /** 0 é a raiz. Tamanho e cor saem daqui. */
  level: number;
  parent?: string;
  /** Nó tracejado: o que o usuário acrescenta, e não vem pronto. */
  custom?: boolean;
};

/** Lida no momento da chamada, nunca no load do módulo: `getComputedStyle` no
 *  topo do arquivo roda antes do `tokens.css` entrar, e devolve vazio. */
export function graphStyle(): cytoscape.StylesheetJson {
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "text-valign": "bottom",
        "text-margin-y": 10,
        color: readCss("--text"),
        "font-size": 15,
        "font-weight": 700,
        "font-family": readCss("--font-sans"),
        "text-wrap": "wrap",
        "text-max-width": "140px",
      },
    },
    {
      // As duas primeiras camadas escrevem DENTRO da bolinha: rótulo pendurado
      // embaixo cruza as arestas, e o texto escuro do nó claro some no fundo.
      selector: "node[level = 0]",
      style: {
        width: 148,
        height: 148,
        "background-color": readCss("--primary"),
        color: readCss("--bg-deep"),
        "font-size": 17,
        "text-valign": "center",
        "text-margin-y": 0,
        "text-max-width": "112px",
        "border-width": 2,
        "border-color": readCss("--primary-2"),
      },
    },
    {
      selector: "node[level = 1]",
      style: {
        width: 118,
        height: 118,
        "background-color": readCss("--cyan"),
        color: readCss("--bg-deep"),
        "font-size": 12,
        "text-valign": "center",
        "text-margin-y": 0,
        "text-max-width": "88px",
      },
    },
    {
      selector: "node[level >= 2]",
      style: {
        width: 58,
        height: 58,
        "background-color": readCss("--surface-2"),
        "border-width": 1.5,
        "border-color": readCss("--line-strong"),
        color: readCss("--muted"),
        "font-size": 12,
      },
    },
    {
      // `[custom]` sozinho casa TODO nó — `false` É um campo definido no
      // cytoscape. A comparação é o ponto.
      selector: "node[custom = 1]",
      style: {
        "background-color": readCss("--bg-deep"),
        "border-width": 2,
        "border-style": "dashed",
        "border-color": readCss("--cyan"),
        color: readCss("--cyan"),
      },
    },
    {
      selector: "edge",
      style: {
        width: 1.5,
        "line-color": readCss("--line-strong"),
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
        "target-arrow-color": readCss("--line-strong"),
        "arrow-scale": 0.9,
      },
    },
    { selector: ".dim", style: { opacity: 0.12 } },
  ];
}

// ─── A COSTURA DE TESTE ──────────────────────────────────────────────────────

type Seam = { __cy?: cytoscape.Core; __graphs?: cytoscape.Core[] };

/** UM SLOT GLOBAL NÃO SERVE A DOIS CANVAS. `window.__cy = instance` no efeito de
 *  montagem era o bloqueio nomeado na nota: com duas telas de grafo na mesma
 *  página o segundo apaga o primeiro, e ao desmontar o slot fica apontando pra
 *  um core destruído — um driver que leia dele chama método em cima de renderer
 *  null. Aqui é uma LISTA, e a saída remove o próprio elemento e devolve `__cy`
 *  a quem sobrou. Medido em 21/08: `__cy` tem ZERO leitores em disco nas três
 *  árvores (`~/src/my`, `~/src/my-graph`, `_today`), então o nome fica só por
 *  compatibilidade com um driver que ainda não foi escrito. */
function joinSeam(cy: cytoscape.Core): () => void {
  if (typeof window === "undefined") return () => {};
  const seam = window as unknown as Seam;
  const all = (seam.__graphs ??= []);
  all.push(cy);
  seam.__cy = cy;
  return () => {
    const at = all.indexOf(cy);
    if (at > -1) all.splice(at, 1);
    seam.__cy = all[all.length - 1];
  };
}

// ─── ROTEAMENTO DE ARESTA ────────────────────────────────────────────────────

type XY = { x: number; y: number };

/** ARESTA QUE NUNCA PASSA POR BAIXO DE UM NÓ.
 *
 *  Um layout de força (cose, fcose, d3-force) REDUZ sobreposição empurrando até
 *  a energia cair; o cola resolve separação como RESTRIÇÃO (VPSC), então
 *  `avoidOverlap` é uma promessa sobre caixas. Nenhum dos dois diz nada sobre a
 *  TINTA: uma linha que some atrás de um círculo é a dependência que a figura
 *  existe pra mostrar.
 *
 *  O ALGORITMO, depois que o layout assenta:
 *    1. para cada aresta, tome o segmento reto entre as pontas;
 *    2. ache todo outro nó cujo centro caia dentro de `r + folga` do segmento,
 *       medido perpendicular e só onde a projeção cai SOBRE o segmento — nó
 *       além de uma das pontas não está no caminho;
 *    3. dobre a curva passando o pior deles: o ponto de controle vai pro lado
 *       daquele nó, longe o bastante pra limpá-lo, na posição da projeção;
 *    4. repita, porque uma dobra pode empurrar a curva pra dentro de outro.
 *
 *  É POR ARESTA, NÃO POR GRAFO: sai barato e nunca move um nó — o layout mantém
 *  a compacidade que achou, e só a tinta anda. */
export function routeEdges(
  cy: cytoscape.Core,
  { obstacles = "node:visible", clear = 14, bend = 26 }: { obstacles?: string; clear?: number; bend?: number } = {},
) {
  // O CORE PODE JÁ TER MORRIDO. O roteamento é agendado no `layoutstop` e o cola
  // segue tickando por segundos — um hot reload no meio destrói o core com um
  // tick na fila, e toda leitura abaixo bate em renderer null (medido 20/08).
  if (cy.destroyed()) return;
  const nodes = cy.nodes(obstacles).map((n) => ({ id: n.id(), p: n.position(), r: n.width() / 2 }));
  const SAMPLES = 24;

  /** Uma Bézier quadrática alcança só METADE da distância do ponto de controle
   *  no ápice — a primeira versão dobrava pela profundidade da invasão e ainda
   *  cortava todo círculo que desviava (medido 20/08: 23 amostras dentro de um
   *  nó). */
  const pointAt = (a: XY, b: XY, d: number, w: number, t: number): XY => {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const L = Math.hypot(abx, aby) || 1;
    // `d` É O VALOR DE ESTILO que o cytoscape vai usar, sem modificação —
    // modelar como outra coisa é como as duas primeiras tentativas "limparam" o
    // nó no papel e cortaram na tela.
    const cx = a.x + abx * w - (aby / L) * d;
    const cyy = a.y + aby * w + (abx / L) * d;
    const u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * cx + t * t * b.x,
      y: u * u * a.y + 2 * u * t * cyy + t * t * b.y,
    };
  };

  cy.edges().forEach((edge) => {
    const a = edge.source().position();
    const b = edge.target().position();
    const src = edge.source().id();
    const tgt = edge.target().id();
    const others = nodes.filter((n) => n.id !== src && n.id !== tgt);

    // O TETO DO DESVIO. Sem ele, uma passada que não conseguia limpar seguia
    // somando o empurrão, e doze delas puseram pontos de controle a milhares de
    // px — a tela virou um laçarote (visto 20/08). Desvio muito maior que a
    // aresta não é rota, é rabisco, e passado disso a resposta honesta é "esta
    // cruza".
    const chord = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const CAP = Math.min(210, chord * 0.7);

    /** Pior invasão da curva em (dist, peso), e onde ao longo dela. */
    const probe = (dist: number, weight: number) => {
      let worst = 0;
      let worstT = weight;
      for (let i = 1; i < SAMPLES; i++) {
        const t = i / SAMPLES;
        const p = pointAt(a, b, dist, weight, t);
        for (const n of others) {
          const gap = Math.hypot(n.p.x - p.x, n.p.y - p.y) - n.r - clear;
          if (gap < 0 && -gap > worst) {
            worst = -gap;
            worstT = t;
          }
        }
      }
      return { worst, worstT };
    };

    // OS DOIS LADOS, SEPARADOS. Decidir o lado por onde o obstáculo está
    // funciona até dois obstáculos discordarem — aí a busca vira a cada passada
    // e não converge. Rodar cada lado até o fim e ficar com o melhor são duas
    // buscas baratas em vez de uma que oscila.
    let best = { dist: bend, weight: 0.5, worst: Infinity };
    for (const side of [1, -1] as const) {
      let dist = side * bend;
      let weight = 0.5;
      for (let pass = 0; pass < 10; pass++) {
        const { worst, worstT } = probe(dist, weight);
        // Empate vai pra dobra menor: tinta mais reta pela mesma folga.
        if (worst < best.worst || (worst === best.worst && Math.abs(dist) < Math.abs(best.dist)))
          best = { dist, weight, worst };
        if (!worst) break;
        // O ápice alcança metade da distância de controle, então limpar `worst`
        // custa o dobro disso.
        const next = dist + side * 2 * (worst + clear);
        if (Math.abs(next) > CAP) break;
        dist = next;
        weight = worstT;
      }
      if (best.worst === 0) break;
    }

    edge.style({
      "curve-style": "unbundled-bezier",
      "control-point-distances": [best.dist],
      "control-point-weights": [best.weight],
    });
  });
}

// ─── PATCH AO VIVO ───────────────────────────────────────────────────────────

/** Aplica um grafo novo SEM reconstruir. `cy.json({ elements })` derruba a
 *  seleção e reseta a câmera, o que significa que uma atualização ao vivo
 *  arranca a página de baixo de quem está lendo. Então: o que é novo entra, o
 *  que andou é reposicionado, e o resto fica onde está. */
export function patchElements(cy: cytoscape.Core | null | undefined, elements: cytoscape.ElementDefinition[]) {
  if (!cy || cy.destroyed()) return;
  cy.batch(() => {
    for (const el of elements) {
      const id = String(el.data?.id ?? "");
      if (!id) continue;
      const at = cy.getElementById(id);
      if (at.empty()) {
        cy.add(el);
        continue;
      }
      at.data({ ...el.data });
      const p = el.position;
      if (p && at.isNode()) {
        const now = at.position();
        if (now.x !== p.x || now.y !== p.y) at.position({ x: p.x, y: p.y });
      }
    }
  });
}

// ─── O PULSO ─────────────────────────────────────────────────────────────────

/** UM PULSO NO QUE VOCÊ ESCOLHEU, antes da câmera andar. O zoom responde
 *  "onde"; o pulso responde "qual" — e durante um fit de 320ms o olho não segue
 *  um círculo que ainda não identificou.
 *
 *  O segundo tempo acontece 180ms depois, e nesse intervalo cabe um hot reload
 *  inteiro: sem a guarda, o `complete` anima contra um core destruído. */
function pulse(node: cytoscape.NodeSingular) {
  if (!node.length || reducedMotion() || node.cy().destroyed()) return;
  node.animate({
    style: { "border-width": 10, "border-color": readCss("--green"), "border-opacity": 0.35 },
    duration: 180,
    easing: "ease-out",
    complete: () => {
      if (node.removed() || node.cy().destroyed()) return;
      node.animate({
        style: { "border-width": 2, "border-color": readCss("--bg-deep"), "border-opacity": 1 },
        duration: 420,
        easing: "ease-in-out",
      });
    },
  });
}

function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ─── O CANVAS ────────────────────────────────────────────────────────────────

export type GraphProps = {
  /** O dado já na forma do cytoscape. O que cada nó SIGNIFICA é do chamador. */
  elements: cytoscape.ElementDefinition[];
  /** O estilo do domínio. Sem ele, o estilo por nível desta casa. */
  stylesheet?: cytoscape.StylesheetJson;
  /** Rodado por `cy.layout()`, NUNCA pelo construtor: layout criado lá dentro
   *  não devolve referência, e sem referência não há como PARAR o ticker na
   *  limpeza. `cy.stop()` para animação, não simulação. */
  layout?: cytoscape.LayoutOptions;
  /** DOBRA: revela todo elemento com `data.level <= reveal`, um degrau por vez.
   *  Definir isto troca o modo — os elementos entram progressivamente em vez de
   *  nascerem todos. */
  reveal?: number;
  /** Desvia a tinta dos círculos depois que o layout assenta. */
  route?: boolean;
  /** Zoom, pan e arrasto. A dobra da landing passa `false`: ela é rolagem. */
  interactive?: boolean;
  maxZoom?: number;
  wheelSensitivity?: number;
  fitPadding?: number;
  /** O nó em foco: o resto apaga, ele pulsa, e a câmera vai até a vizinhança. */
  selected?: string;
  onSelect?: (id: string) => void;
  /** O CORE, PRA QUEM PRECISA DELE — extensão de layout, navegação por teclado,
   *  poll ao vivo, anel de satélites. É isto que substitui um global: quem
   *  precisa do core recebe o core, em vez de pescar `window.__cy`. O retorno é
   *  o desfazer, chamado antes da destruição. */
  register?: (cy: cytoscape.Core) => void | (() => void);
  /** Reconstrói quando muda. `stylesheet` e `layout` são lidos uma vez, na
   *  construção: são objetos literais na maioria das chamadas, e depender da
   *  identidade deles reconstruiria o grafo a cada render. Densidade, tema e
   *  filtro de layout entram por aqui. */
  rebuildKey?: string | number;
  className?: string;
  id?: string;
};

export function Graph({
  elements,
  stylesheet,
  layout,
  reveal,
  route = false,
  interactive = true,
  maxZoom,
  wheelSensitivity,
  fitPadding = 70,
  selected = "",
  onSelect,
  register,
  rebuildKey,
  className = "",
  id,
}: GraphProps) {
  const box = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  /** Em ref, não em state: o handler precisa enxergar o último sem religar a
   *  cada tecla digitada na URL. */
  const latest = useRef({ elements, stylesheet, layout, reveal, route, interactive, onSelect, register, fitPadding });
  latest.current = { elements, stylesheet, layout, reveal, route, interactive, onSelect, register, fitPadding };

  useEffect(() => {
    const host = box.current;
    if (!host) return;
    const now = latest.current;
    const folding = now.reveal !== undefined;

    const cy = cytoscape({
      container: host,
      // A dobra nasce VAZIA e cresce por degrau; todo o resto nasce inteiro.
      elements: folding ? [] : now.elements,
      style: now.stylesheet ?? graphStyle(),
      layout: { name: "preset" },
      userZoomingEnabled: now.interactive,
      userPanningEnabled: now.interactive,
      boxSelectionEnabled: false,
      autoungrabify: !now.interactive,
      ...(maxZoom === undefined ? {} : { maxZoom }),
      ...(wheelSensitivity === undefined ? {} : { wheelSensitivity }),
    });
    cyRef.current = cy;
    cy.resize();

    let running: cytoscape.Layouts | null = null;
    if (!folding) {
      running = cy.layout(now.layout ?? { name: "preset" });
      // Rotear só quando a física para: dobrar contra posições que ainda se
      // movem calcula um desvio em volta de onde o nó ESTAVA.
      if (now.route) cy.one("layoutstop", () => routeEdges(cy));
      running.run();
    }

    if (now.onSelect) {
      cy.on("tap", "node", (ev) => latest.current.onSelect?.(String(ev.target.data("id"))));
      cy.on("tap", (ev) => {
        if (ev.target === cy) latest.current.onSelect?.("");
      });
    }

    // O CONTAINER, NÃO A JANELA. `resize` de window não dispara quando um painel
    // lateral abre ao lado do canvas, e o grafo fica desenhado pro tamanho
    // antigo até alguém mexer na moldura.
    const observer = new ResizeObserver(() => {
      if (cy.destroyed()) return;
      cy.resize();
      cy.fit(cy.elements(), latest.current.fitPadding);
    });
    observer.observe(host);

    const leaveSeam = joinSeam(cy);
    const unregister = now.register?.(cy);

    return () => {
      observer.disconnect();
      unregister?.();
      leaveSeam();
      // PARA O LAYOUT, DEPOIS AS ANIMAÇÕES, DEPOIS DESTRÓI — nesta ordem.
      running?.stop();
      cy.stop();
      cy.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, rebuildKey, maxZoom, wheelSensitivity]);

  // ── a dobra: um degrau por vez ────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.destroyed() || reveal === undefined) return;
    const reduced = reducedMotion();
    let added = false;

    for (const el of elements) {
      const nodeId = String(el.data?.id ?? "");
      const level = Number(el.data?.level ?? 0);
      const isEdge = el.data?.source !== undefined;
      if (isEdge || !nodeId || level > reveal) continue;
      if (cy.getElementById(nodeId).nonempty()) continue;
      const ele = cy.add(el);
      if (!reduced) {
        ele.style("opacity", 0);
        ele.animate({ style: { opacity: 1 } }, { duration: 500 });
      }
      added = true;
    }
    for (const el of elements) {
      const src = el.data?.source === undefined ? "" : String(el.data.source);
      const tgt = el.data?.target === undefined ? "" : String(el.data.target);
      if (!src || !tgt) continue;
      const eid = String(el.data?.id ?? `${src}->${tgt}`);
      if (cy.getElementById(eid).nonempty()) continue;
      if (cy.getElementById(src).empty() || cy.getElementById(tgt).empty()) continue;
      cy.add(el);
      added = true;
    }
    if (!added) return;

    cy.layout({
      name: "breadthfirst",
      directed: true,
      spacingFactor: 1.25,
      padding: 60,
      animate: !reduced,
      animationDuration: 600,
      // O `fit` do layout mede o container ANTES do sticky assentar; refazer o
      // enquadramento depois é o que impede a raiz de nascer cortada no topo.
      stop: () =>
        cy.animate({ fit: { eles: cy.elements(), padding: fitPadding } }, { duration: reduced ? 0 : 400 }),
    } as cytoscape.LayoutOptions).run();
  }, [elements, reveal, fitPadding]);

  // ── o foco ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.destroyed() || reveal !== undefined) return;

    cy.elements().removeClass("dim");
    if (selected) {
      // `getElementById`, NUNCA `cy.$("#" + id)`: um id de órfão é
      // `orphan:extension/webview`, e `:` e `/` são sintaxe de seletor — o `$`
      // joga e derruba a página inteira (medido 20/08, clicando num órfão).
      const node = cy.getElementById(selected);
      if (node.nonempty() && node.isNode()) {
        cy.elements().addClass("dim");
        const around = node.closedNeighborhood();
        around.removeClass("dim");
        pulse(node);
        cy.animate({ fit: { eles: around, padding: fitPadding + 40 }, duration: 320 });
      }
    } else {
      cy.animate({ fit: { eles: cy.elements(":visible"), padding: fitPadding }, duration: 320 });
    }
    if (route) routeEdges(cy);
  }, [selected, route, reveal, fitPadding]);

  return (
    <div
      id={id}
      ref={box}
      className={`graph-canvas ${className}`.trim()}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

// ─── A FACHADA DA DOBRA ──────────────────────────────────────────────────────

/** O grafo por NÍVEL: a hierarquia vira leitura antes de virar rótulo, e a
 *  dobra da landing sobe o nível conforme rola.
 *
 *  ASSINATURA CONGELADA — `packages/lp-slices/src/GraphStory.tsx` chama
 *  `<GraphCanvas nodes={NODES} level={step} />` e não é editado nesta tarefa. */
export function GraphCanvas({
  nodes,
  level,
  className = "",
}: {
  nodes: GraphNode[];
  level: number;
  className?: string;
}) {
  const elements = useRef<cytoscape.ElementDefinition[]>([]);
  const from = useRef<GraphNode[] | null>(null);
  if (from.current !== nodes) {
    from.current = nodes;
    elements.current = [
      ...nodes.map((n) => ({
        data: { id: n.id, label: n.label, level: n.level, custom: n.custom ? 1 : 0 },
      })),
      ...nodes
        .filter((n) => n.parent)
        .map((n) => ({ data: { id: `${n.parent}->${n.id}`, source: n.parent!, target: n.id } })),
    ];
  }

  return <Graph elements={elements.current} reveal={level} interactive={false} className={className} />;
}
