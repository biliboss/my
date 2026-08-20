import { useEffect, useState } from "react";
import { Button, Card, CardContent } from "@heroui/react";
import { BoardStory } from "./BoardStory";
import { Family, FoldNav, ThemeSwitch, useTheme } from "@biliboss/my-ui";

function Arrow({ down = false }: { down?: boolean }) {
  return <span aria-hidden="true">{down ? "↓" : "↗"}</span>;
}

function App() {
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <FoldNav />
      <nav className="nav shell" aria-label="Navegação principal">
        <a className="brand" href="#top" aria-label="my-kanban, início">
          <span className="brand-mark">k</span><span>my-kanban</span>
        </a>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
          <span /> <span />
        </button>
        <div className={`nav-links ${menuOpen ? "open" : ""}`}>
          <a href="#perspectivas">Perspectivas</a>
          <a href="#rotulos">Rótulos</a>
          <a href="#tempo-real">Tempo real</a>
          <a href="#familia">Família</a>
          <a href="https://github.com/biliboss/my-kanban" target="_blank" rel="noreferrer">GitHub <Arrow /></a>
        </div>
        <ThemeSwitch theme={theme} setTheme={setTheme} />
      </nav>

      <header className="hero shell" id="top" data-fold>
        <div className="eyebrow"><span className="pulse" /> tempo real · event-sourced · família my</div>
        <h1>Sua coluna não é<br />uma gaveta.<em> É uma pergunta.</em></h1>
        <p className="hero-line">Troque a pergunta.</p>
        <p className="hero-copy">
          Todo quadro te obriga a escolher <strong>um</strong> eixo — e depois te cobra um segundo
          quadro pra cada pergunta que sobrou. <strong>my-kanban</strong> vira o mesmo conjunto de
          cards por qualquer rótulo <code>chave:valor</code>: nada é movido, nada é duplicado.
        </p>
        <div className="hero-actions">
          <a href="https://github.com/biliboss/my-kanban" target="_blank" rel="noreferrer">
            <Button size="lg" className="primary-cta">Acompanhar no GitHub <Arrow /></Button>
          </a>
          <a href="#perspectivas">
            <Button size="lg" variant="ghost" className="secondary-cta">Ver girar <Arrow down /></Button>
          </a>
        </div>
        <div className="hero-proof" aria-label="As quatro perguntas">
          <span>Em que pé está?</span>
          <span>A que processo serve?</span>
          <span>Quem está segurando?</span>
          <span>O que pode explodir?</span>
        </div>
        <p className="hero-note">
          Cai tudo no <strong>inbox</strong> — inclusive pedindo pra um agente. O que for relevante
          sobe pro <strong>backlog</strong>. O que estiver pronto vai pro <strong>ready</strong>,
          e é de lá que os agentes <strong>puxam</strong> trabalho.
        </p>
      </header>

      <section id="perspectivas" aria-label="As perspectivas, ao vivo">
        <BoardStory />
      </section>

      <section className="ticker" aria-label="Resumo">
        <div>A COLUNA É UMA QUERY <b>✦</b> O CARD NÃO SE MOVE <b>✦</b> A PERGUNTA MUDA <b>✦</b> UM QUADRO, N EIXOS <b>✦</b> A COLUNA É UMA QUERY <b>✦</b> O CARD NÃO SE MOVE <b>✦</b> A PERGUNTA MUDA <b>✦</b> UM QUADRO, N EIXOS <b>✦</b></div>
      </section>

      <section className="shell section problem" data-fold>
        <div className="section-kicker">02 / o problema real</div>
        <div className="split-heading">
          <h2>Ninguém mantém<br />dois quadros.</h2>
          <p>Mantém um, e responde as outras perguntas de cabeça — até o dia em que a resposta de cabeça está errada e ninguém percebeu.</p>
        </div>
        <div className="comparison-grid">
          <Card className="compare-card muted-card">
            <CardContent>
              <span className="card-number">UM EIXO SÓ</span>
              <h3>O quadro decide o que você pode perguntar</h3>
              <ul>
                <li>Coluna é status, e ponto</li>
                <li>"Por área" vira uma planilha à parte</li>
                <li>"Por pessoa" vira uma reunião</li>
                <li>Cada eixo novo é um quadro que apodrece</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="compare-card accent-card">
            <CardContent>
              <span className="card-number">COM MY-KANBAN</span>
              <h3>A pergunta decide a coluna</h3>
              <ul>
                <li>Um conjunto de cards, N eixos</li>
                <li>Rótulo <code>chave:valor</code> vira coluna na hora</li>
                <li>Nada é movido: só a projeção muda</li>
                <li>Eixo novo custa um rótulo, não um quadro</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="shell section" id="rotulos" data-fold>
        <div className="section-kicker">03 / o mecanismo</div>
        <div className="split-heading">
          <h2>Rótulo com chave.<br />Só isso.</h2>
          <p>Um rótulo solto é uma etiqueta. Um rótulo <code>chave:valor</code> é um eixo — e um eixo é uma coluna que ninguém precisou criar.</p>
        </div>
        <div className="axes">
          {[
            ["status", "inbox · backlog · ready · in progress · done", "as cinco colunas padrão — e são só o PADRÃO, não a lei"],
            ["area:", "vender · entregar · amar", "os três processos do my-company, virados coluna"],
            ["quem:", "gabriel · frota · cliente", "a pergunta da segunda-feira, sem reunião"],
            ["risco:", "alto · médio · baixo", "o eixo que só interessa na semana em que interessa"],
          ].map(([k, vals, why]) => (
            <div className="axis" key={k}>
              <code>{k}</code>
              <strong>{vals}</strong>
              <p>{why}</p>
            </div>
          ))}
        </div>
        <div className="caveat" style={{ marginTop: 56 }}>
          <span>O LIMITE, ESCRITO</span>
          <p>Rótulo sem chave continua valendo como etiqueta — ele só não vira eixo. E um eixo com trinta valores vira trinta colunas: a projeção é barata, a tela não é. O corte é seu, e ele é explícito.</p>
        </div>
      </section>

      <section className="shell section principle" id="tempo-real" data-fold>
        <div className="principle-mark">“</div>
        <blockquote>O quadro não é uma tabela.<br /><em>É uma projeção.</em></blockquote>
        <p>
          Por baixo é um <strong>stream append-only</strong>: ninguém edita uma linha, alguém
          registra um fato — <code>task_moved</code>, <code>task_deleted</code> — e a tela redesenha
          quando o evento volta. É por isso que trocar de perspectiva não custa migração: a
          coluna sempre foi uma leitura, nunca o lugar onde o card mora.
        </p>
      </section>

      <Family
        self="my-kanban"
        kicker="04 / da mesma família"
        title="my-kanban é o quadro."
        lead={
          <>
            Mesma casa, mesma disciplina: o disco é o banco, cada saída é legível, o humano é o portão. E a navegação é a mesma nas quatro.
          </>
        }
      />

      <section className="shell final-cta" data-fold>
        <span className="section-kicker">A PÁGINA É O PRIMEIRO ARTEFATO</span>
        <h2>Um quadro só.<br />Todas as perguntas.</h2>
        <p>my-kanban nasce em público, como o resto da família: a promessa primeiro, o código commit a commit.</p>
        <a href="https://github.com/biliboss/my-kanban" target="_blank" rel="noreferrer">
          <Button size="lg" className="primary-cta">Acompanhar a construção <Arrow /></Button>
        </a>
      </section>

      <footer className="footer shell">
        <a className="brand" href="#top"><span className="brand-mark">k</span><span>my-kanban</span></a>
        <p>A coluna é uma pergunta, não uma gaveta.</p>
        <div>
          <a href="https://biliboss.github.io/my/" target="_blank" rel="noreferrer">my <Arrow /></a>
          <a href="https://biliboss.github.io/my-graph/" target="_blank" rel="noreferrer">my-graph <Arrow /></a>
          <a href="https://biliboss.github.io/my-company/" target="_blank" rel="noreferrer">my-company <Arrow /></a>
          <a href="https://github.com/biliboss/my-kanban" target="_blank" rel="noreferrer">Código <Arrow /></a>
        </div>
      </footer>
    </main>
  );
}

export default App;
