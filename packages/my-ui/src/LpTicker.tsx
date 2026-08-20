//! A faixa que corre entre duas dobras.

/** O texto é repetido internamente porque a animação anda 35% da largura —
 *  uma cópia só deixaria um vão visível no laço. */
export function LpTicker({ items }: { items: string[] }) {
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
