#!/usr/bin/env bun
//! Abre um board novo — uma pasta em `01_projects/`, com `tasks/` e `.kanban/` vazios.
//!
//!     my kanban open my-teams-v1
//!
//! SEM `--resultado`/`--área`/`--prazo`: o contrato do kanban diz que aquilo era
//! carga de CONTAINER, e um board não é container — é onde o trabalho já existente
//! se mostra. Se aquele resultado ainda vale, ele volta como um CARD com label e
//! prazo, nunca como campo do board.
//!
//! `my projects check` vai listar este board como torto (`missing_context`) até
//! alguém escrever um `CONTEXT.md` — e está certo em listar: aquele check é de
//! `projects`, que continua rodando, e não foi ensinado a parar de cobrar de um
//! board o que só um projeto antigo devia.
//!
//! depends_on: src/kanban/model.ts
//! impacts:    —

import { open } from "./model.ts";

export function main(argv: string[]): number {
	const [name] = argv;
	if (!name) return console.error("uso: my kanban open <nome>"), 1;
	try {
		const b = open({ name });
		console.log(`01_projects/${b.name}/`);
		console.log(`colunas: ${b.columns.join(" · ")}`);
		console.log(`primeiro card: my kanban capture ${b.name} "<título>" "<pedido>"`);
		return 0;
	} catch (e) {
		return console.error((e as Error).message), 1;
	}
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
