//! A ROTA `/codigo`. Ela roteia e compõe, e não decide nada.
//!
//! Tudo que uma pessoa lê nesta página mora em
//! `packages/lp-slices/src/pages/codigo.tsx`; tudo que um robô lê mora em
//! `packages/lp-slices/src/slices/codigo.ts`. A base fica com o que é do Next:
//! a pasta que vira URL, e o `metadata` derivado da declaração.
//!
//! A falha que isto evita: canonical, og e CTA digitados no arquivo da rota. Foi
//! assim que duas das quatro landings antigas ficaram com `og:url` apontando
//! pro domínio errado — quatro cópias, e ninguém releu a quarta.
//!
//! O import da composição é pelo caminho da fatia, e não pelo barril: o barril
//! arrasta as QUATRO portas pro bundle desta rota, e o Next não tem como saber
//! que três delas nunca serão renderizadas aqui.
//!
//! depends_on: packages/lp-slices/src/slices/codigo.ts · apps/lp/lib/metadata.ts
//! impacts:    —

import { codigo } from "@biliboss/lp-slices/slices";
import { CodigoSlice } from "@biliboss/lp-slices/pages/codigo";
import { metadataOf } from "../../lib/metadata";

export const metadata = metadataOf(codigo);

export default function Page() {
	return <CodigoSlice />;
}
