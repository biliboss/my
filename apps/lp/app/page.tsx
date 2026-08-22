//! A ROTA `/` — o índice.
//!
//! Ela existe porque `biliboss.github.io/my/` tem que responder alguma coisa, e
//! a resposta NÃO pode ser a página que explica tudo: quem chega pela dor certa
//! já está numa porta, e quem chega por aqui só precisa escolher.
//!
//! depends_on: apps/lp/app/Portas.tsx · packages/lp-slices/src/slice.ts
//! impacts:    —

import { INDEX } from "@biliboss/lp-slices/slices";
import { Portas } from "./Portas";
import { metadataOf } from "../lib/metadata";

export const metadata = metadataOf(INDEX);

export default function Page() {
	return <Portas />;
}
