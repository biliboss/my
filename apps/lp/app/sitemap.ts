//! O `sitemap.xml`, gerado das rotas que existem.
//!
//! Escrito à mão em `public/sitemap.xml`, ele foi o arquivo que ficou para trás
//! nas quatro landings antigas: a rota nova entrava no menu e não no sitemap, e
//! ninguém notava — sitemap desatualizado não quebra tela nenhuma.
//!
//! Derivado de `SLICES`, ele passa a estar errado só se a lista estiver errada,
//! e é justamente a lista que `my lp check` compara com o disco.
//!
//! depends_on: packages/lp-slices/src/slices/index.ts
//! impacts:    —

import { canonicalOf, INDEX, SLICES } from "@my/lp-slices/slices";
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
	return [INDEX, ...SLICES].map((head) => ({
		url: canonicalOf(head),
		changeFrequency: "monthly" as const,
		priority: head.route ? 0.8 : 1,
	}));
}
