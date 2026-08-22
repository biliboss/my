//! A porta de quem toca um board todo dia.
//!
//! Existe porque o profissional de Kanban não procura "sistema pessoal": ele
//! procura por que a coluna Doing tem onze cards. Uma página que fala do `my`
//! inteiro não responde isso, e ele fecha.
//!
//! A falha que evita: vender a ferramenta como assunto. O assunto é o board
//! dele; a ferramenta entra como resposta, no fim.
//!
//! depends_on: packages/lp-slices/src/slice.ts
//! impacts:    apps/lp/app/kanban/page.tsx

import { SITE, type Slice } from "../slice";

export const slice: Slice = {
	route: "kanban",
	audience: "quem move card num board todo dia — e responde por prazo",
	door: "o board",
	pain: "o board diz onde cada card está. Não diz se o trabalho anda.",
	title: "Seu board diz onde o card está. Não diz se ele anda.",
	description:
		"Coluna acima do limite, label que ninguém declarou, card cujo trabalho sumiu do disco. Um comando lê o seu board e devolve a lista do que está torto.",
	cta: {
		label: "Ler o check que reprova um board",
		href: "https://github.com/biliboss/my/blob/main/apps/my/src/kanban/check.ts",
	},
	og: {
		image: `${SITE}/og.png`,
		imageAlt: "Um board com a coluna Doing acima do limite, e a linha do check que acusa isso",
	},
};
