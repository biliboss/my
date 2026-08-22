//! A DECLARAÇÃO de uma porta, como DADO PURO — sem JSX, sem React, sem my-ui.
//!
//! Existe separada da composição porque quem mais precisa dela não roda React:
//! `my lp check` importa este módulo do Bun pra reprovar rota sem canonical,
//! sem og, sem CTA, ou com CTA repetido. Se `canonical` e `cta` morassem dentro
//! do `.tsx` da porta, o check teria que fazer regex em JSX — e regex em JSX é
//! o check que passa a mentir na primeira reformatação.
//!
//! A falha que isto evita: duas portas publicadas com o mesmo CTA e a mesma
//! frase. A busca trata rota genérica como duplicata, e aí as duas somem juntas.
//!
//! depends_on: —
//! impacts:    apps/my_cli/src/lp/check.ts · apps/lp/lib/metadata.ts

/** O domínio ÚNICO da família. Uma porta é uma ROTA aqui dentro, nunca um
 *  domínio novo — o motivo escrito está em `_today/002_um_projeto_dois_apps.md`:
 *  domínio próprio só com parceria ou anúncio. */
export const SITE = "https://biliboss.github.io/my";

/** O que uma rota põe na `<head>`. Toda rota publicada tem isto, inclusive o
 *  índice — que não é fatia de público e por isso não tem CTA. */
export type Head = {
	/** O segmento da URL, e o nome da pasta em `apps/lp/app/`. Vazio é o índice. */
	route: string;
	/** O `<title>` e o `og:title`. Único entre as rotas. */
	title: string;
	/** A `<meta name="description">` e o `og:description`. Único entre as rotas. */
	description: string;
	og: {
		/** Absoluta, e sob `SITE`: Slack e WhatsApp não resolvem caminho relativo. */
		image: string;
		imageAlt: string;
	};
};

/** O único lugar pra clicar numa porta. Duas portas com o mesmo `href` são a
 *  mesma porta escrita duas vezes, e `my lp check` reprova. */
export type Cta = { label: string; href: string };

/** Uma FATIA DE PÚBLICO: uma rota com um público, uma dor e um CTA. */
export type Slice = Head & {
	/** A frase que ESTE público diria de si mesmo. Nunca o nome do repo. */
	audience: string;
	/** Duas ou três palavras pro link nas outras portas — a porta pelo nome que
	 *  o público dá, nunca pelo nome do repo. */
	door: string;
	/** A dor, do lado de quem sente. Uma frase, no presente. */
	pain: string;
	cta: Cta;
};

/** A URL canônica de uma rota. UMA função, e não um campo digitado em cada
 *  fatia: canonical escrito à mão foi como duas das quatro landings antigas
 *  ficaram apontando pro domínio errado depois de um rename de pasta. */
export const canonicalOf = (head: Head): string => `${SITE}/${head.route ? `${head.route}/` : ""}`;

/** O ÍNDICE — a única rota sem público e sem CTA.
 *
 *  Ela existe porque `biliboss.github.io/my/` precisa responder alguma coisa, e
 *  NÃO pode ser a página que explica tudo: quem chega pela dor certa já está
 *  numa porta. Então o índice é uma escolha de porta e mais nada — sem CTA
 *  próprio, que competiria com o CTA da porta que a pessoa vai abrir a seguir.
 *  `my lp check` reprova um CTA aqui. */
export const INDEX: Head = {
	route: "",
	title: "Cinco portas. Entre pela sua dor.",
	description:
		"Um board que não prova fluxo, um piloto de IA que travou, um repositório herdado, uma tela que só existe no Figma, um método que você quer conferir. Cinco dores, cinco páginas, um sistema.",
	og: {
		image: `${SITE}/og.png`,
		imageAlt: "As cinco portas do my, cada uma nomeada pela dor de quem entra",
	},
};
