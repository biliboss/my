//! A PROVA VISUAL do extrator: cinco grafos reais, renderizados, com o que cada
//! um mostra escrito ao lado.
//!
//! Mora aqui e não dentro de `pages/codigo.tsx` porque o caminho da imagem
//! depende do `basePath` do Pages, e caminho de asset digitado no meio do JSX é
//! exatamente o que quebrou calado quando as landings mudaram de domínio: a
//! imagem some, o build passa, e ninguém vê até alguém abrir a página.
//!
//! Os arquivos vieram de `apps/lp_my-graph/public/shots/` em 22/08, quando as
//! quatro landings separadas foram apagadas. Eles são a única prova de tela que
//! esta família tem — o resto das cinco portas é texto.
//!
//! depends_on: packages/lp-slices/src/href.ts
//! impacts:    packages/lp-slices/src/pages/codigo.tsx · apps/lp/public/shots/

import type { LpSlide } from "@biliboss/my-ui";
import { BASE } from "./href";

export const SHOTS: LpSlide[] = [
	{
		src: `${BASE}/shots/spaghetti-shop.png`,
		kicker: "CÓDIGO RUIM",
		title: "Parece bagunçado.",
		copy: "3 ciclos, 18 arestas, cinco irmãos chamados utils, helpers, common, shared e misc. Ninguém refatora o que não consegue ver.",
	},
	{
		src: `${BASE}/shots/layered-shop.png`,
		kicker: "CÓDIGO BOM",
		title: "Parece organizado.",
		copy: "A mesma loja, em camadas. A diferença entre os dois é visível antes de ser legível — e o reports pálido confessa que ainda é rascunho.",
	},
	{
		src: `${BASE}/shots/morning-routine.png`,
		kicker: "ROTINA BAGUNÇADA",
		title: "Também dá pra mapear.",
		copy: "Vida real não tem compilador: a seta é tracejada porque é declarada, não verificada. E o celular como hub do dia inteiro aparece sem ninguém precisar dizer.",
	},
	{
		src: `${BASE}/shots/family-business.png`,
		kicker: "EMPRESA DE FAMÍLIA",
		title: "O gargalo tem nome.",
		copy: "Quando tudo passa pelo Seu Joaquim, o grafo mostra o gargalo antes da crise. O site, pálido, é o “um dia a gente faz” — rascunho assumido.",
	},
	{
		src: `${BASE}/shots/my-system.png`,
		kicker: "O SISTEMA ONDE ELE NASCEU",
		title: "A primeira árvore foi a do my.",
		copy: "O extrator nasceu dentro do my, o sistema operacional pessoal local-first: cada sistema é um círculo, cada verbo de cada interface a um clique.",
	},
];
