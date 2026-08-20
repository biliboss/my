//! Abre `~/.me/me.db` e aplica as migrações — o único lugar que sabe onde o banco
//! mora.
//!
//! `bun:sqlite` + drizzle: driver embutido no runtime, então o banco local não
//! custa dependência nativa nenhuma. O schema é @src/shared/schema.ts.
//!
//! MIGRAÇÃO NA ABERTURA, não num comando separado. Um `my … migrate` que alguém
//! precisa lembrar de rodar é um jeito de o CLI quebrar na máquina de amanhã; as
//! migrações são geradas pelo `drizzle-kit generate` e ficam versionadas em
//! `drizzle/`, então aplicar é idempotente e custa uma leitura de tabela.
//!
//! `ME_DB` sobrescreve o caminho, e é o que deixa o teste rodar contra um arquivo
//! descartável em vez do banco de verdade — mesma manha do `WS_FILE` do
//! @src/vscode/set.ts. Ele é lido A CADA CHAMADA de `db()`, nunca na carga do
//! módulo: a versão congelada apagou o banco real em 19/08, e o porquê inteiro
//! está no comentário de `dbPath()`.
//!
//! depends_on: src/shared/schema.ts
//! impacts:    src/vscode/set.ts

import { Database } from "bun:sqlite";
import { store } from "../home/paths.ts";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import * as schema from "./schema.ts";

/** A casa do estado local: `~/.me`, criada na primeira escrita.
 *
 *  LIDO A CADA CHAMADA, e nunca mais no topo do módulo — a constante congelada
 *  que morava aqui APAGOU A BARRA LATERAL DO GABRIEL em 19/08. O `bun test`
 *  compartilha o registro de módulos entre arquivos, então quem importasse
 *  `db.ts` primeiro fixava o caminho para todos: `sprints/model.test.ts` importa
 *  `tasks/model.ts` sem `ME_DB`, e o `set.test.ts` que setava `ME_DB` antes do
 *  seu próprio import chegava tarde — o módulo já existia, apontado pro banco de
 *  verdade. Aí o `db().delete(folder).run()` dele rodou no `~/.me/me.db` real e
 *  levou 17 pastas com rótulo.
 *
 *  Uma função não pode chegar tarde. */
export const dbPath = (): string => process.env.ME_DB ?? store("db");

/** Onde o `drizzle-kit generate` deixa o SQL — versionado no repo, ao lado do
 *  schema que o gerou. */
const MIGRATIONS = join(import.meta.dir, "../../drizzle");

/** POR CAMINHO, e não um singleton só: um cache global devolveria o banco do
 *  primeiro caller mesmo depois de `ME_DB` mudar, que é exatamente o bug acima
 *  reintroduzido um andar abaixo. */
const cached = new Map<string, BunSQLiteDatabase<typeof schema>>();

/** O banco, aberto uma vez por processo e já migrado.
 *
 *  `foreign_keys` é OFF por default no SQLite, e sem ele o `onDelete: "cascade"`
 *  do `folder_tag` é decoração: apagar a pasta deixaria a tag órfã, e a tag órfã
 *  reapareceria no dia em que o mesmo caminho voltasse pra barra. */
export function db(path = dbPath()): BunSQLiteDatabase<typeof schema> {
  const hit = cached.get(path);
  if (hit) return hit;
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path, { create: true });
  sqlite.exec("PRAGMA foreign_keys = ON");
  const handle = drizzle(sqlite, { schema });
  migrate(handle, { migrationsFolder: MIGRATIONS });
  cached.set(path, handle);
  return handle;
}
