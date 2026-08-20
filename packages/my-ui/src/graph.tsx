import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

//! O GRAFO DA CASA — entrada separada (`@biliboss/my-ui/graph`) porque só um
//! produto usa cytoscape, e três não devem pagar por ele. `cytoscape` é peer
//! OPCIONAL: quem não importa daqui nunca o resolve.
//!
//! Ele desenha nós por NÍVEL, e é o nível que decide tamanho e cor — a hierarquia
//! vira leitura antes de virar rótulo.

export type GraphNode = {
  id: string;
  label: string;
  /** 0 é a raiz. Tamanho e cor saem daqui. */
  level: number;
  parent?: string;
  /** Nó tracejado: o que o usuário acrescenta, e não vem pronto. */
  custom?: boolean;
};

function readCss(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Lida no momento da chamada, nunca no load do módulo: a paleta muda com o
 *  seletor de tema, e um canvas não resolve `var(--primary)` sozinho. */
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
        "font-family": readCss("--font-sans") || "Inter, sans-serif",
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
  ];
}

export function GraphCanvas({
  nodes,
  /** Revela todo nó de nível <= este. Suba com o passo da dobra. */
  level,
  /** Só pra reagir à troca: a paleta é lida do documento, não daqui. */
  theme,
  className = "",
}: {
  nodes: GraphNode[];
  level: number;
  theme?: string;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cy = cytoscape({
      container: boxRef.current,
      elements: [],
      userZoomingEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
      autoungrabify: true,
      style: graphStyle(),
    });
    cyRef.current = cy;
    cy.resize();
    const onResize = () => {
      cy.resize();
      cy.fit(cy.elements(), 70);
    };
    addEventListener("resize", onResize);
    return () => {
      removeEventListener("resize", onResize);
      cy.destroy();
    };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let added = false;

    for (const n of nodes) {
      if (n.level <= level && cy.getElementById(n.id).length === 0) {
        const ele = cy.add({
          data: { id: n.id, label: n.label, level: n.level, custom: n.custom ? 1 : 0 },
        });
        if (!reduced) {
          ele.style("opacity", 0);
          ele.animate({ style: { opacity: 1 } }, { duration: 500 });
        }
        added = true;
      }
    }
    for (const n of nodes) {
      const eid = `${n.parent}->${n.id}`;
      if (
        n.parent &&
        n.level <= level &&
        cy.getElementById(eid).length === 0 &&
        cy.getElementById(n.parent).length > 0
      ) {
        cy.add({ data: { id: eid, source: n.parent, target: n.id } });
        added = true;
      }
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
        cy.animate({ fit: { eles: cy.elements(), padding: 70 } }, { duration: reduced ? 0 : 400 }),
    }).run();
  }, [nodes, level]);

  // O efeito do filho roda ANTES de o pai escrever `data-theme`; um quadro
  // depois ele já está lá.
  useEffect(() => {
    const id = requestAnimationFrame(() => cyRef.current?.style(graphStyle()).update());
    return () => cancelAnimationFrame(id);
  }, [theme]);

  return <div className={`graph-canvas ${className}`} ref={boxRef} style={{ width: "100%", height: "100%" }} />;
}
