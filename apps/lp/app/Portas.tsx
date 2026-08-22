"use client";

//! O ÍNDICE: as quatro portas, pela DOR de cada uma. Nada mais.
//!
//! Não é uma landing e não tem CTA próprio — quem cai aqui ainda não disse quem
//! é, e a única coisa útil a fazer é deixá-lo escolher. Um CTA nesta página
//! competiria com o CTA da porta que ele vai abrir dois segundos depois, e
//! `my lp check` reprova exatamente isso.
//!
//! Mora na base e não em `lp-slices` porque é a lista de ROTAS: o índice é o
//! roteador falando, não uma fatia de público.
//!
//! depends_on: packages/lp-slices/src/slices/index.ts
//! impacts:    apps/lp/app/page.tsx

import { familyLinks, LpFoldNav, LpFooter, LpHero, LpNav, Mark, Page, Section } from "@my/my-ui";
import { href, INDEX, SLICES } from "@my/lp-slices/slices";

export function Portas() {
	return (
		<Page>
			<LpFoldNav />
			<LpNav
				brand="my"
				mark={<Mark slug="my" />}
				links={[
					...SLICES.map((s) => ({ label: s.door, href: href(s.route) })),
					{ label: "GitHub", href: "https://github.com/biliboss/my" },
				]}
			/>
			<LpHero
				eyebrow={<>cinco dores, cinco páginas</>}
				title={
					<>
						Entre pela sua dor.
						<br />
						<em>Não pela nossa lista de recursos.</em>
					</>
				}
				line={<>Cada porta fala com uma pessoa.</>}
				proof={["Uma dor por rota", "Um lugar para clicar em cada uma", "O limite escrito na própria página"]}
			>
				{INDEX.description}
			</LpHero>

			<Section id="portas" className="shell section tight">
				<div className="doors">
					{SLICES.map((s, i) => (
						<a className="door" key={s.route} href={href(s.route)}>
							<span className="door-index">{String(i + 1).padStart(2, "0")}</span>
							<span className="door-name">{s.door}</span>
							<span className="door-pain">{s.pain}</span>
							<span className="door-go">abrir ↗</span>
						</a>
					))}
				</div>
			</Section>

			<LpFooter
				brand="my"
				mark={<Mark slug="my" />}
				tagline="Local-first personal operating system."
				links={[...familyLinks("my"), { label: "Código", href: "https://github.com/biliboss/my" }]}
			/>
		</Page>
	);
}
