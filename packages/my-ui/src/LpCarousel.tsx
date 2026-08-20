import { useEffect, useState } from "react";

//! O CARROSSEL de prova: uma imagem grande, a explicação ao lado, e o passo
//! automático. Ele nasceu inline no my-graph e virou peça porque a prova visual
//! é o padrão da família — quem tem print pra mostrar mostra assim.
//!
//! PAUSA NO HOVER, e isso não é gentileza: um carrossel que troca embaixo do
//! cursor rouba o slide que a pessoa parou pra ler.

export type LpSlide = {
  src: string;
  kicker: string;
  title: string;
  copy: string;
};

export function LpCarousel({
  slides,
  label,
  /** Milissegundos por slide. `0` desliga o passo automático. */
  interval = 5000,
}: {
  slides: LpSlide[];
  label: string;
  interval?: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || !interval) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), interval);
    return () => clearInterval(id);
  }, [paused, interval, slides.length]);

  const slide = slides[index];
  const go = (i: number) => setIndex((i + slides.length) % slides.length);

  return (
    <div
      className="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carrossel"
      aria-label={label}
    >
      <figure className="carousel-figure">
        {slides.map((s, i) => (
          <img
            key={s.src}
            src={s.src}
            alt={`${s.kicker} — ${s.title}`}
            className={i === index ? "active" : ""}
            aria-hidden={i !== index}
            // só a primeira é `eager`: as outras não estão na tela ainda
            loading={i === 0 ? "eager" : "lazy"}
          />
        ))}
      </figure>
      <div className="carousel-side">
        <div className="carousel-copy" aria-live="polite">
          <span className="card-number">{slide.kicker}</span>
          <h3>{slide.title}</h3>
          <p>{slide.copy}</p>
        </div>
        <div className="carousel-controls">
          <button aria-label="Anterior" onClick={() => go(index - 1)}>
            ←
          </button>
          <div className="carousel-dots">
            {slides.map((s, i) => (
              <button
                key={s.src}
                aria-label={`Slide ${i + 1}: ${s.kicker}`}
                className={i === index ? "active" : ""}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <button aria-label="Próximo" onClick={() => go(index + 1)}>
            →
          </button>
        </div>
      </div>
    </div>
  );
}
