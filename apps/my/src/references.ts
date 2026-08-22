#!/usr/bin/env bun
//! `my references <nome>` — o APELIDO de `my resources read <nome>`. Nada mais.
//!
//!   my references git_worktree gh_pull_request
//!   my references interview            o alias do front matter resolve na mesma
//!   my references --paths askuser
//!
//! O VERBO MORREU EM 20/08; a CHAMADA não pode morrer junto. `references` nomeava um
//! KIND de recurso — `references/` é uma pasta DENTRO da loja —, então dois verbos
//! faziam uma pergunta só com dois vocabulários, e quem procurava tinha que saber qual
//! antes de procurar. A implementação inteira (índice, aliases, unicidade) foi pra
//! @src/resources/store.ts e não existe em duplicata aqui.
//!
//! O que sobrou é este arquivo de dez linhas, e ele existe por MEDIÇÃO, não por
//! gentileza: `my references <nome>` está escrito às dezenas nos documentos desta casa e
//! na skill `my`, e nenhum deles é código que um refactor alcança. Um apelido que
//! encaminha é o custo honesto disso; um segundo índice ao lado do primeiro seria o
//! dual-write que @CLAUDE.md recusa.
//!
//! depends_on: src/resources/read.ts

import { main as read } from "./resources/read.ts";

export function main(argv: string[]): number {
	return read(argv);
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
