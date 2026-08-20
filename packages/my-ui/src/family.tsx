import type { ReactNode } from "react";
import { ExternalLink } from "./primitives";
import { MyGraphMark } from "./logos";

//! A FAMÍLIA, como DADO. Ela aparece em toda landing, e enquanto era markup
//! copiado, incluir um quarto produto custou quatro commits em quatro repos —
//! e um deles quase ficou pra trás. Agora custa uma linha aqui e um bump.

export type Product = {
  slug: string;
  name: string;
  /** O papel dele em duas palavras: o sistema, a radiografia, a teoria… */
  role: string;
  lines: [string, string];
  page: string;
  repo: string;
  /** A inicial usada enquanto o produto não tem marca desenhada. */
  letter: string;
};

export const FAMILY: Product[] = [
  {
    slug: "my",
    name: "my",
    role: "o sistema",
    lines: ["Sistema operacional pessoal local-first", "Pastas e contratos como arquitetura"],
    page: "https://biliboss.github.io/my/",
    repo: "https://github.com/biliboss/my",
    letter: "m",
  },
  {
    slug: "my-graph",
    name: "my-graph",
    role: "a radiografia",
    lines: ["Desenha quem depende de quem, lido do código", "Código ruim parece bagunçado; código bom, organizado"],
    page: "https://biliboss.github.io/my-graph/",
    repo: "https://github.com/biliboss/my-graph",
    letter: "g",
  },
  {
    slug: "my-company",
    name: "my-company",
    role: "a teoria",
    lines: ["Os três processos de que toda empresa depende", "A landing veio antes do projeto — de propósito"],
    page: "https://biliboss.github.io/my-company/",
    repo: "https://github.com/biliboss/my-company",
    letter: "c",
  },
  {
    slug: "my-kanban",
    name: "my-kanban",
    role: "o quadro",
    lines: ["O mesmo conjunto de cards, várias perguntas", "A coluna é uma query, não uma gaveta"],
    page: "https://biliboss.github.io/my-kanban/",
    repo: "https://github.com/biliboss/my-kanban",
    letter: "k",
  },
];

export const product = (slug: string) => FAMILY.find((p) => p.slug === slug)!;

/** A marca de um produto: desenhada quando existe, inicial enquanto não. */
export function Mark({ slug, size = 28 }: { slug: string; size?: number }) {
  if (slug === "my-graph") return <MyGraphMark size={size} />;
  return (
    <span className="brand-letter" aria-hidden="true" style={{ fontSize: size * 0.5 }}>
      {product(slug).letter}
    </span>
  );
}

/** A faixa clara com a família inteira. `self` é o produto que está falando —
 *  ele aparece na grade, mas sem link pra si mesmo. */
export function Family({
  self,
  kicker,
  title,
  lead,
  cta,
}: {
  self: string;
  kicker: ReactNode;
  title: ReactNode;
  lead: ReactNode;
  cta?: { label: string; href: string };
}) {
  return (
    <section className="fit-section" id="familia" data-fold>
      <div className="shell section fit-grid">
        <div>
          <div className="section-kicker">{kicker}</div>
          <h2>{title}</h2>
          <p className="lead">{lead}</p>
          {cta && (
            <a href={cta.href} target="_blank" rel="noreferrer" className="family-link">
              {cta.label} <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
        <div className={`fit-columns ${FAMILY.length === 4 ? "four" : "three"}`}>
          {FAMILY.map((p) => (
            <div className="fit-column fam" key={p.slug}>
              <span>
                {p.name.toUpperCase()} — {p.role.toUpperCase()}
              </span>
              <p>{p.lines[0]}</p>
              <p>{p.lines[1]}</p>
              <p>
                {p.slug === self ? (
                  <em>você está aqui</em>
                ) : (
                  <ExternalLink href={p.page}>{p.page.replace("https://", "")}</ExternalLink>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Os links da família pro rodapé, menos o do próprio produto. */
export function familyLinks(self: string) {
  return FAMILY.filter((p) => p.slug !== self).map((p) => ({ label: p.name, href: p.page }));
}
