"use client";

//! A PORTA DO CÉTICO. Ela é a única das cinco que não vende ferramenta: vende a
//! possibilidade de conferir.
//!
//! O miolo veio do site que `biliboss.github.io/my/` servia até 22/08 — o
//! catálogo de fontes com busca, os quatro números do estudo e a nota de
//! integridade. A raiz virou o índice das portas, e sem esta rota o catálogo
//! inteiro sairia do ar sem substituto: são 156 destinos que nenhuma outra
//! página da família lista.
//!
//! O QUE MUDOU NA MUDANÇA: o herói. Lá ele vendia o sistema ("a IA não precisa
//! de mais um framework"), e essa é a frase do índice hoje. Aqui ele vende o
//! ato de conferir, porque quem chega nesta rota já ouviu a promessa e quer a
//! fonte.
//!
//! `"use client"` por causa da busca: o filtro roda no teclado de quem lê. A
//! rota continua pré-renderizada — o Next escreve as 156 linhas no HTML, e elas
//! estão lá com o JavaScript desligado.
//!
//! depends_on: packages/lp-slices/src/Chrome.tsx · packages/lp-slices/src/data/
//! impacts:    apps/lp/app/metodo/page.tsx

import { useMemo, useState } from "react";
import { Input } from "@heroui/react";
import { Arrow, Button, Caveat, Chip, Kicker, LpHero, LpTicker, Section, SplitHeading } from "@my/my-ui";
import { Chrome } from "../Chrome";
import { slice } from "../slices/metodo";
import linksJson from "../data/icm-links.json";
import bibliography from "../data/icm-bibliography.json";

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

/** O nome que a pessoa lê, e não a chave do JSON. Mora aqui e não no dado
 *  porque o dado é o catálogo — traduzir categoria é decisão desta página. */
