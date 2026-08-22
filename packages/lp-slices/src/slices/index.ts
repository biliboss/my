//! AS PORTAS PUBLICADAS, em ordem de rota.
//!
//! Barril e não varredura de disco: `apps/lp` é estático e o `out/` é montado
//! no build — `readdirSync` numa rota exportada roda na máquina de build e some
//! no navegador. Quem varre o disco é `my lp check`, e é ele quem acusa arquivo
//! de fatia que ficou de fora daqui.
//!
//! depends_on: packages/lp-slices/src/slices/
//! impacts:    apps/lp/app/ · apps/my_cli/src/lp/check.ts

import type { Slice } from "../slice";
import { slice as codigoDecl } from "./codigo";
import { slice as designDecl } from "./design";
import { slice as empresaDecl } from "./empresa";
import { slice as kanbanDecl } from "./kanban";
import { slice as metodoDecl } from "./metodo";

// A SUPERFÍCIE DE DADO do pacote, num lugar só: `@biliboss/lp-slices/slices` é o
// que `my lp check` importa, e ele roda no Bun, sem React. Reexportar `SITE` e
// `canonicalOf` daqui é o que evita o check ter que conhecer a árvore interna.
export { canonicalOf, INDEX, SITE, type Cta, type Head, type Slice } from "../slice";
export { BASE, href } from "../href";

export { slice as codigo } from "./codigo";
export { slice as design } from "./design";
export { slice as empresa } from "./empresa";
export { slice as kanban } from "./kanban";
export { slice as metodo } from "./metodo";

export const SLICES: Slice[] = [codigoDecl, designDecl, empresaDecl, kanbanDecl, metodoDecl];

export const sliceOf = (route: string): Slice | undefined => SLICES.find((s) => s.route === route);
