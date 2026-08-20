import { useState, type ReactNode } from "react";
import { Button as HeroButton, Card as HeroCard, CardContent } from "@heroui/react";
import { ThemeSwitch, type Theme } from "./theme";

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

// ─── CHROME ─────────────────────────────────────────────────────────────────

export type NavLink = { label: string; href: string };

export function Nav({
  brand,
  mark,
  links,
  theme,
  setTheme,
}: {
  brand: string;
  mark: ReactNode;
  links: NavLink[];
  theme: Theme;
  setTheme: (t: Theme) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <nav className="nav shell" aria-label="Navegação principal">
      <a className="brand" href="#top" aria-label={`${brand}, início`}>
        <span className="brand-mark">{mark}</span>
        <span>{brand}</span>
      </a>
      <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span /> <span />
      </button>
      <div className={`nav-links ${open ? "open" : ""}`}>
        {links.map((l) =>
          l.href.startsWith("http") ? (
            <ExternalLink key={l.href} href={l.href}>
              {l.label}
            </ExternalLink>
          ) : (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ),
        )}
      </div>
      <ThemeSwitch theme={theme} setTheme={setTheme} />
    </nav>
  );
}

export function Hero({
  eyebrow,
  title,
  line,
  children,
  actions,
  proof,
  note,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  /** A linha em gradiente logo abaixo do título. */
  line?: ReactNode;
  /** O parágrafo de posicionamento. */
  children: ReactNode;
  actions?: ReactNode;
  proof?: string[];
  note?: ReactNode;
}) {
  return (
    <header className="hero shell" id="top" data-fold>
      <div className="eyebrow">
        <span className="pulse" />
        {eyebrow}
      </div>
      <h1>{title}</h1>
      {line && <p className="hero-line">{line}</p>}
      <p className="hero-copy">{children}</p>
      {actions && <div className="hero-actions">{actions}</div>}
      {proof && (
        <div className="hero-proof">
          {proof.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
      )}
      {note && <p className="hero-note">{note}</p>}
    </header>
  );
}

/** A faixa que corre. O texto é repetido internamente porque a animação anda
 *  35% da largura — uma cópia só deixaria um vão visível no laço. */
export function Ticker({ items }: { items: string[] }) {
  const run = [...items, ...items];
  return (
    <section className="ticker" aria-label="Resumo">
      <div>
        {run.map((t, i) => (
          <span key={i}>
            {t} <b>✦</b>{" "}
          </span>
        ))}
      </div>
    </section>
  );
}

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

export function Footer({
  brand,
  mark,
  tagline,
  links,
}: {
  brand: string;
  mark: ReactNode;
  tagline: string;
  links: NavLink[];
}) {
  return (
    <footer className="footer shell">
      <a className="brand" href="#top">
        <span className="brand-mark">{mark}</span>
        <span>{brand}</span>
      </a>
      <p>{tagline}</p>
      <div>
        {links.map((l) => (
          <ExternalLink key={l.href} href={l.href}>
            {l.label}
          </ExternalLink>
        ))}
      </div>
    </footer>
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
