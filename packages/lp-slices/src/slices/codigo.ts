//! A porta de quem herdou um repositório e não sabe o que quebra ao mexer.
//!
//! Existe com um LIMITE ESCRITO na própria página, e isso não é modéstia: o
//! extrator de hoje lê os contratos declarados (`packages/interfaces/*.ts`) e as
//! linhas `//! depends_on:`, não o `import` de todo arquivo. A nota de 21/08
//! chama isso de "porta que mentiria": ou o extrator cresce, ou a frase muda.
//! Aqui a frase mudou, e o que ele NÃO faz está na dobra da letra miúda.
//!
//! A falha que evita: prometer "lemos o seu código" e entregar um grafo de
//! quatro nós declarados à mão.
//!
//! depends_on: packages/lp-slices/src/slice.ts
//! impacts:    apps/lp/app/codigo/page.tsx

import { SITE, type Slice } from "../slice";

export const slice: Slice = {
	route: "codigo",
	audience: "quem abriu um repositório que não escreveu e precisa mexer nele hoje",
	door: "o código herdado",
	pain: "você abre o arquivo e não sabe quem depende dele.",
	title: "Você abre o arquivo. E não sabe quem depende dele.",
	description:
		"Um grafo em que a aresta lida do código é sólida e a declarada num comentário é tracejada. As duas juntas num diagrama só é o que faz um desenho de arquitetura mentir.",
	cta: {
		label: "Ver o extrator, e o que ele ainda não lê",
		href: "https://github.com/biliboss/my/tree/main/apps/my-graph",
	},
	og: {
		image: `${SITE}/og.png`,
		imageAlt: "Um grafo com uma aresta sólida e uma tracejada saindo do mesmo nó",
	},
};
