//! A ROTA `/metodo`. Ela roteia e compõe, e não decide nada.
//!
//! O que uma pessoa lê mora em `packages/lp-slices/src/pages/metodo.tsx`; o que
//! um robô lê mora em `packages/lp-slices/src/slices/metodo.ts`.
//!
//! Esta rota é a herdeira do que `biliboss.github.io/my/` servia até 22/08. A
//! raiz passou a ser o índice das portas, e o catálogo de fontes mudou de
//! endereço em vez de sair do ar.
//!
//! depends_on: packages/lp-slices/src/slices/metodo.ts · apps/lp/lib/metadata.ts
//! impacts:    —

import { metodo } from "@my/lp-slices/slices";
import { MetodoSlice } from "@my/lp-slices/pages/metodo";
import { metadataOf } from "../../lib/metadata";

export const metadata = metadataOf(metodo);

export default function Page() {
	return <MetodoSlice />;
}
