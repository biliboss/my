//! O caminho de uma porta DENTRO do site publicado.
//!
//! Existe porque as seções do my-ui montam `<a href>` cru — elas nasceram em
//! quatro apps Vite servidos da raiz do próprio Pages, onde `/kanban` bastava.
//! Servidas de `biliboss.github.io/my/`, o mesmo `href` cai fora do site.
//!
//! O prefixo é DERIVADO de `SITE`, nunca digitado: `basePath` escrito à mão no
//! `next.config.ts` e a base do canonical são a mesma decisão em dois lugares,
//! e dois lugares divergem. `my lp check` compara os dois.
//!
//! depends_on: packages/lp-slices/src/slice.ts
//! impacts:    apps/lp/next.config.ts

import { SITE } from "./slice";

/** `/my` — o que o GitHub Pages põe na frente de tudo num site de projeto. */
export const BASE = new URL(SITE).pathname.replace(/\/$/, "");

/** `href("kanban")` → `/my/kanban/`. A barra no fim não é estilo: com
 *  `trailingSlash`, `/my/kanban` responde 308 e o Pages estático não redireciona
 *  — ele devolve 404. */
export const href = (route = ""): string => `${BASE}/${route ? `${route}/` : ""}`;
