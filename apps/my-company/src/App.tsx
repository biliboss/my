import { useEffect, useState } from "react";
import { Card, CardContent } from "@heroui/react";
import { Arrow, Button, familyLinks, LpFamilyShowcase, LpFinalCta, LpFoldNav, LpFooter, LpHero, LpNav, LpTicker, Mark, Page } from "@biliboss/my-ui";
import { GraphStory } from "./GraphStory";

function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Page>
      <LpFoldNav />
      <LpNav
        brand="my-company"
        mark={<Mark slug="my-company" />}
        links={[
            { label: "Teoria", href: "#teoria" },
            { label: "Linhagem", href: "#linhagem" },
            { label: "Família", href: "#familia" },
            { label: "GitHub", href: "https://github.com/biliboss/my-company" },
          ]}
      />

      <LpHero
        eyebrow={<> landing antes do produto · open source · família my</>}
        title={<>Toda empresa depende de<br /><em>três processos.</em></>}
        line={<>O resto é variação.</>}
        actions={
          <>
              <Button href="https://github.com/biliboss/my-company">Acompanhar no GitHub <Arrow /></Button>
              <Button href="#teoria" variant="secondary">Ver os três <Arrow down /></Button>
          </>
        }
        proof={["Vender o que entrega.", "Entregar o que vendeu.", "Ser amado pelo que entregou."]}
      >
        <strong>my-company</strong> é uma teoria open source sobre o que sustenta uma empresa de pé —
          e esta página veio <strong>antes do projeto existir</strong>, de propósito:
          a promessa é o primeiro artefato.
      </LpHero>

      {/* Sem `data-fold` aqui: os marcadores da própria GraphStory já param
          nesta altura, e dois stops no mesmo y custam duas teclas pro mesmo lugar. */}
      <section id="teoria" aria-label="A teoria, desenhada">
        <GraphStory />
      </section>

      <div className="shell">
        <div className="caveat" style={{ marginTop: 56 }}>
          <span>UMA SIMPLIFICAÇÃO ÚTIL</span>
          <p>Os três processos são fundamentos, não o mapa completo. A força do modelo está em ser pequeno o bastante pra ser usado segunda-feira de manhã — e honesto o bastante pra não prometer ser tudo.</p>
        </div>
      </div>

      <LpTicker items={["SELL WHAT YOU DELIVER", "DELIVER WHAT YOU SOLD", "BE LOVED FOR WHAT YOU DELIVERED", "LANDING BEFORE PRODUCT"]} />

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

      <LpFamilyShowcase
        self="my-company"
        kicker="03 / da mesma família"
        title="my-company é a teoria."
        lead={
          <>
            A família my pratica o que prega: esta página é o primeiro artefato do projeto — versionada, aberta, e anterior ao produto.
          </>
        }
      />

      <LpFinalCta
        kicker="A PÁGINA É O PRIMEIRO ARTEFATO"
        title={<>Comece pela promessa.<br />O projeto nasce em público.</>}
        action={{ label: "Acompanhar a construção", href: "https://github.com/biliboss/my-company" }}
      >
        my-company começou como esta landing — antes do primeiro processo escrito. A teoria vira método aqui, commit a commit.
      </LpFinalCta>

      <LpFooter
        brand="my-company"
        mark={<Mark slug="my-company" />}
        tagline="Sell what you deliver. Deliver what you sold. Be loved."
        links={[...familyLinks("my-company"), { label: "Código", href: "https://github.com/biliboss/my-company" }]}
      />
    </Page>
  );
}

export default App;
