//! A CASCA de todo o site: o `<html>`, as três folhas de estilo, e nada mais.
//!
//! A ORDEM DOS IMPORTS É A CASCATA, e trocá-la é como o botão da família perde
//! a cor: primeiro o HeroUI (a base de componente, em `@layer`), depois os
//! tokens do my-ui (sem camada, então ganham do HeroUI por construção), e por
//! último o que só estas cinco portas usam.
//!
//! Nenhum `metadata` de conteúdo mora aqui de propósito: título, descrição,
//! canonical e og são POR ROTA — uma porta que herdasse a frase do layout seria
//! exatamente a rota genérica que a busca trata como duplicata.
//!
//! depends_on: packages/my-ui/src/tokens.css · apps/lp/app/lp.css
//! impacts:    apps/lp/app/

import type { Metadata } from "next";
import "./heroui.css";
import "@my/my-ui/tokens.css";
import "./lp.css";

/** Só o que NÃO é conteúdo: o nome do site nos cards, e o viewport. */
export const metadata: Metadata = {
	applicationName: "my",
	authors: [{ name: "Gabriel", url: "https://github.com/biliboss" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="pt-BR">
			<body>{children}</body>
		</html>
	);
}
