import { useState, type ReactNode } from "react";
import { ExternalLink, type NavLink } from "./Primitives";

//! A BARRA da landing: marca à esquerda, links no meio, o que sobrar à direita.
//! O menu de celular é estado local porque ninguém, nunca, precisou abri-lo de
//! fora — e um estado que sobe pro pai é um estado que dois lugares erram.

export function LpNav({
  brand,
  mark,
  links,
  trailing,
}: {
  brand: string;
  mark: ReactNode;
  links: NavLink[];
  /** O que fica depois dos links. Vazio na maioria das páginas — a paleta é
   *  uma só, então não há seletor de tema pra pendurar aqui. */
  trailing?: ReactNode;
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
      {trailing}
    </nav>
  );
}
