import { useEffect, useState } from "react";
import { Card, CardContent } from "@heroui/react";
import { BoardStory } from "./BoardStory";
import { Arrow, Button, familyLinks, LpFamilyShowcase, LpFoldNav, LpFooter, LpHero, LpNav, LpTicker, Mark, Page } from "@biliboss/my-ui";

function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Page>
      <LpFoldNav />
      <LpNav
        brand="my-kanban"
        mark={<Mark slug="my-kanban" />}
        links={[
            { label: "Perspectivas", href: "#perspectivas" },
            { label: "Rótulos", href: "#rotulos" },
            { label: "Tempo real", href: "#tempo-real" },
            { label: "Família", href: "#familia" },
            { label: "GitHub", href: "https://github.com/biliboss/my-kanban" },
          ]}
      />

      <LpHero
        eyebrow={<> tempo real · event-sourced · família my</>}
        title={<>Sua coluna não é<br />uma gaveta.<em> É uma pergunta.</em></>}
        line={<>Troque a pergunta.</>}
        actions={
          <>
              <Button href="https://github.com/biliboss/my-kanban">Acompanhar no GitHub <Arrow /></Button>
              <Button href="#perspectivas" variant="secondary">Ver girar <Arrow down /></Button>
          </>
        }
        proof={["Em que pé está?", "A que processo serve?", "Quem está segurando?", "O que pode explodir?"]}
        note={<>Cai tudo no <strong>inbox</strong> — inclusive pedindo pra um agente. O que for relevante
          sobe pro <strong>backlog</strong>. O que estiver pronto vai pro <strong>ready</strong>,
          e é de lá que os agentes <strong>puxam</strong> trabalho.</>}
      >
        Todo quadro te obriga a escolher <strong>um</strong> eixo — e depois te cobra um segundo
          quadro pra cada pergunta que sobrou. <strong>my-kanban</strong> vira o mesmo conjunto de
          cards por qualquer rótulo <code>chave:valor</code>: nada é movido, nada é duplicado.
      </LpHero>

      <section id="perspectivas" aria-label="As perspectivas, ao vivo">
        <BoardStory />
      </section>

      <LpTicker items={["A COLUNA É UMA QUERY", "O CARD NÃO SE MOVE", "A PERGUNTA MUDA", "UM QUADRO, N EIXOS"]} />

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

      <LpFamilyShowcase
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
        <Button href="https://github.com/biliboss/my-kanban">Acompanhar a construção <Arrow /></Button>
      </section>

      <LpFooter
        brand="my-kanban"
        mark={<Mark slug="my-kanban" />}
        tagline="A coluna é uma pergunta, não uma gaveta."
        links={[...familyLinks("my-kanban"), { label: "Código", href: "https://github.com/biliboss/my-kanban" }]}
      />
    </Page>
  );
}

export default App;
