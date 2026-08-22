"use client";

//! A PORTA DE QUEM HERDOU UM REPOSITÓRIO. E a porta com o limite mais duro
//! escrito na cara: o extrator de hoje lê contratos declarados e as linhas
//! `//! depends_on:`, não o `import` de todo arquivo.
//!
//! A nota de 21/08 marca esta como uma das duas portas "que mentiriam hoje". A
//! saída escolhida foi trocar a frase, não inflar o produto — a dobra `#limite`
//! diz o que ele ainda não lê, com nome de arquivo.
//!
//! depends_on: packages/lp-slices/src/Chrome.tsx · packages/lp-slices/src/slices/codigo.ts
//! impacts:    apps/lp/app/codigo/page.tsx

import { Arrow, Button, Caveat, Compare, Kicker, LpCarousel, LpHero, LpTicker, Section, SplitHeading } from "@my/my-ui";
import { Chrome } from "../Chrome";
import { SHOTS } from "../shots";
import { slice } from "../slices/codigo";

export function CodigoSlice() {
	return (
		<Chrome
			slice={slice}
			closingTitle={
				<>
					Veja o extrator antes
					<br />
					de acreditar no desenho.
				</>
			}
			closing="São poucas centenas de linhas. Dá pra ler numa tarde e decidir se a aresta que ele desenha é a aresta em que você apostaria um refactor."
		>
			<LpHero
				eyebrow={<>para quem vai mexer hoje num código que não escreveu</>}
				title={
					<>
						Você abre o arquivo.
						<br />
						<em>E não sabe quem depende dele.</em>
					</>
				}
				line={<>O desenho da arquitetura mente.</>}
				actions={
					<>
						<Button href={slice.cta.href}>
							{slice.cta.label} <Arrow />
						</Button>
						<Button href="#dor" variant="secondary">
							Ver por que o diagrama mente <Arrow down />
						</Button>
					</>
				}
				proof={["Aresta lida do código: sólida", "Aresta declarada num comentário: tracejada", "O desenho sai do disco"]}
			>
				O diagrama do Confluence tem dois anos. O do quadro branco não existe mais. E o que está no README
				desenha três caixas onde o código tem trinta — então, na hora de mexer, você abre o arquivo e{" "}
				<strong>procura no grep</strong>.
			</LpHero>

			<LpTicker items={["SÓLIDA É LIDA DO CÓDIGO", "TRACEJADA É DECLARADA", "UM DESENHO QUE NÃO SEPARA AS DUAS MENTE"]} />

			<Section id="dor" className="shell section">
				<Kicker>01 / por que o diagrama mente</Kicker>
				<SplitHeading
					title={
						<>
							Ele trata o que alguém escreveu
							<br />
							e o que o código faz como iguais.
						</>
					}
				>
					Uma seta desenhada à mão e um <code>import</code> real têm confiança completamente diferente — e
					todo diagrama de arquitetura desenha as duas com a mesma linha.
				</SplitHeading>
				<div className="comparison-grid">
					<Compare
						label="O DIAGRAMA DE SEMPRE"
						title="Desenhado à mão, uma vez"
						points={[
							"Toda seta parece igualmente verdadeira",
							"Envelhece no primeiro refactor, em silêncio",
							"Ninguém revisa: uma imagem não tem diff",
							"Três caixas para trinta arquivos",
						]}
					/>
					<Compare
						accent
						label="LIDO DO DISCO"
						title="Duas linhas, duas confianças"
						points={[
							"Sólida: a dependência que o código declara",
							"Tracejada: a que só um comentário afirma",
							"Regerado a cada leitura, nunca guardado",
							"O estado da tela inteiro vive na URL",
						]}
					/>
				</div>
			</Section>

			<Section id="resposta" className="shell section">
				<Kicker>02 / o que você ganha na primeira leitura</Kicker>
				<SplitHeading
					title={
						<>
							Quem depende de quem,
							<br />
							sem abrir trinta arquivos.
						</>
					}
				>
					Não é documentação. É uma pergunta respondida em cima do que está no disco agora, e refeita na
					próxima vez que você perguntar.
				</SplitHeading>
				<ol className="steps">
					<li className="step">
						<span>01</span>
						<h3>Aponte para o repositório</h3>
						<p>Nada é enviado pra lugar nenhum: o extrator roda na sua máquina, sobre os seus arquivos.</p>
					</li>
					<li className="step">
						<span>02</span>
						<h3>Leia as duas linhas separadas</h3>
						<p>A sólida você pode seguir. A tracejada é uma afirmação de alguém — e é onde mora a surpresa.</p>
					</li>
					<li className="step">
						<span>03</span>
						<h3>Mande a URL para quem revisa</h3>
						<p>O estado da tela mora no hash. Colar o link é mandar exatamente a vista que você está vendo.</p>
					</li>
				</ol>
			</Section>

			<Section id="prova" className="shell section">
				<Kicker>03 / a mesma leitura, em cinco repositórios</Kicker>
				<SplitHeading
					title={
						<>
							Nenhuma delas
							<br />
							foi desenhada à mão.
						</>
					}
				>
					Cada uma saiu de um disco diferente, com a mesma leitura. O que muda de uma pra outra é o
					repositório — o traço sólido e o tracejado querem dizer a mesma coisa nas cinco.
				</SplitHeading>
				<LpCarousel slides={SHOTS} label="Cinco grafos reais renderizados pelo extrator" />
			</Section>

			<Section id="limite" className="shell section">
				<Kicker>04 / o que ele ainda NÃO lê</Kicker>
				<Caveat label="MEDIDO EM 21/08/2026, E AINDA VERDADE">
					O extrator de hoje lê os contratos declarados em <code>packages/interfaces/*.ts</code> e as linhas{" "}
					<code>{"//! depends_on:"}</code> dos arquivos. Ele <strong>não</strong> percorre o{" "}
					<code>import</code> de todo arquivo do seu projeto, e por isso o grafo é tão completo quanto a sua
					declaração — não mais. Crescer isso é trabalho conhecido e não está feito; até estar, a frase aqui
					continua sendo esta.
				</Caveat>
			</Section>
		</Chrome>
	);
}
