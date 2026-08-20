import { useEffect, useRef, useState, type ReactNode } from "react";

//! A DOBRA PARALLAX: uma seção alta, um painel `sticky`, e um passo por trecho
//! de rolagem. Ela existia duas vezes — no my-company e no my-kanban — e o
//! mesmo bug teve de ser consertado duas vezes. Por isso mora aqui.
//!
//! O parallax é uma variável só: `--p` (0→1) escrita no scroll, e o CSS move
//! halo, palco e legenda em RITMOS diferentes. Duas velocidades já são
//! parallax; três dão profundidade sem custar JS.

export type LpParallaxStep = {
  /** A etiqueta monoespaçada acima do título. */
  kicker: string;
  title: string;
  copy: string;
};

export type LpParallaxProps = {
  steps: LpParallaxStep[];
  /** Quanto de rolagem cada passo ocupa, em vh. */
  stepVh?: number;
  /** Quanto o palco recua na base pra não ficar atrás da legenda. */
  stageBottom?: number;
  stageBottomSm?: number;
  className?: string;
  /** A camada visual, redesenhada a cada passo. Recebe o índice do passo. */
  children: (step: number) => ReactNode;
};

export function LpParallax({
  steps,
  stepVh = 100,
  stageBottom = 260,
  stageBottomSm = 210,
  className = "",
  children,
}: LpParallaxProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  // A dobra é `sticky`, então o progresso corre por `offsetHeight - innerHeight`,
  // não por `offsetHeight`. TODA posição derivada do progresso sai desta conta —
  // ver o comentário nos marcadores abaixo pro que acontece quando não sai.
  const spanVh = steps.length * stepVh - 100;

  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / (el.offsetHeight - innerHeight)));
      el.style.setProperty("--p", String(progress));
      setStep(Math.min(steps.length - 1, Math.floor(progress * steps.length)));
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, [steps.length]);

  const goTo = (i: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + scrollY;
    const span = el.offsetHeight - innerHeight;
    scrollTo({ top: top + span * ((i + 0.5) / steps.length), behavior: "smooth" });
  };

  const s = steps[step];

  return (
    <div
      className={`story ${className}`}
      ref={sectionRef}
      style={
        {
          height: `${steps.length * stepVh}vh`,
          "--stage-bottom": `${stageBottom}px`,
          "--stage-bottom-sm": `${stageBottomSm}px`,
        } as React.CSSProperties
      }
    >
      {/* Marcadores de dobra pro `j`/`k`: sem eles a navegação pularia a
          demonstração inteira de uma vez. A posição vem da MESMA fórmula que o
          scroll usa pra escolher o passo — espaçar "de stepVh em stepVh" parece
          equivalente e não é, e a divergência perto do fim pula um passo
          inteiro. Medido com qa-drive em 20/08. */}
      {steps.map((_, i) => (
        <span
          key={i}
          data-fold
          aria-hidden="true"
          className="fold-stop"
          style={{ top: `${spanVh * ((i + 0.5) / steps.length)}vh` }}
        />
      ))}

      <div className="story-sticky">
        <div className="story-stage">{children(step)}</div>
        <div className="story-caption" aria-live="polite">
          <div key={step} className="story-caption-inner">
            <span className="card-number">{s.kicker}</span>
            <h3>{s.title}</h3>
            <p>{s.copy}</p>
          </div>
          <div className="story-dots">
            {steps.map((q, i) => (
              <button
                key={q.kicker}
                type="button"
                className={i === step ? "active" : ""}
                aria-label={`Ir para: ${q.title}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
