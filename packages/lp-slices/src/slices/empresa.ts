//! A porta de quem decidiu usar IA dentro de casa e não saiu da prova de conceito.
//!
//! Existe porque essa pessoa não tem problema de ferramenta — tem problema de
//! processo: ninguém sabe qual etapa a IA assumiu, então ninguém consegue
//! aprovar a próxima. A dor é de governança, e a página fala disso.
//!
//! A falha que evita: prometer implantação. Aqui o convite é uma conversa, e o
//! CTA leva pra ela — não pra um formulário que ninguém lê.
//!
//! depends_on: packages/lp-slices/src/slice.ts
//! impacts:    apps/lp/app/empresa/page.tsx

import { SITE, type Slice } from "../slice";

export const slice: Slice = {
	route: "empresa",
	audience: "quem aprovou o piloto de IA e ainda não conseguiu aprovar o segundo",
	door: "a empresa travada",
	pain: "a IA entrou pela ferramenta. Ninguém consegue dizer que etapa ela assumiu.",
	title: "O piloto de IA funcionou. E travou aí.",
	description:
		"Sem saber qual etapa a IA assumiu, ninguém aprova a próxima. O caminho é o inverso: escreva a etapa em texto, ponha o humano no portão, e só então automatize o que sobrou.",
	cta: {
		label: "Abrir uma conversa sobre a sua etapa travada",
		href: "https://github.com/biliboss/my/discussions",
	},
	og: {
		image: `${SITE}/og.png`,
		imageAlt: "Uma etapa de processo escrita em texto, com o portão humano marcado antes da próxima",
	},
};
