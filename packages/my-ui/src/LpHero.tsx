import type { ReactNode } from "react";

//! A PRIMEIRA DOBRA. Cada peça é opcional menos o título e o parágrafo: uma
//! landing sem prova ainda é uma landing; sem promessa, não é.

export function LpHero({
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
  /** As afirmações curtas na régua embaixo. */
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
