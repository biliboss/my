//! Config do `drizzle-kit` — só existe pra gerar o SQL de migração.
//!
//!     bun drizzle-kit generate     # schema mudou? gera o próximo passo em drizzle/
//!
//! Aplicar NÃO é trabalho daqui: @src/shared/db.ts migra na abertura do banco, pra
//! não existir um comando que alguém precise lembrar de rodar.
//!
//! O `dbCredentials.url` é um caminho de DESENVOLVIMENTO: o banco de verdade mora
//! em `~/.me/me.db` e o kit nunca precisa dele — gerar migração lê o schema, não o
//! banco.
//!
//! depends_on: src/shared/schema.ts
//! impacts:    drizzle/

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/shared/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: "file:./.me.dev.db" },
});
