import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, Chip, Input } from "@heroui/react";
import linksJson from "./data/icm-links.json";
import bibliography from "./data/icm-bibliography.json";

type Theme = "aura" | "tokyo";
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

function Arrow({ down = false }: { down?: boolean }) {
  return <span aria-hidden="true">{down ? "↓" : "↗"}</span>;
}

function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem("my-theme") as Theme) || "aura",
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("my-theme", theme);
  }, [theme]);

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
    <main>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <nav className="nav shell" aria-label="Navegação principal">
        <a className="brand" href="#top" aria-label="my, início">
          <span className="brand-mark">m</span><span>my</span>
        </a>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
          <span /> <span />
        </button>
        <div className={`nav-links ${menuOpen ? "open" : ""}`}>
          <a href="#metodo">Método</a>
          <a href="#evidencia">Evidência</a>
          <a href="#fontes">Fontes</a>
          <a href="#familia">Família</a>
          <a href="https://github.com/biliboss/my" target="_blank" rel="noreferrer">GitHub <Arrow /></a>
        </div>
        <div className="theme-switch" aria-label="Tema visual">
          <button className={theme === "aura" ? "active" : ""} onClick={() => setTheme("aura")}>Aura</button>
          <button title="Tokyo Night" className={theme === "tokyo" ? "active" : ""} onClick={() => setTheme("tokyo")}>Tokyo</button>
        </div>
      </nav>

      <header className="hero shell" id="top">
        <div className="eyebrow"><span className="pulse" /> local-first · open source · human-in-the-loop</div>
        <h1>A IA não precisa de<br /><em>mais um framework.</em></h1>
        <p className="hero-line">Precisa saber onde está.</p>
        <p className="hero-copy">
          <strong>my</strong> transforma pastas, contratos e arquivos legíveis na arquitetura do seu sistema pessoal.
          Você vê cada etapa. A IA recebe apenas o contexto que precisa.
        </p>
        <div className="hero-actions">
          <a href="https://github.com/biliboss/my" target="_blank" rel="noreferrer">
            <Button size="lg" className="primary-cta">Acompanhar a construção <Arrow /></Button>
          </a>
          <a href="#metodo">
            <Button size="lg" variant="ghost" className="secondary-cta">Entender o método <Arrow down /></Button>
          </a>
        </div>
        <div className="hero-proof" aria-label="Princípios do produto">
          <span>Seu disco é o banco.</span>
          <span>Markdown é a interface.</span>
          <span>O humano é o portão.</span>
        </div>
      </header>

      <section className="ticker" aria-label="Resumo">
        <div>ONE STAGE, ONE JOB <b>✦</b> PLAIN TEXT AS INTERFACE <b>✦</b> EVERY OUTPUT IS AN EDIT SURFACE <b>✦</b> CONFIGURE THE FACTORY, NOT THE PRODUCT <b>✦</b></div>
      </section>

      <section className="shell section problem" id="metodo">
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

      <section className="layers-section" aria-labelledby="layers-title">
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

      <section className="shell section evidence" id="evidencia">
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

      <section className="fit-section">
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

      <section className="shell section principle">
        <div className="principle-mark">“</div>
        <blockquote>Editar a saída conserta esta rodada.<br /><em>Editar a fonte conserta todas as próximas.</em></blockquote>
        <p>O princípio mais forte do estudo também é a aposta do my: recorrência não vira remendo. Vira melhoria durável no sistema.</p>
      </section>

      <section className="shell section videos" aria-labelledby="videos-title">
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

      <section className="source-section" id="fontes">
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
            <Button variant="ghost" className="show-more" onClick={() => setExpanded(!expanded)}>
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

      <section className="fit-section" id="familia">
        <div className="shell section fit-grid">
          <div>
            <div className="section-kicker">07 / da mesma família</div>
            <h2>my é o sistema.<br />my-graph é a radiografia.</h2>
            <p className="lead">Mesma casa, mesma disciplina: texto puro como interface, cada saída é superfície de edição, o humano é o portão.</p>
            <a href="https://biliboss.github.io/my-graph/" target="_blank" rel="noreferrer" className="family-link">Conhecer o my-graph <Arrow /></a>
          </div>
          <div className="fit-columns">
            <div className="fit-column yes">
              <span>MY — O SISTEMA</span>
              <p>Sistema operacional pessoal local-first</p>
              <p>Pastas e contratos como arquitetura</p>
              <p>Cada etapa deixa um artefato legível</p>
              <p>github.com/biliboss/my</p>
            </div>
            <div className="fit-column fam">
              <span>MY-GRAPH — A RADIOGRAFIA</span>
              <p>Nasceu dentro do my e virou ferramenta própria</p>
              <p>Lê interface.ts e desenha quem depende de quem</p>
              <p>A primeira árvore desenhada foi a do próprio my</p>
              <p>biliboss.github.io/my-graph</p>
            </div>
          </div>
        </div>
      </section>

      <section className="shell final-cta">
        <span className="section-kicker">O SISTEMA COMEÇA VISÍVEL</span>
        <h2>Não terceirize sua memória<br />para uma caixa-preta.</h2>
        <p>O my está sendo aberto, parte por parte. Acompanhe o código, leia as decisões e veja o sistema nascer.</p>
        <a href="https://github.com/biliboss/my" target="_blank" rel="noreferrer">
          <Button size="lg" className="primary-cta">Ver o projeto no GitHub <Arrow /></Button>
        </a>
      </section>

      <footer className="footer shell">
        <a className="brand" href="#top"><span className="brand-mark">m</span><span>my</span></a>
        <p>Local-first personal operating system.</p>
        <div><a href="https://biliboss.github.io/my-graph/" target="_blank" rel="noreferrer">Família my-graph <Arrow /></a><a href="https://arxiv.org/html/2603.16021v2" target="_blank" rel="noreferrer">Paper ICM <Arrow /></a><a href="https://github.com/biliboss/my" target="_blank" rel="noreferrer">Código <Arrow /></a></div>
      </footer>
    </main>
  );
}

export default App;
