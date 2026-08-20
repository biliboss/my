import { useEffect, useState } from "react";
import { Button, Card, CardContent } from "@heroui/react";
import { Family, FoldNav, ThemeSwitch, useTheme } from "@biliboss/my-ui";
import { GraphStory } from "./GraphStory";

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
        <a className="brand" href="#top" aria-label="my-company, início">
          <span className="brand-mark">c</span><span>my-company</span>
        </a>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
          <span /> <span />
        </button>
        <div className={`nav-links ${menuOpen ? "open" : ""}`}>
          <a href="#teoria">Teoria</a>
          <a href="#linhagem">Linhagem</a>
          <a href="#familia">Família</a>
          <a href="https://github.com/biliboss/my-company" target="_blank" rel="noreferrer">GitHub <Arrow /></a>
        </div>
        <ThemeSwitch theme={theme} setTheme={setTheme} />
      </nav>

      <header className="hero shell" id="top" data-fold>
        <div className="eyebrow"><span className="pulse" /> landing antes do produto · open source · família my</div>
        <h1>Toda empresa depende de<br /><em>três processos.</em></h1>
        <p className="hero-line">O resto é variação.</p>
        <p className="hero-copy">
          <strong>my-company</strong> é uma teoria open source sobre o que sustenta uma empresa de pé —
          e esta página veio <strong>antes do projeto existir</strong>, de propósito:
          a promessa é o primeiro artefato.
        </p>
        <div className="hero-actions">
          <a href="https://github.com/biliboss/my-company" target="_blank" rel="noreferrer">
            <Button size="lg" className="primary-cta">Acompanhar no GitHub <Arrow /></Button>
          </a>
          <a href="#teoria">
            <Button size="lg" variant="ghost" className="secondary-cta">Ver os três <Arrow down /></Button>
          </a>
        </div>
        <div className="hero-proof" aria-label="Os três processos">
          <span>Vender o que entrega.</span>
          <span>Entregar o que vendeu.</span>
          <span>Ser amado pelo que entregou.</span>
        </div>
      </header>

      {/* Sem `data-fold` aqui: os marcadores da própria GraphStory já param
          nesta altura, e dois stops no mesmo y custam duas teclas pro mesmo lugar. */}
      <section id="teoria" aria-label="A teoria, desenhada">
        <GraphStory theme={theme} />
      </section>

      <div className="shell">
        <div className="caveat" style={{ marginTop: 56 }}>
          <span>UMA SIMPLIFICAÇÃO ÚTIL</span>
          <p>Os três processos são fundamentos, não o mapa completo. A força do modelo está em ser pequeno o bastante pra ser usado segunda-feira de manhã — e honesto o bastante pra não prometer ser tudo.</p>
        </div>
      </div>

      <section className="ticker" aria-label="Resumo">
        <div>SELL WHAT YOU DELIVER <b>✦</b> DELIVER WHAT YOU SOLD <b>✦</b> BE LOVED FOR WHAT YOU DELIVERED <b>✦</b> LANDING BEFORE PRODUCT <b>✦</b> SELL WHAT YOU DELIVER <b>✦</b> DELIVER WHAT YOU SOLD <b>✦</b> BE LOVED FOR WHAT YOU DELIVERED <b>✦</b> LANDING BEFORE PRODUCT <b>✦</b></div>
      </section>

      <section className="shell section problem" data-fold>
        <div className="section-kicker">02 / o problema real</div>
        <div className="split-heading">
          <h2>Empresas não morrem<br />de falta de ideia.</h2>
          <p>Morrem na junção entre o que foi prometido, o que foi entregue e o que foi sentido por quem pagou.</p>
        </div>
        <div className="comparison-grid">
          <Card className="compare-card muted-card">
            <CardContent>
              <span className="card-number">A EMPRESA COMO CAOS</span>
              <h3>Ninguém sabe onde quebrou</h3>
              <ul>
                <li>Vende o que não entrega</li>
                <li>Entrega o que não foi vendido</li>
                <li>Entrega, e ninguém ama</li>
                <li>Cada junção vira culpa de alguém</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="compare-card accent-card">
            <CardContent>
              <span className="card-number">COM MY-COMPANY</span>
              <h3>Três processos nomeados</h3>
              <ul>
                <li>A promessa cabe na operação</li>
                <li>A operação honra a promessa</li>
                <li>O cliente fica porque amou</li>
                <li>Cada junção tem dono e métrica</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="shell section principle" id="linhagem" data-fold>
        <div className="principle-mark">“</div>
        <blockquote>Hipster desenha. Hustler vende.<br /><em>Hacker constrói.</em></blockquote>
        <p>
          O trio Hipster–Hustler–Hacker — popularizado por{" "}
          <a href="https://www.linkedin.com/in/reidhoffman/" target="_blank" rel="noreferrer">Reid Hoffman</a>{" "}
          — descreve os perfis de um founding team. <strong>my-company</strong> é a evolução orientada a
          processos: dos perfis das <strong>pessoas</strong> para os processos da <strong>empresa</strong>.
          O crédito é deles. A pergunta nova é nossa.
        </p>
      </section>

      <Family
        self="my-company"
        kicker="03 / da mesma família"
        title="my-company é a teoria."
        lead={
          <>
            A família my pratica o que prega: esta página é o primeiro artefato do projeto — versionada, aberta, e anterior ao produto.
          </>
        }
      />

      <section className="shell final-cta" data-fold>
        <span className="section-kicker">A PÁGINA É O PRIMEIRO ARTEFATO</span>
        <h2>Comece pela promessa.<br />O projeto nasce em público.</h2>
        <p>my-company começou como esta landing — antes do primeiro processo escrito. A teoria vira método aqui, commit a commit.</p>
        <a href="https://github.com/biliboss/my-company" target="_blank" rel="noreferrer">
          <Button size="lg" className="primary-cta">Acompanhar a construção <Arrow /></Button>
        </a>
      </section>

      <footer className="footer shell">
        <a className="brand" href="#top"><span className="brand-mark">c</span><span>my-company</span></a>
        <p>Sell what you deliver. Deliver what you sold. Be loved.</p>
        <div>
          <a href="https://biliboss.github.io/my/" target="_blank" rel="noreferrer">my <Arrow /></a>
          <a href="https://biliboss.github.io/my-graph/" target="_blank" rel="noreferrer">my-graph <Arrow /></a>
          <a href="https://github.com/biliboss/my-company" target="_blank" rel="noreferrer">Código <Arrow /></a>
        </div>
      </footer>
    </main>
  );
}

export default App;
