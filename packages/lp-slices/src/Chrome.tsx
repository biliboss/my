"use client";

//! A MOLDURA de toda porta: a barra, a família, o CTA e o rodapé. O miolo é da
//! fatia; isto aqui é igual nas quatro.
//!
//! Existe pra que o CTA da página venha da DECLARAÇÃO da fatia e de nenhum
//! outro lugar. Enquanto cada landing escrevia o próprio `LpFinalCta`, duas
//! delas terminaram apontando pro mesmo link — e `my lp check` não teria onde
//! olhar, porque o link estaria no meio do JSX.
//!
//! `"use client"` porque `LpNav` e `LpFoldNav` têm estado e teclado. A rota
//! continua pré-renderizada: o Next escreve o HTML no build, e o React só
//! reidrata o que precisa de evento.
//!
//! depends_on: packages/my-ui/src/LpNav.tsx · packages/lp-slices/src/slice.ts
//! impacts:    packages/lp-slices/src/pages/

import type { ReactNode } from "react";
import {
	familyLinks,
	LpFamilyShowcase,
	LpFinalCta,
	LpFoldNav,
	LpFooter,
	LpNav,
	Mark,
	Page,
} from "@my/my-ui";
import { href } from "./href";
import type { Slice } from "./slice";

export function Chrome({
	slice,
	/** O título da última dobra. NUNCA o mesmo do herói: quem rolou até aqui já
	 *  leu aquele, e repetir é a página dizendo que não tem mais nada. */
	closingTitle,
	/** O parágrafo de fechamento, do lado de quem lê. */
	closing,
	children,
}: {
	slice: Slice;
	closingTitle: ReactNode;
	closing: ReactNode;
	children: ReactNode;
}) {
	return (
		<Page>
			<LpFoldNav />
			<LpNav
				brand="my"
				mark={<Mark slug="my" />}
				links={[
					{ label: "A dor", href: "#dor" },
					{ label: "O que muda", href: "#resposta" },
					{ label: "O limite", href: "#limite" },
					{ label: "As portas", href: href() },
					{ label: "GitHub", href: "https://github.com/biliboss/my" },
				]}
			/>
			{children}
			<LpFamilyShowcase
				self="my"
				kicker="a mesma casa"
				title="Quatro portas, um sistema."
				lead={
					<>
						Você entrou pela sua. As outras três existem porque a dor de quem chega é sempre outra — e uma
						página que tenta falar com as quatro não fala com nenhuma.
					</>
				}
				cta={{ label: "Ver as quatro portas", href: href() }}
			/>
			<LpFinalCta kicker={slice.door.toUpperCase()} title={closingTitle} action={slice.cta}>
				{closing}
			</LpFinalCta>
			<LpFooter
				brand="my"
				mark={<Mark slug="my" />}
				tagline="Local-first personal operating system."
				links={[...familyLinks("my"), { label: "Código", href: "https://github.com/biliboss/my" }]}
			/>
		</Page>
	);
}
