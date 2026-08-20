import type { ReactNode } from "react";
import { Arrow, Button } from "./Primitives";

//! A ÚLTIMA DOBRA: quem rolou até aqui já foi convencido, então o que falta é
//! um lugar pra clicar. Existia igual nas quatro landings — mesma moldura,
//! mesma ordem, só a frase mudando.

export function LpFinalCta({
  kicker,
  title,
  children,
  action,
}: {
  kicker: string;
  title: ReactNode;
  /** O parágrafo de fechamento. */
  children: ReactNode;
  action: { label: string; href: string };
}) {
  return (
    <section className="shell final-cta" data-fold>
      <span className="section-kicker">{kicker}</span>
      <h2>{title}</h2>
      <p>{children}</p>
      <Button href={action.href}>
        {action.label} <Arrow />
      </Button>
    </section>
  );
}
