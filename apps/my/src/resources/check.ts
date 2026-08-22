#!/usr/bin/env bun
//! Alguma página cita um recurso que não existe?
//!
//!   my resources check
//!   my resources check --json | --jsonl | --tsv
//!
//!   --json → { recursos:int · mencoes:int · findings:[{path,says}] }
//!
//! É o check de podridão que o antigo `my check references` carregava, generalizado: a
//! citação desta casa diz o NOME e nunca o caminho, e é isso que deixa um workflow citar
//! a página de outro. Nome que não resolve quebrou a citação no dia em que alguém
//! renomeou o arquivo — e quebra em silêncio, porque o texto continua lendo bem.
//!
//! O QUE CONTA COMO MENÇÃO: `my references <nome>`, `my resources <nome>` e
//! `my meta resources <nome>` fora de bloco de código. Fence é EXEMPLO da sintaxe, não
//! travessia: a própria `010_references.md` ensina o comando num ```bash, e sem a guarda
//! o documento que define a regra apareceria violando a regra.
//!
//! O ASSUNTO conta junto do nome: `my resources mkt_funnel` pede a pasta inteira, e
//! tratá-lo como nome quebrado seria o check acusando a própria gramática.
//!
//! ACHADO DE HOJE: 1, em `rules/retrieval/lookup_log.md` — a página que ENSINA como é
//! uma busca que falha, citando `my meta resources push` em prosa pra mostrar o erro. É
//! achado de verdade pela régua (o nome não resolve) e o conserto é do DOCUMENTO: pôr a
//! linha num fence, como a `010_references.md` já faz. Não se conserta aqui — um check
//! que aprende a ignorar o próprio exemplo é um check que aprende a ignorar.
//!
//! PELA FORMA, não por registro: `check(): Finding[]` é o que `house.check()` procura
//! varrendo `src/`, então este sistema passou a ser coberto por EXISTIR. Lista de
//! inscrição é a regra que ninguém cumpre e nada verifica — @CLAUDE.md já enterrou uma.
//!
//! depends_on: src/resources/store.ts · src/shared/findings.ts
//! impacts:    src/shared/house.ts

import type { Finding } from "@my/interfaces/resources.ts";
import { emit } from "@my/shared/findings";
import { index, store } from "./store.ts";

export function check(): Finding[] {
	return store.check();
}

export function main(argv: string[]): number {
	const found = check();
	return emit(argv, {
		json: { recursos: index().length, mencoes: index().reduce((n, r) => n + r.mentions.length, 0) },
		findings: found,
		cols: (f) => [f.path, f.says],
		human: () => {
			for (const f of found) console.log(`${f.path}: error · ${f.says}`);
			console.log(`${index().length} recursos · ${found.length} menção(ões) pro vazio`);
		},
	});
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
