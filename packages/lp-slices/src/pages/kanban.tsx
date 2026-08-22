"use client";

//! A PORTA DO BOARD. Quem chega aqui não procurou "sistema pessoal": procurou
//! por que a coluna Doing tem onze cards e a reunião de amanhã é ele lendo card
//! por card.
//!
//! A falha que evita: falar da ferramenta antes da dor. As três dobras são o
//! board dele (`#dor`), o que muda (`#resposta`) e o que ISTO NÃO FAZ
//! (`#limite`) — e a última existe porque board é assunto onde promessa vazia
//! se detecta em cinco minutos de uso.
//!
//! depends_on: packages/lp-slices/src/Chrome.tsx · packages/lp-slices/src/slices/kanban.ts
//! impacts:    apps/lp/app/kanban/page.tsx

import { Arrow, Button, Caveat, Compare, Kicker, LpHero, LpTicker, Section, SplitHeading } from "@biliboss/my-ui";
import { Chrome } from "../Chrome";
import { BoardStory } from "../BoardStory";
import { slice } from "../slices/kanban";

export function KanbanSlice() {
	return (
		<Chrome
			slice={slice}
			closingTitle={
				<>
					Leve a lista do que está torto,
					<br />
					não o print do quadro.
				</>
			}
			closing="O check é um arquivo. Você lê antes de rodar, e decide se a régua é a sua."
		>
			<LpHero
				eyebrow={<>para quem responde por prazo num board</>}
				title={
					<>
						Seu board diz onde o card está.
						<br />
						<em>Não diz se ele anda.</em>
					</>
				}
				line={<>Coluna não é prova.</>}
				actions={
					<>
						<Button href={slice.cta.href}>
							{slice.cta.label} <Arrow />
						</Button>
						<Button href="#dor" variant="secondary">
							Ver o que ele esconde <Arrow down />
						</Button>
					</>
				}
				proof={["A coluna é uma query", "O limite reprova, não avisa", "Card sem trabalho no disco aparece"]}
			>
				Onze cards em <strong>Doing</strong>, uma label que ninguém declarou, e um card cuja pasta sumiu do
				disco há duas semanas. O quadro continua bonito — e a reunião continua sendo você lendo card por card.
			</LpHero>

			<LpTicker items={["A COLUNA É UMA QUERY", "O LIMITE É UM PORTÃO", "UM CARD SEM TRABALHO É UM ACHADO"]} />

			<Section id="dor" className="shell section">
				<Kicker>01 / o que o quadro não mostra</Kicker>
				<SplitHeading
					title={
						<>
							O board guarda posição.
							<br />
							Você precisa de fluxo.
						</>
					}
				>
					Mover um card para a direita não é evidência de nada. É por isso que a pergunta “isso vai entregar
					sexta?” continua sendo respondida de cabeça.
				</SplitHeading>
				<div className="comparison-grid">
					<Compare
						label="HOJE"
						title="Você lê o quadro"
						points={[
							"Doing acima do limite, e ninguém contou",
							"Duas labels do mesmo grupo no mesmo card",
							"Card cujo trabalho sumiu do disco",
							"A coluna sumiu depois de renomear o campo",
						]}
					/>
					<Compare
						accent
						label="COM O CHECK"
						title="O quadro é lido por você"
						points={[
							"Uma linha por achado, com o card e a causa",
							"Sai 1 quando há achado — dá pra pôr no CI",
							"Fala TSV, JSONL e JSON, além do humano",
							"Roda contra o disco; o GitHub só quando você pede",
						]}
					/>
				</div>
			</Section>

			<Section id="resposta" className="shell section">
				<Kicker>02 / o que muda na segunda-feira</Kicker>
				<SplitHeading
					title={
						<>
							Um comando responde
							<br />
							o que a reunião perguntava.
						</>
					}
				>
					Você não troca de ferramenta. O board continua onde está — o que entra é uma régua que qualquer
					pessoa do time consegue ler antes de aceitar.
				</SplitHeading>
				<ol className="steps">
					<li className="step">
						<span>01</span>
						<h3>Declare o limite da coluna</h3>
						<p>Um número por coluna. Sem ele, “Doing” aceita o time inteiro e ninguém percebe.</p>
					</li>
					<li className="step">
						<span>02</span>
						<h3>Rode o check antes da daily</h3>
						<p>Ele devolve a lista do que está torto, com o card e a causa. Nada de dashboard.</p>
					</li>
					<li className="step">
						<span>03</span>
						<h3>Leve os achados, não o print</h3>
						<p>A conversa deixa de ser sobre o quadro e passa a ser sobre os quatro cards que travaram.</p>
					</li>
				</ol>
			</Section>

			<Section id="prova" className="shell section">
				<Kicker>03 / os mesmos cards, quatro perguntas</Kicker>
				<SplitHeading
					title={
						<>
							A coluna é uma pergunta.
							<br />
							Não uma gaveta.
						</>
					}
				>
					Role: nenhum card muda de dono ou de estado. O que muda é o eixo pelo qual você olha, e o mesmo
					card reaparece embaixo de outra coluna.
				</SplitHeading>
			</Section>

			<BoardStory />

			<Section id="limite" className="shell section">
				<Kicker>04 / o que isto não faz</Kicker>
				<Caveat label="LEIA ANTES DE ADOTAR">
					O check lê o board do GitHub Projects v2 e o trabalho em disco. Ele não estima, não prevê data e
					não fala com Jira, Trello ou Linear. E cada leitura do board remoto custa 1 ponto do orçamento da
					API do GitHub — por isso ela é opcional, e não roda sozinha num timer.
				</Caveat>
			</Section>
		</Chrome>
	);
}
