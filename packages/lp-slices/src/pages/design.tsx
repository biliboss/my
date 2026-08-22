"use client";

//! A PORTA DO DESIGNER — e a única das quatro sem produto atrás.
//!
//! `packages/scene-design/` não existe (tarefa H8 da nota de 21/08). Uma porta
//! que prometesse tela seria mock passando por pronto, e o custo disso não é a
//! página: é a primeira pessoa que clica, não acha nada, e nunca mais volta.
//!
//! Então esta rota inverte a ordem: a primeira dobra diz o que ainda não
//! existe, e o CTA pede o dado que falta pra construir. Ela sai daqui no dia em
//! que a cena existir, e o `#limite` é a linha que precisa mudar.
//!
//! depends_on: packages/lp-slices/src/Chrome.tsx · packages/lp-slices/src/slices/design.ts
//! impacts:    apps/lp/app/design/page.tsx

import { Arrow, Button, Caveat, Compare, Kicker, LpHero, LpTicker, Section, SplitHeading } from "@biliboss/my-ui";
import { Chrome } from "../Chrome";
import { slice } from "../slices/design";

export function DesignSlice() {
	return (
		<Chrome
			slice={slice}
			closingTitle={
				<>
					Ainda dá tempo
					<br />
					de isto nascer torto do seu jeito.
				</>
			}
			closing="A cena não foi construída. Se você disser o que a sua tela precisa provar, essa frase entra na decisão antes de existir código pra defender."
		>
			<LpHero
				eyebrow={<>para designer cuja tela nunca chegou no repositório</>}
				title={
					<>
						A tela está no Figma.
						<br />
						<em>O repositório nunca soube disso.</em>
					</>
				}
				line={<>E isto aqui ainda não resolve.</>}
				actions={
					<>
						<Button href={slice.cta.href}>
							{slice.cta.label} <Arrow />
						</Button>
						<Button href="#limite" variant="secondary">
							Ver o que não existe <Arrow down />
						</Button>
					</>
				}
				proof={["A cena não foi construída", "O material bruto está em disco", "A decisão ainda está aberta"]}
			>
				Você desenhou o estado vazio, o de erro e o de carregando. Três meses depois, o produto tem dois deles
				e ninguém lembra do terceiro — porque a tela vive num arquivo que o código nunca abriu.{" "}
				<strong>Esta porta não conserta isso ainda.</strong>
			</LpHero>

			<LpTicker items={["A CENA NÃO EXISTE", "O MATERIAL BRUTO EXISTE", "A DECISÃO AINDA ESTÁ ABERTA"]} />

			<Section id="dor" className="shell section">
				<Kicker>01 / onde a tela se perde</Kicker>
				<SplitHeading
					title={
						<>
							O desenho é a fonte,
							<br />
							e mora fora do sistema.
						</>
					}
				>
					Enquanto a tela só existe num arquivo de design, ninguém consegue perguntar ao repositório quais
					estados foram desenhados — e a resposta vira memória de quem estava na reunião.
				</SplitHeading>
				<div className="comparison-grid">
					<Compare
						label="HOJE"
						title="A tela mora no Figma"
						points={[
							"O código não sabe quantos estados existem",
							"O que foi cortado só sobrevive na memória",
							"Revisão de tela vira print colado no chat",
							"Quem chega depois não acha o desenho original",
						]}
					/>
					<Compare
						accent
						label="A APOSTA"
						title="A tela como evidência versionada"
						points={[
							"O shot fica no disco, junto do que ele prova",
							"Estado desenhado e estado implementado, lado a lado",
							"O que foi recusado fica escrito, com o porquê",
							"Isto ainda é aposta: nada disso roda hoje",
						]}
					/>
				</div>
			</Section>

			<Section id="resposta" className="shell section">
				<Kicker>02 / o que existe de verdade agora</Kicker>
				<SplitHeading
					title={
						<>
							Dezesseis pastas de shot,
							<br />
							e nenhuma tela pra abri-las.
						</>
					}
				>
					Este é o inventário honesto. Nenhum item abaixo é promessa: os dois primeiros estão em disco, e o
					terceiro é o que falta.
				</SplitHeading>
				<ol className="steps">
					<li className="step">
						<span>01</span>
						<h3>O material bruto</h3>
						<p>Dezesseis pastas de shot de tela, versionadas, esperando quem as leia.</p>
					</li>
					<li className="step">
						<span>02</span>
						<h3>O leitor de imagem</h3>
						<p>Já existe código que acha PNG em quatro bases e mostra a tira com metadado.</p>
					</li>
					<li className="step">
						<span>03</span>
						<h3>A cena</h3>
						<p>Não existe. É o que falta, e é por isso que esta página não tem demonstração.</p>
					</li>
				</ol>
			</Section>

			<Section id="limite" className="shell section">
				<Kicker>03 / o limite, dito primeiro</Kicker>
				<Caveat label="NÃO HÁ PRODUTO ATRÁS DESTA ROTA">
					<code>packages/scene-design/</code> não existe no repositório. Não há demonstração, não há beta e
					não há data. Esta porta está publicada porque a decisão de COMO a cena deve funcionar ainda está
					aberta — e um designer que chega antes do código é exatamente quem consegue mudá-la.
				</Caveat>
			</Section>
		</Chrome>
	);
}
