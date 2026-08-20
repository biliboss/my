import type { ReactNode } from "react";
import { Button as HeroButton, Card as HeroCard, CardContent } from "@heroui/react";

//! AS PRIMITIVAS DA FAMÍLIA. Cada uma existia igual em quatro landings; a que
//! muda de produto pra produto entra por prop, e o resto é o design system.
//!
//! Elas embrulham o HeroUI em vez de substituí-lo: o HeroUI dá comportamento e
//! acessibilidade, e o embrulho dá a casca desta casa. Um `<Button>` daqui é um
//! HeroUI Button com a classe certa — não um botão novo.

// ─── ÁTOMOS ─────────────────────────────────────────────────────────────────

/** A seta que marca link externo (↗) ou âncora na própria página (↓). */
export function Arrow({ down = false }: { down?: boolean }) {
  return <span aria-hidden="true">{down ? "↓" : "↗"}</span>;
}

export type ButtonProps = {
  children: ReactNode;
  /** Pra onde o botão leva. Ausente = botão comum. */
  href?: string;
  variant?: "primary" | "secondary";
  className?: string;
  onClick?: () => void;
};

/** O CTA da casa. `href` externo abre em aba nova com `rel` seguro — é a
 *  omissão que mais se repete quando cada landing escreve o seu. */
export function Button({ children, href, variant = "primary", className = "", onClick }: ButtonProps) {
  const button = (
    <HeroButton
      size="lg"
      variant={variant === "secondary" ? "ghost" : undefined}
      className={`${variant === "primary" ? "primary-cta" : "secondary-cta"} ${className}`}
      onClick={onClick}
    >
      {children}
    </HeroButton>
  );
  if (!href) return button;
  const external = href.startsWith("http");
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      {button}
    </a>
  );
}

/** Link externo com a seta, e o `rel` que ninguém lembra de pôr. */
export function ExternalLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children} <Arrow />
    </a>
  );
}

// ─── LAYOUT ─────────────────────────────────────────────────────────────────

/** A moldura: grade de fundo, ruído, as duas luzes ambiente e o `overflow-x:
 *  clip` que mantém `position: sticky` funcionando lá dentro. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <main>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      {children}
    </main>
  );
}

/** Uma faixa de largura de leitura. `wide` solta pra largura total (a dobra
 *  parallax e a faixa clara da família usam isso). */
export function Shell({
  children,
  className = "",
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "header" | "footer";
}) {
  return <As className={`shell ${className}`}>{children}</As>;
}

/** Uma dobra: vira parada do `j`/`k` por padrão. */
export function Section({
  children,
  id,
  className = "",
  fold = true,
  label,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
  fold?: boolean;
  label?: string;
}) {
  return (
    <section id={id} className={className} aria-label={label} {...(fold ? { "data-fold": true } : {})}>
      {children}
    </section>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <div className="section-kicker">{children}</div>;
}

/** Título grande à esquerda, parágrafo de apoio à direita. */
export function SplitHeading({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="split-heading">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

// ─── CHIP ───────────────────────────────────────────────────────────────────

/** O rótulo miúdo. `active` é o estado que importa: num quadro que gira por
 *  rótulo, o chip aceso é a prova de onde a coluna veio. */
export function Chip({
  children,
  active = false,
  className = "",
}: {
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return <span className={`chip ${active ? "active" : ""} ${className}`}>{children}</span>;
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="chip-row">{children}</div>;
}

/** Um item de navegação. Vive aqui porque `LpNav` e `LpFooter` consomem os dois
 *  o mesmo formato, e um tipo repetido em dois arquivos vira dois tipos. */
export type NavLink = { label: string; href: string };

/** O par ANTES/DEPOIS. Duas dessas lado a lado é a dobra do problema em toda
 *  landing da família — `accent` marca qual das duas é a nossa. */
export function Compare({
  label,
  title,
  points,
  accent = false,
}: {
  label: string;
  title: ReactNode;
  points: ReactNode[];
  accent?: boolean;
}) {
  return (
    <HeroCard className={`compare-card ${accent ? "accent-card" : "muted-card"}`}>
      <CardContent>
        <span className="card-number">{label}</span>
        <h3>{title}</h3>
        <ul>
          {points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </CardContent>
    </HeroCard>
  );
}

/** A caixa que assume o limite do que está sendo dito. Ela é obrigatória por
 *  gosto da casa: promessa sem letra miúda é promessa que envelhece mal. */
export function Caveat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="caveat">
      <span>{label}</span>
      <p>{children}</p>
    </div>
  );
}
