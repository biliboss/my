#!/usr/bin/env bun
//! `View.check` (@packages/interfaces/agents.ts) — SÓ o que `~/.me/agents.json` sozinho
//! consegue provar: nenhum nome lembrado aponta pro MESMO pane que outro.
//!
//!     my agents check
//!     my agents check --json | --jsonl | --tsv
//!
//! SEPARADO de `list.ts` DE PROPÓSITO, e não por gosto de arquivo pequeno: TODO
//! módulo de `src/herdr/` que este sistema toca (`agents/list.ts`, `agents/roster.ts`
//! — e por tabela `clone.ts`, que os importa) carrega um `if (import.meta.main) {
//! … await … }` no rodapé, e Bun marca como ASSÍNCRONO qualquer módulo que
//! IMPORTE ESTATICAMENTE um módulo assim — mesmo dentro de um `if` que nunca roda
//! ao ser importado. `src/shared/house.ts` descobre `agents.list.check()` com `require()`
//! SÍNCRONO; contra um módulo assim ele recebe `TypeError: require() async module
//! … is unsupported` (medido 20/08), engolido pelo `try/catch` de `checkDe` como
//! "não declara check". `list.ts` importa herdr estaticamente porque `agents.list.all()`
//! PRECISA dele; `agents.list.check()` não precisa de herdr NENHUM (só do arquivo em disco), e
//! por isso só ele podia ficar limpo o bastante pra ser achado.
//!
//! Reconciliar contra o herdr de verdade (nome que já não resolve pra pane nenhum)
//! é `roster()` — async, chama herdr — e por isso não pode ser ISTO. Ver o
//! parágrafo ASYNC AND ENVELOPED em `agents.ts`.
//!
//! depends_on: —
//! impacts:    src/shared/house.ts
//!
//! O domínio mora em `@my/agents`; aqui fica só o que a CLI imprime.

import type { Finding } from "@my/interfaces/agents.ts";

import { agents } from "@my/agents";
import { emit } from "@my/shared/findings";

export function main(argv: string[]): number {
  const achados = agents.list.check()
  return emit<Finding>(argv, {
    findings: achados,
    cols: (f) => [f.path, f.says],
    human: () => {
      for (const f of achados) console.log(`${f.path}\n  ${f.says}`)
      console.log(achados.length ? `\n${achados.length} achado(s)` : 'nada torto')
    },
  })
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
