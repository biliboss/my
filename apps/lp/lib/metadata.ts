//! A `<head>` de uma porta, DERIVADA da declaração da fatia.
//!
//! Existe porque canonical e og escritos à mão em cada rota é como as quatro
//! landings antigas chegaram a ter `og:url` apontando pro domínio errado depois
//! de um rename de pasta — quatro arquivos, e ninguém releu o quarto.
//!
//! Aqui a rota não digita nenhuma URL: ela passa a fatia, e o canonical sai de
//! `canonicalOf()`. `my lp check` confere que o HTML publicado carrega os três
//! (canonical, og:title, og:image) e que nenhuma frase se repete entre rotas.
//!
//! depends_on: packages/lp-slices/src/slice.ts
//! impacts:    apps/lp/app/

import { canonicalOf, SITE, type Head } from "@biliboss/lp-slices/slices";
import type { Metadata } from "next";

/** O tamanho que o Slack, o WhatsApp e o X esperam. Imagem menor vira card
 *  pequeno sem aviso nenhum. */
const OG_SIZE = { width: 1200, height: 630 };

export const metadataOf = (slice: Head): Metadata => ({
	metadataBase: new URL(SITE),
	title: slice.title,
	description: slice.description,
	alternates: { canonical: canonicalOf(slice) },
	openGraph: {
		type: "website",
		siteName: "my",
		locale: "pt_BR",
		url: canonicalOf(slice),
		title: slice.title,
		description: slice.description,
		images: [{ url: slice.og.image, alt: slice.og.imageAlt, ...OG_SIZE }],
	},
	twitter: {
		card: "summary_large_image",
		title: slice.title,
		description: slice.description,
		images: [slice.og.image],
	},
});
