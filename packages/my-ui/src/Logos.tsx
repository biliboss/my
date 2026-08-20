//! OS LOGOS DA FAMÍLIA. Todos no mesmo alfabeto: nó e aresta. A marca não
//! ilustra o produto — ela DESENHA a tese dele com as primitivas de um grafo,
//! que é o que esta casa usa pra pensar.
//!
//! Estrutura em `currentColor`; os acentos saem dos tokens do tema, então a
//! marca troca de cor junto com a página em vez de carregar um hex próprio.

type MarkProps = {
  size?: number;
  /** Rótulo acessível. `null` marca a figura como decorativa. */
  title?: string | null;
  className?: string;
};

function svgProps({ size = 28, title, className }: MarkProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    className,
    fill: "none" as const,
    role: title ? ("img" as const) : undefined,
    "aria-hidden": title ? undefined : true,
    "aria-label": title ?? undefined,
  };
}

/**
 * my-graph — A BALANÇA.
 *
 * Um grafo pendurado num fiel: à esquerda a aresta SÓLIDA, à direita a
 * TRACEJADA. É a distinção inteira do my-graph em duas linhas — sólida é
 * `import`, lida do código; tracejada é `//! depends_on:`, declarada e não
 * verificada. As duas sustentam pratos de peso diferente, que é exatamente o
 * ponto: um diagrama que trata as duas como iguais está mentindo.
 */
export function MyGraphMark(props: MarkProps = {}) {
  const s = 2.6;
  return (
    <svg {...svgProps({ title: "my-graph", ...props })}>
      <g stroke="currentColor" strokeWidth={s} strokeLinecap="round" fill="none">
        {/* a travessa */}
        <path d="M30 12 L14 15.5" />
        <path d="M30 12 L46 10.5" />
        {/* o braço lido do código: sólido */}
        <path d="M14 15.5 C 10.5 20, 9.5 23, 10 26" />
        {/* o braço declarado num comentário: tracejado */}
        <path d="M46 10.5 C 49.5 15, 50 19, 49 22.5" strokeDasharray="3.4 3.6" />
        {/* o fiel, e a base */}
        <path d="M30 12 L30 31" />
        <path d="M22 37 C 24 31.5, 36 31.5, 38 37" />
      </g>
      <g fill="currentColor">
        <circle cx="30" cy="12" r="5" />
        <circle cx="14" cy="15.5" r="3.2" />
        <circle cx="46" cy="10.5" r="3.2" />
        <circle cx="30" cy="26.5" r="3.2" />
        <circle cx="22" cy="37" r="2.8" />
        <circle cx="38" cy="37" r="2.8" />
      </g>
      {/* os pratos: o que cada aresta sustenta */}
      <circle cx="10" cy="30.5" r="4.8" fill="var(--blue, #6cb2c7)" />
      <circle cx="49" cy="27" r="4.8" fill="var(--cyan, #61ffca)" />
    </svg>
  );
}

/**
 * Marca provisória: a inicial do produto na moldura da família. Existe pra que
 * trocar por um logo desenhado seja UMA linha aqui, e não uma busca por
 * `brand-mark` em quatro repositórios.
 */
export function LetterMark({ letter, ...props }: MarkProps & { letter: string }) {
  return (
    <span className="brand-letter" aria-hidden="true" style={{ fontSize: (props.size ?? 28) * 0.5 }}>
      {letter}
    </span>
  );
}
