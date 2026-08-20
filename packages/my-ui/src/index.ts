//! @biliboss/my-ui — o que a família my compartilha.
//!
//! Importe os tokens UMA vez, no ponto de entrada da aplicação:
//!
//! ```ts
//! import "@biliboss/my-ui/tokens.css";
//! ```
//!
//! **O prefixo `Lp` marca o que é peça de LANDING PAGE** — uma dobra inteira,
//! com opinião sobre o que vai dentro. O que não tem prefixo é primitiva: serve
//! em qualquer tela, inclusive num app.
//!
//! O que NÃO mora aqui: o que só um produto usa. Um grafo tem entrada própria
//! (`@biliboss/my-ui/graph`) porque cytoscape é peer opcional, e o quadro do
//! kanban mora no my-kanban — feito COM estas primitivas.

// primitivas
export * from "./Primitives";
export * from "./Typography";
export * from "./Logos";
export * from "./I18n";

// peças de landing page
export * from "./LpNav";
export * from "./LpHero";
export * from "./LpTicker";
export * from "./LpFooter";
export * from "./LpParallax";
export * from "./LpCarousel";
export * from "./LpFamilyShowcase";
export * from "./LpFoldNav";
