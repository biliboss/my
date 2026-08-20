import type { ReactNode } from "react";
import { ExternalLink, type NavLink } from "./Primitives";

//! O RODAPÉ: a marca de novo, uma frase, e para onde mais se pode ir.

export function LpFooter({
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
