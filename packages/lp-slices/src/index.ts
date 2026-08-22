//! @biliboss/lp-slices — a composição de cada porta de `apps/lp`.
//!
//! O pacote existe pra separar DUAS coisas que o `apps/lp` misturaria: a base
//! roteia e a fatia compõe. Enquanto cada porta era um app Vite inteiro, abrir
//! uma quinta custava um repositório, um `pages.yml` e um segredo; aqui custa
//! um arquivo de declaração, uma composição e uma pasta de rota.
//!
//! NADA DE SEÇÃO NOVA AQUI DENTRO. As dobras (`LpHero`, `LpTicker`, `Compare`,
//! `Caveat`, `LpFinalCta`…) são do `@biliboss/my-ui`, e é lá que elas devem
//! nascer — uma seção escrita neste pacote é uma seção que a próxima landing da
//! família não vai achar.
//!
//! depends_on: packages/my-ui/src/index.ts
//! impacts:    apps/lp/app/ · apps/my/src/lp/check.ts

export { Chrome } from "./Chrome";
export * from "./slices/index";
export * from "./pages/index";
