"use client";

//! A PORTA DA EMPRESA TRAVADA. O piloto de IA funcionou, e parou ali: ninguém
//! consegue dizer qual etapa a IA assumiu, então ninguém assina a próxima.
//!
//! A falha que evita: prometer implantação. Não existe oferta de serviço atrás
//! desta rota — existe uma conversa, e o CTA leva pra ela. Vender entrega que
//! não está montada é o que faz a segunda reunião não acontecer.
//!
//! depends_on: packages/lp-slices/src/Chrome.tsx · packages/lp-slices/src/slices/empresa.ts
//! impacts:    apps/lp/app/empresa/page.tsx

import { Arrow, Button, Caveat, Compare, Kicker, LpHero, LpTicker, Section, SplitHeading } from "@my/my-ui";
import { Chrome } from "../Chrome";
import { GraphStory } from "../GraphStory";
import { slice } from "../slices/empresa";

export function EmpresaSlice() {
	return (
		<Chrome
			slice={slice}
			closingTitle={
				<>
					Comece pela etapa
					<br />
					que ninguém consegue aprovar.
				</>
			}
			closing="Não é uma proposta comercial. É uma conversa sobre uma etapa específica sua, em público, no repositório."
		>
			<LpHero
				eyebrow={<>para quem aprovou o piloto e travou no segundo</>}
				title={
					<>
						O piloto de IA funcionou.
						<br />
						<em>E travou aí.</em>
					</>
				}
				line={<>Ninguém sabe o que ela assumiu.</>}
				actions={
					<>
						<Button href={slice.cta.href}>
							{slice.cta.label} <Arrow />
						</Button>
						<Button href="#dor" variant="secondary">
							Ver por que trava sempre no mesmo lugar <Arrow down />
						</Button>
					</>
				}
				proof={["A etapa vira texto", "O humano é o portão", "A automação vem depois, não antes"]}
			>
				A ferramenta entrou pela ponta errada: alguém ligou um assistente, o resultado impressionou, e agora
				ninguém consegue responder <strong>que decisão ele tomou</strong>. Sem essa resposta, jurídico não
				assina, auditoria não aceita e a segunda etapa não sai.
			</LpHero>

			<LpTicker items={["ESCREVA A ETAPA", "PONHA O HUMANO NO PORTÃO", "AUTOMATIZE O QUE SOBROU"]} />

			<Section id="dor" className="shell section">
				<Kicker>01 / por que trava sempre no mesmo lugar</Kicker>
				<SplitHeading
					title={
						<>
							O piloto provou a ferramenta.
							<br />
							Ele não provou o processo.
						</>
					}
				>
					A pergunta que segura a expansão nunca é “a IA acerta?”. É “quem responde quando ela erra, e onde
					está escrito o que ela devia fazer?”.
				</SplitHeading>
				<div className="comparison-grid">
					<Compare
						label="O PILOTO"
						title="A IA entrou pela ferramenta"
						points={[
							"O prompt mora na cabeça de quem escreveu",
							"O resultado é bom, e ninguém sabe por quê",
							"Mudar o comportamento exige quem construiu",
							"O log explica depois, e só pra quem lê log",
						]}
					/>
					<Compare
						accent
						label="A ETAPA ESCRITA"
						title="A IA entra pelo processo"
						points={[
							"A etapa é um arquivo de texto que a área lê",
							"Cada passagem deixa um artefato inspecionável",
							"Mudar o comportamento é editar o texto",
							"O humano aprova antes, não audita depois",
						]}
					/>
				</div>
			</Section>

			<Section id="resposta" className="shell section">
				<Kicker>02 / a ordem que destrava</Kicker>
				<SplitHeading
					title={
						<>
							Texto primeiro.
							<br />
							Automação por último.
						</>
					}
				>
					É a ordem inversa da que quase toda empresa tenta — e é a única em que a área que responde pelo
					risco consegue dizer sim antes de a coisa rodar.
				</SplitHeading>
				<ol className="steps">
					<li className="step">
						<span>01</span>
						<h3>Escolha uma etapa que já dói</h3>
						<p>Uma só, com dono e com prazo. Etapa escolhida por ser fácil não convence ninguém depois.</p>
					</li>
					<li className="step">
						<span>02</span>
						<h3>Escreva o que ela decide, em texto</h3>
						<p>Entrada, regra, saída. Se não couber em texto que a área lê, ela não está entendida ainda.</p>
					</li>
					<li className="step">
						<span>03</span>
						<h3>Ponha o portão humano antes da próxima</h3>
						<p>Uma aprovação explícita, com nome e hora. É ela que transforma o piloto em processo.</p>
					</li>
				</ol>
			</Section>

			<Section id="prova" className="shell section">
				<Kicker>03 / a mesma empresa, em quatro passos</Kicker>
				<SplitHeading
					title={
						<>
							Role, e veja a sua empresa
							<br />
							caber numa tela.
						</>
					}
				>
					Vender o que entrega, entregar o que vendeu, ser amado pelo que entregou. O resto é variação — e a
					etapa que travou o seu piloto está em um destes três galhos.
				</SplitHeading>
			</Section>

			<GraphStory />

			<Section id="limite" className="shell section">
				<Kicker>04 / o que isto não é</Kicker>
				<Caveat label="ANTES DE MARCAR A CONVERSA">
					Não há oferta de implantação nem contrato pronto atrás deste link, e não há estudo de caso com
					número de cliente pra mostrar. O que existe é um sistema aberto, em construção à vista, e a
					disposição de olhar UMA etapa sua junto com você.
				</Caveat>
			</Section>
		</Chrome>
	);
}