const NOMES: Record<string, string> = {
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

/** Quantas linhas aparecem antes do botão. Dezoito é o que cabe numa tela sem
 *  a página virar um scroll de catálogo — o resto é um clique. */
const PRIMEIRAS = 18;

export function MetodoSlice() {
	const [busca, setBusca] = useState("");
	const [categoria, setCategoria] = useState("all");
	const [aberto, setAberto] = useState(false);

	const filtrados = useMemo(() => {
		const agulha = busca.trim().toLocaleLowerCase("pt-BR");
		return links.filter((link) => {
			const naCategoria = categoria === "all" || link.category === categoria;
			const casa = !agulha || `${link.title} ${link.url}`.toLocaleLowerCase("pt-BR").includes(agulha);
			return naCategoria && casa;
		});
	}, [categoria, busca]);

	const visiveis = aberto ? filtrados : filtrados.slice(0, PRIMEIRAS);

	return (
		<Chrome
			slice={slice}
			closingTitle={
				<>
					Leia a fonte antes
					<br />
					de acreditar no sistema.
				</>
			}
			closing="As 156 fontes e as 54 referências estão em dois arquivos JSON no repositório. Você não precisa da nossa leitura delas para fazer a sua."
		>
			<LpHero
				eyebrow={<>para quem quer conferir antes de adotar</>}
				title={
					<>
						Nada de “confia”.
						<br />
						<em>Clique e confira.</em>
					</>
				}
				line={<>A fonte estava espalhada. Agora está numa lista.</>}
				actions={
					<>
						<Button href="#resposta">
							Abrir as {links.length} fontes <Arrow down />
						</Button>
						<Button href="#dor" variant="secondary">
							Ver o que o estudo mediu <Arrow down />
						</Button>
					</>
				}
				proof={[`${links.length} destinos catalogados`, `${bibliography.length} referências preservadas`, "A divergência ficou escrita"]}
			>
				O método que este sistema segue tem um estudo atrás. O estudo tem <strong>{bibliography.length} referências</strong>, um
				repositório declarado que respondia 404, e um HTML que divergia do próprio arXiv. As três coisas estão
				aqui — nenhuma foi escolhida em silêncio.
			</LpHero>

			<LpTicker items={["EDITAR A SAÍDA CONSERTA ESTA RODADA", "EDITAR A FONTE CONSERTA TODAS AS PRÓXIMAS", "OBSERVAÇÃO NÃO É PROVA"]} />

			<Section id="dor" className="shell section">
				<Kicker>01 / o que o estudo mediu</Kicker>
				<SplitHeading
					title={
						<>
							Promissor.
							<br />
							Ainda não conclusivo.
						</>
					}
				>
					O próprio estudo separa observação de prova. Essa separação é o motivo de estes quatro números
					virem com a letra miúda colada neles, e não sozinhos numa faixa.
				</SplitHeading>
				<div className="stats-grid">
					<div className="stat-card">
						<strong>52</strong>
						<span>membros na comunidade observada</span>
					</div>
					<div className="stat-card">
						<strong>30/33</strong>
						<span>relataram intervenção em formato de U</span>
					</div>
					<div className="stat-card">
						<strong>5</strong>
						<span>princípios de design declarados</span>
					</div>
					<div className="stat-card">
						<strong>{bibliography.length}</strong>
						<span>referências no paper v2</span>
					</div>
				</div>
				<div className="layers">
					{[
						["00", "Identidade", "Onde estou?", "CLAUDE.md"],
						["01", "Roteamento", "Para onde vou?", "CONTEXT.md"],
						["02", "Contrato", "O que faço?", "stage/CONTEXT.md"],
						["03", "Referência", "Quais regras valem?", "references/"],
						["04", "Trabalho", "Com o que trabalho?", "output/"],
					].map(([numero, nome, pergunta, arquivo]) => (
						<article className="layer" key={numero}>
							<span>{numero}</span>
							<h3>{nome}</h3>
							<p>{pergunta}</p>
							<code>{arquivo}</code>
						</article>
					))}
				</div>
			</Section>

			<Section id="resposta" className="shell section">
				<Kicker>02 / integridade da fonte</Kicker>
				<SplitHeading
					title={
						<>
							{links.length} destinos.
							<br />
							Cada um com o domínio à vista.
						</>
					}
				>
					Catalogados do HTML v2 e da descoberta complementar. As {bibliography.length} referências
					bibliográficas estão preservadas no repositório, no mesmo formato.
				</SplitHeading>
				<div className="source-actions">
					<Input
						aria-label="Buscar nas fontes"
						placeholder="Buscar título, domínio ou URL…"
						value={busca}
						onChange={(evento) => setBusca(evento.target.value)}
						className="source-search"
					/>
					<div className="filter-row">
						{["all", "study", "research", "article", "code", "video"].map((item) => (
							<button
								type="button"
								key={item}
								className={categoria === item ? "active" : ""}
								onClick={() => {
									setCategoria(item);
									setAberto(false);
								}}
							>
								{NOMES[item]}
							</button>
						))}
					</div>
				</div>
				<div className="source-list">
					{visiveis.map((link, i) =>
						link.safe ? (
							<a
								href={link.url}
								target={link.url.startsWith("mailto:") ? undefined : "_blank"}
								rel="noreferrer"
								className="source-row"
								key={`${link.url}-${i}`}
							>
								<span className="source-index">{String(i + 1).padStart(2, "0")}</span>
								<span className="source-title">
									<strong>{link.title}</strong>
									<small>{link.url}</small>
								</span>
								<Chip>{NOMES[link.category] || link.category}</Chip>
								<Arrow />
							</a>
						) : (
							// O ARTEFATO EMBUTIDO fica na lista e não abre. Sumir com ele
							// esconderia que o HTML original trazia coisa que roda; deixá-lo
							// clicável seria executar o que a gente não leu.
							<div className="source-row disabled" key={`${link.url}-${i}`}>
								<span className="source-index">{String(i + 1).padStart(2, "0")}</span>
								<span className="source-title">
									<strong>{link.title}</strong>
									<small>Artefato embutido catalogado, execução bloqueada.</small>
								</span>
								<Chip>Embutido</Chip>
							</div>
						),
					)}
				</div>
				{filtrados.length > PRIMEIRAS && (
					<Button variant="secondary" className="show-more" onClick={() => setAberto(!aberto)}>
						{aberto ? "Mostrar menos" : `Abrir os ${filtrados.length} registros`}
					</Button>
				)}
				{!filtrados.length && <p className="empty">Nenhuma fonte corresponde a essa busca.</p>}
			</Section>

			<Section id="ecossistema" className="shell section">
				<Kicker>03 / a ideia já ganhou voz</Kicker>
				<SplitHeading
					title={
						<>
							Estes {videos.length} vídeos
							<br />
							não são citados pelo estudo.
						</>
					}
				>
					Foram encontrados separadamente, e por isso vêm marcados como descoberta. Misturá-los com a
					bibliografia seria inflar a contagem de referências com material que ninguém revisou.
				</SplitHeading>
				<div className="video-grid">
					{videos.map((video) => {
						const id = new URL(video.url).searchParams.get("v");
						return (
							<a className="video-card" key={video.url} href={video.url} target="_blank" rel="noreferrer">
								<div
									className="video-image"
									style={{ backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` }}
								>
									<span className="play">▶</span>
								</div>
								<div>
									<span>{video.note}</span>
									<h3>{video.title}</h3>
									<p>
										Assistir no YouTube <Arrow />
									</p>
								</div>
							</a>
						);
					})}
				</div>
			</Section>

			<Section id="limite" className="shell section">
				<Kicker>04 / o que não bate</Kicker>
				<Caveat label="MEDIDO EM 20/08/2026">
					O repositório GitHub declarado no paper respondia <strong>404</strong>. O HTML v2 também divergia da
					API do arXiv no título e no nome anterior do método. Preservamos as duas evidências e não escolhemos
					uma em silêncio — o que está catalogado acima é o que existe, com a discordância à vista. Os relatos
					do estudo são informais e autodeclarados, vindos de uma comunidade convidada: não houve comparação
					controlada com prompting monolítico, nem avaliação entre famílias de modelos.
				</Caveat>
			</Section>
		</Chrome>
	);
}
