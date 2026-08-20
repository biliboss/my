#!/usr/bin/env bun
//! Um recurso da lente HACKER, pelo nome — o texto inteiro, pronto pra colar.
//!
//!     my hacker resource                 os que existem
//!     my hacker resource surrealdb       o contexto inteiro
//!     my hacker resource surrealdb --id  só o sha, pra citar
//!     my hacker resource --json
//!
//! EXPERIMENTO (@packages/my-hacker/resource.ts): o recurso é CÓDIGO e a identidade
//! é o SHA-1 do texto. A lente hacker foi escolhida pra estrear porque é a que mais
//! apodrece — CLI, editor, harness e banco mudam por baixo, e uma página que diz
//! "medido em 20/08" com o hash do que foi medido é reconstruível; uma que diz
//! "hoje o SDK é 2.x" não.
//!
//! DESCOBERTO POR VARREDURA, nunca por lista: um `.ts` novo em `resource/` JÁ é um
//! recurso. Lista de inscrição é a regra que ninguém cumpre — foi assim que
//! `_events/` morreu (@CLAUDE.md).
//!
//! depends_on: packages/my-hacker/resource.ts
//! impacts:    —

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { type Resource, short } from "../../packages/my-hacker/resource.ts";
import { fmtOf, out } from "../shared/gh.ts";
import { has } from "../shared/argv.ts";

const DIR = join(import.meta.dir, "../../packages/my-hacker/resource");

/** Todo recurso da pasta. O módulo exporta UM `Resource` e o nome do arquivo não
 *  decide nada — quem decide é o campo `name`, porque a identidade aqui é o valor. */
export async function all(): Promise<Resource[]> {
  const out: Resource[] = [];
  for (const f of readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
    const mod = await import(join(DIR, f));
    for (const v of Object.values(mod)) {
      if (v && typeof v === "object" && "id" in v && "context" in v) out.push(v as Resource);
    }
  }
  return out;
}

export const find = async (name: string): Promise<Resource | undefined> =>
  (await all()).find((r) => r.name === name);

export async function main(argv: string[] = Bun.argv.slice(2)): Promise<number> {
  const nome = argv.find((a) => !a.startsWith("-"));
  const fmt = fmtOf(argv);

  if (!nome) {
    const rs = await all();
    if (fmt !== "human") {
      out(fmt, rs, (r) => [r.name, short(r), r.at, r.answers], (r) => JSON.stringify(r));
      return 0;
    }
    for (const r of rs) console.log(`${short(r)}  ${r.name.padEnd(16)} ${r.at}  ${r.answers}`);
    console.log(`${rs.length} recurso(s) · lente hacker`);
    return 0;
  }

  const r = await find(nome);
  if (!r) {
    const nomes = (await all()).map((x) => x.name).join(", ");
    console.error(`não existe: \`${nome}\`\n  existem: ${nomes || "nenhum"}`);
    return 1;
  }
  if (has("id")) return console.log(short(r)), 0;
  if (fmt === "json") return console.log(JSON.stringify(r, null, 2)), 0;
  // O CONTEXTO CRU, sem cabeçalho: o uso é colar num prompt, e tudo que a casa
  // imprime por cima vira token que o agente lê como se fosse o recurso.
  console.log(r.context);
  return 0;
}

if (import.meta.main) main().then((c) => process.exit(c));
