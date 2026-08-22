//! UM BUILD, UM DESTINO. Este arquivo é o que faz `apps/lp` caber no GitHub
//! Pages exatamente onde as quatro apps Vite cabiam.
//!
//! As quatro decisões, e a falha que cada uma evita:
//!
//! - `output: "export"` — sem servidor. O Pages serve arquivo estático; um
//!   build padrão do Next produz um servidor Node que ninguém vai rodar, e o
//!   deploy sobe um `.next/` que o Pages não sabe abrir.
//! - `basePath` — o Pages de um repositório serve em `/<repo>/`. Sem isto todo
//!   link interno e todo `/_next/*` aponta pra raiz do domínio e devolve 404.
//!   O valor é `/my`, a MESMA base do `canonical` (`SITE`, em
//!   `packages/lp-slices/src/slice.ts`) — `my lp check` compara os dois, porque
//!   dois lugares com a mesma decisão divergem na primeira mudança.
//! - `trailingSlash: true` — `out/kanban/index.html` só responde em
//!   `/my/kanban/`. Sem a barra o Next geraria `out/kanban.html`, e o canonical
//!   com barra apontaria pro que não existe.
//! - `images.unoptimized` — o otimizador de imagem é um serviço; sem servidor
//!   ele não existe, e o build recusa a exportação.
//!
//! `transpilePackages`: os dois pacotes da casa são publicados como FONTE
//! TypeScript (sem passo de build próprio no caso do lp-slices), então o Next
//! precisa compilá-los junto.
//!
//! depends_on: packages/lp-slices/src/slice.ts
//! impacts:    .github/workflows/pages.yml · apps/my_cli/src/lp/check.ts

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/my",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@biliboss/lp-slices", "@biliboss/my-ui"],
};

export default nextConfig;
