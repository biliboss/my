import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, Chip, Input } from "@heroui/react";
import { Arrow, Button, familyLinks, LpFamilyShowcase, LpFoldNav, LpFooter, LpHero, LpNav, LpTicker, Mark, Page } from "@biliboss/my-ui";
import linksJson from "./data/icm-links.json";
import bibliography from "./data/icm-bibliography.json";

type LinkItem = {
  title: string;
  url: string;
  category: string;
  origin: "paper" | "discovery";
  note?: string;
  safe: boolean;
};

const links = linksJson as LinkItem[];
const videos = links.filter((link) => link.category === "video");
const categoryNames: Record<string, string> = {
  all: "Tudo",
  study: "Estudo",
  research: "Pesquisa",
  article: "Sites",
  code: "Código",
  video: "Vídeos",
  sections: "Seções",
  arxiv: "arXiv",
  ecosystem: "Ecossistema",
  contact: "Contato",
  embedded: "Embutidos",
};

function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const filteredLinks = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return links.filter((link) => {
      const inCategory = category === "all" || link.category === category;
      const matches = !needle || `${link.title} ${link.url}`.toLocaleLowerCase("pt-BR").includes(needle);
      return inCategory && matches;
    });
  }, [category, query]);

  const visibleLinks = expanded ? filteredLinks : filteredLinks.slice(0, 18);

  return (
    <Page>
      <LpFoldNav />
      <LpNav
        brand="my"
        mark={<Mark slug="my" />}
        links={[
            { label: "Método", href: "#metodo" },
            { label: "Evidência", href: "#evidencia" },
            { label: "Fontes", href: "#fontes" },
            { label: "Família", href: "#familia" },
            { label: "GitHub", href: "https://github.com/biliboss/my" },
          ]}
      />

      <LpHero
        eyebrow={<> local-first · open source · human-in-the-loop</>}
        title={<>A IA não precisa de<br /><em>mais um framework.</em></>}
        line={<>Precisa saber onde está.</>}
        actions={
          <>
              <Button href="https://github.com/biliboss/my">Acompanhar a construção <Arrow /></Button>
              <Button href="#metodo" variant="secondary">Entender o método <Arrow down /></Button>
          </>
        }
        proof={["Seu disco é o banco.", "Markdown é a interface.", "O humano é o portão."]}
      >
        <strong>my</strong> transforma pastas, contratos e arquivos legíveis na arquitetura do seu sistema pessoal.
          Você vê cada etapa. A IA recebe apenas o contexto que precisa.
      </LpHero>

      <LpTicker items={["ONE STAGE, ONE JOB", "PLAIN TEXT AS INTERFACE", "EVERY OUTPUT IS AN EDIT SURFACE", "CONFIGURE THE FACTORY, NOT THE PRODUCT"]} />

      <section className="shell section problem" id="metodo" data-fold>
        <div className="section-kicker">01 / o problema real</div>
        <div className="split-heading">
          <h2>Frameworks resolvem<br />concorrência.</h2>
          <p>Mas quando o trabalho é sequencial, revisável e repetível, o preço da orquestração vira opacidade.</p>
        </div>
        <div className="comparison-grid">
          <Card className="compare-card muted-card">
            <CardContent>
              <span className="card-number">ANTES</span>
              <h3>Contexto escondido em código</h3>
              <ul>
                <li>Estado dentro do framework</li>
                <li>Handoffs difíceis de inspecionar</li>
                <li>Mudança exige desenvolvedor</li>
                <li>Logs explicam depois</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="compare-card accent-card">
            <CardContent>
              <span className="card-number">COM MY</span>
              <h3>Contexto visível no sistema</h3>
              <ul>
                <li>Estado em arquivos legíveis</li>
                <li>Cada etapa deixa um artefato</li>
                <li>Mudança acontece no texto</li>
                <li>A arquitetura já é observável</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="layers-section" aria-labelledby="layers-title" data-fold>
        <div className="shell section">
          <div className="section-kicker">02 / o mecanismo</div>
          <div className="split-heading">
            <h2 id="layers-title">Cinco camadas.<br />Uma pergunta por vez.</h2>
            <p>O paper chama isso de ICM. O filesystem roteia identidade, tarefa, contrato, regras e trabalho sem despejar tudo na janela de contexto.</p>
          </div>
          <div className="layers">
            {[
              ["00", "Identidade", "Onde estou?", "CLAUDE.md"],
              ["01", "Roteamento", "Para onde vou?", "CONTEXT.md"],
              ["02", "Contrato", "O que faço?", "stage/CONTEXT.md"],
              ["03", "Referência", "Quais regras valem?", "references/"],
              ["04", "Trabalho", "Com o que trabalho?", "output/"],
            ].map(([number, name, question, file]) => (
              <article className="layer" key={number}>
                <span>{number}</span><h3>{name}</h3><p>{question}</p><code>{file}</code>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="shell section evidence" id="evidencia" data-fold>
        <div className="section-kicker">03 / evidência, sem fantasia</div>
        <div className="split-heading">
          <h2>Promissor.<br />Ainda não conclusivo.</h2>
          <p>O próprio estudo separa observação de prova. Essa honestidade é mais vendável que um número sem contexto.</p>
        </div>
        <div className="stats-grid">
          <Card className="stat-card"><CardContent><strong>52</strong><span>membros na comunidade observada</span></CardContent></Card>
          <Card className="stat-card"><CardContent><strong>30/33</strong><span>relataram intervenção em formato de U</span></CardContent></Card>
          <Card className="stat-card"><CardContent><strong>5</strong><span>princípios de design declarados</span></CardContent></Card>
          <Card className="stat-card"><CardContent><strong>54</strong><span>referências no paper v2</span></CardContent></Card>
        </div>
        <div className="caveat">
          <span>LEIA A LETRA MIÚDA</span>
          <p>Os relatos são informais, autodeclarados e vindos de uma comunidade convidada. Não houve comparação controlada com prompting monolítico, nem avaliação entre famílias de modelos.</p>
        </div>
      </section>

      <section className="fit-section" data-fold>
        <div className="shell section fit-grid">
          <div>
            <div className="section-kicker">04 / a escolha certa</div>
            <h2>Use quando o trabalho pede julgamento.</h2>
            <p className="lead">Sequencial. Revisável. Repetível.</p>
          </div>
          <div className="fit-columns">
            <div className="fit-column yes">
              <span>FUNCIONA BEM</span>
              <p>Conteúdo e pesquisa</p><p>Materiais de treinamento</p><p>Análise de políticas</p><p>Fluxos com revisão humana</p>
            </div>
            <div className="fit-column no">
              <span>NÃO É PARA</span>
              <p>Colaboração multiagente em tempo real</p><p>Alta concorrência</p><p>Branching autônomo complexo</p><p>Infraestrutura compartilhada</p>
            </div>
          </div>
        </div>
      </section>

      <section className="shell section principle" data-fold>
        <div className="principle-mark">“</div>
        <blockquote>Editar a saída conserta esta rodada.<br /><em>Editar a fonte conserta todas as próximas.</em></blockquote>
        <p>O princípio mais forte do estudo também é a aposta do my: recorrência não vira remendo. Vira melhoria durável no sistema.</p>
      </section>

      <section className="shell section videos" aria-labelledby="videos-title" data-fold>
        <div className="section-kicker">05 / assista ao ecossistema</div>
        <div className="split-heading">
          <h2 id="videos-title">A ideia já está<br />ganhando voz.</h2>
          <p>Estes vídeos foram encontrados separadamente. Eles não são referências citadas pelo paper.</p>
        </div>
        <div className="video-grid">
          {videos.map((video) => {
            const id = new URL(video.url).searchParams.get("v");
            return (
              <a className="video-card" key={video.url} href={video.url} target="_blank" rel="noreferrer">
                <div className="video-image" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` }}>
                  <span className="play">▶</span>
                </div>
                <div><span>{video.note}</span><h3>{video.title}</h3><p>Assistir no YouTube <Arrow /></p></div>
              </a>
            );
          })}
        </div>
      </section>

      <section className="source-section" id="fontes" data-fold>
        <div className="shell section">
          <div className="section-kicker">06 / integridade da fonte</div>
          <div className="split-heading">
            <h2>Nada de “confia”.<br />Clique e confira.</h2>
            <p>{links.length} destinos catalogados do HTML v2 e da descoberta complementar. As {bibliography.length} referências bibliográficas também estão preservadas no repositório.</p>
          </div>
          <div className="source-actions">
            <Input aria-label="Buscar nas fontes" placeholder="Buscar título, domínio ou URL…" value={query} onChange={(event) => setQuery(event.target.value)} className="source-search" />
            <div className="filter-row">
              {["all", "study", "research", "article", "code", "video"].map((item) => (
                <button key={item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); setExpanded(false); }}>
                  {categoryNames[item]}
                </button>
              ))}
            </div>
          </div>
          <div className="source-list">
            {visibleLinks.map((link, index) => (
              link.safe ? (
                <a href={link.url} target={link.url.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer" className="source-row" key={`${link.url}-${index}`}>
                  <span className="source-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="source-title"><strong>{link.title}</strong><small>{link.url}</small></span>
                  <Chip size="sm" variant="soft" className="source-chip">{categoryNames[link.category] || link.category}</Chip>
                  <Arrow />
                </a>
              ) : (
                <div className="source-row disabled" key={`${link.url}-${index}`}>
                  <span className="source-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="source-title"><strong>{link.title}</strong><small>Artefato embutido catalogado, execução bloqueada.</small></span>
                  <Chip size="sm" variant="soft" className="source-chip">Embutido</Chip>
                </div>
              )
            ))}
          </div>
          {filteredLinks.length > 18 && (
            <Button variant="secondary" className="show-more" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Mostrar menos" : `Abrir os ${filteredLinks.length} registros`}
            </Button>
          )}
          {!filteredLinks.length && <p className="empty">Nenhuma fonte corresponde a essa busca.</p>}
          <div className="integrity-note">
            <strong>Nota de integridade</strong>
            <p>Em 20/08/2026, o repositório GitHub declarado no paper respondia 404. O HTML v2 também divergia da API do arXiv em título e nome anterior do método. Preservamos as duas evidências; não escolhemos uma silenciosamente.</p>
          </div>
        </div>
      </section>

      <LpFamilyShowcase
        self="my"
        kicker="07 / da mesma família"
        title="my é o sistema."
        lead={
          <>
            Mesma casa, mesma disciplina: texto puro como interface, cada saída é superfície de edição, o humano é o portão.
          </>
        }
      />

      <section className="shell final-cta" data-fold>
        <span className="section-kicker">O SISTEMA COMEÇA VISÍVEL</span>
        <h2>Não terceirize sua memória<br />para uma caixa-preta.</h2>
        <p>O my está sendo aberto, parte por parte. Acompanhe o código, leia as decisões e veja o sistema nascer.</p>
        <Button href="https://github.com/biliboss/my">Ver o projeto no GitHub <Arrow /></Button>
      </section>

      <LpFooter
        brand="my"
        mark={<Mark slug="my" />}
        tagline="Local-first personal operating system."
        links={[...familyLinks("my"), { label: "Código", href: "https://github.com/biliboss/my" }]}
      />
    </Page>
  );
}

export default App;
