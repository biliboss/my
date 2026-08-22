//! A porta de quem vai APOSTAR no método antes de apostar no produto.
//!
//! É a única das cinco cujo público não chega com uma dor de ferramenta: chega
//! com desconfiança. Leu "ICM" em algum lugar, quer a fonte, e a fonte estava
//! espalhada em 156 links num HTML que ninguém versionava.
//!
//! Ela existe como ROTA e não como dobra de outra porta porque era o conteúdo
//! que `biliboss.github.io/my/` servia até 22/08 — a raiz virou o índice das
//! portas, e sem esta rota o catálogo inteiro sairia do ar sem substituto.
//!
//! A falha que evita: publicar o número sem a letra miúda. O próprio estudo
//! separa observação de prova, e a dobra `#limite` repete essa separação em vez
//! de escolher o número que vende melhor.
//!
//! depends_on: packages/lp-slices/src/slice.ts · packages/lp-slices/src/data/
//! impacts:    apps/lp/app/metodo/page.tsx

import { SITE, type Slice } from "../slice";

export const slice: Slice = {
	route: "metodo",
	audience: "quem leu sobre o método e quer conferir a fonte antes de acreditar no sistema",
	door: "o método, e as fontes",
	pain: "você quer conferir a fonte, e ela está espalhada em cento e cinquenta links.",
	title: "Nada de “confia”. Clique e confira.",
	description:
		"O método que o sistema segue, o que o estudo mediu, e os 156 destinos catalogados — com a divergência entre o HTML e o arXiv preservada, em vez de resolvida em silêncio.",
	cta: {
		label: "Abrir o catálogo de fontes",
		href: "https://github.com/biliboss/my/tree/main/packages/lp-slices/src/data",
	},
	og: {
		image: `${SITE}/og.png`,
		imageAlt: "Uma lista de fontes numerada, cada linha com o domínio de destino visível",
	},
};
