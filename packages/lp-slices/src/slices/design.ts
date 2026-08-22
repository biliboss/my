//! A porta do designer — e a única das quatro que não tem produto atrás.
//!
//! A cena de design NÃO EXISTE (`packages/scene-design/`, tarefa H8 da nota de
//! 21/08). Publicar uma porta que promete tela seria mock passando por pronto,
//! então esta página diz na primeira dobra o que ainda não existe, e o CTA pede
//! a informação que falta pra construir: o que a SUA tela precisa provar.
//!
//! A falha que evita: a página vender uma cena que, aberta, é uma pasta vazia.
//!
//! depends_on: packages/lp-slices/src/slice.ts
//! impacts:    apps/lp/app/design/page.tsx

import { SITE, type Slice } from "../slice";

export const slice: Slice = {
	route: "design",
	audience: "designer cujas telas moram no Figma e não aparecem em lugar nenhum do repositório",
	door: "a tela no Figma",
	pain: "a tela existe no Figma. O código não sabe que ela existe.",
	title: "A tela está no Figma. O repositório nunca soube disso.",
	description:
		"Isto ainda não é produto: a cena de design não foi construída. O que existe é o material bruto — dezesseis pastas de shot em disco — e a decisão de não publicar tela antes de ter tela.",
	cta: {
		label: "Dizer o que a sua tela precisa provar",
		href: "https://github.com/biliboss/my/issues/new?labels=scene-design",
	},
	og: {
		image: `${SITE}/og.png`,
		imageAlt: "Uma pasta de shots de tela ao lado de um repositório que não os referencia",
	},
};
