//! O SCHEMA do banco local desta casa, em drizzle — a única declaração das tabelas.
//!
//! Mora em `~/.me/me.db` (abre em @src/shared/db.ts). Fora do repo de propósito: é
//! estado de UMA máquina, e versionar isso faria duas máquinas brigarem pelo mesmo
//! arquivo — que é o que o `state.yaml` da barra lateral provocava quando duas
//! sessões trocavam o foco no mesmo minuto (ele morreu com o `regen`, em 18/08).
//!
//! Drizzle e não SQL na mão porque o tipo sai do schema: `folder.$inferSelect` é a
//! linha, e uma coluna que muda de nome quebra no `tsc`, não em produção.
//!
//! depends_on: —
//! impacts:    src/shared/db.ts · src/vscode/set.ts · drizzle.config.ts

import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Uma pasta da barra lateral: o caminho relativo a `~/src`, o rótulo quando há
 *  override, e a posição.
 *
 *  `label` NULO é o caso normal, e é o que significa "use o rótulo gerado" — o que
 *  o `regen` desenha carrega dado vivo (contagem de workflow, run aberto, hora), e
 *  texto gravado aqui congela o que aquele mantém fresco.
 *
 *  `position` é inteiro esparso e não índice contíguo: mover uma pasta pro meio
 *  não deve reescrever a lista inteira, e ordem é o que se lê, nunca o que se
 *  conta. */
export const folder = sqliteTable(
  "folder",
  {
    path: text("path").primaryKey(),
    label: text("label"),
    position: integer("position").notNull(),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("folder_position").on(t.position)],
);

/** A tag de uma pasta — 0..N por pasta, e é ela que substitui "layout salvo": um
 *  layout é uma tag, então não existe lista congelada ao lado da query pra
 *  divergir dela.
 *
 *  A chave natural é o PAR, e ela é UNIQUE: tag repetida na mesma pasta é bug de
 *  origem, e o banco recusa na criação em vez de alguém deduplicar depois. */
export const folderTag = sqliteTable(
  "folder_tag",
  {
    path: text("path")
      .notNull()
      .references(() => folder.path, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => [primaryKey({ columns: [t.path, t.tag] }), index("folder_tag_tag").on(t.tag)],
);

/** O que o CLI lembra entre chamadas — `<verbo>.<chave>` → valor.
 *
 *  Chave composta e não uma tabela por verbo: o primeiro caso é UM valor (o
 *  projeto corrente do `my kanban`), e uma tabela por preferência seria a
 *  abstração nascida de um único uso. O prefixo mantém o namespace do verbo.
 *
 *  Vale só nesta máquina, e é por isso que mora aqui e não no repo: "o projeto
 *  em que eu estava" é sessão, não decisão. */
export const pref = sqliteTable("pref", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  at: text("at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

/** A barra ANTERIOR, uma linha por escrita — é o que faz `set -` existir sem
 *  código próprio: desfazer é ler a penúltima linha.
 *
 *  Guarda o JSON da lista inteira, e não um diff: a lista tem ~20 itens, então o
 *  snapshot é menor que a máquina de aplicar diff ao contrário. */
export const sidebarHistory = sqliteTable(
  "sidebar_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: text("at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    folders: text("folders", { mode: "json" }).notNull(),
  },
  (t) => [uniqueIndex("sidebar_history_at").on(t.at, t.id)],
);
