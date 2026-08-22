#!/usr/bin/env bun
//! Fecha um card com uma resposta — o que virou, ou por que não virou nada.
//!
//!     my kanban close 999_001_slug --became "01_projects/inbox-v1/"
//!     my kanban close 999_001_slug --dropped "o herdr já faz isso, e melhor"
//!
//! `--dropped` roda `my kanban close --blocked/--dropped` por baixo (arquiva sem
//! commit). `--became` NÃO roda a prova nem commita código — é o registro leve que
//! `Inbox.process` já era; pra fechar rodando prova e commit, o verbo é
//! `my kanban close`. Um card fechado com `--became` sem ter passado por lá continua
//! aparecendo em `my kanban check` como "done sem prova" — é a mesma regra, não uma
//! segunda.
//!
//! depends_on: src/kanban/model.ts
//! impacts:    —

import { close } from "./model.ts";

export function main(argv: string[]): number {
	const [task, ...rest] = argv;
	const becameAt = rest.indexOf("--became");
	const droppedAt = rest.indexOf("--dropped");
	if (!task || (becameAt === -1 && droppedAt === -1))
		return console.error('uso: my kanban close <task> --became "<destino>" | --dropped "<porquê>"'), 1;
	try {
		const c =
			becameAt !== -1 ? close(task, { became: rest[becameAt + 1] ?? "" }) : close(task, { dropped: rest[droppedAt + 1] ?? "" });
		console.log(`${c.board}#${c.task}  (${c.column}/)`);
		return 0;
	} catch (e) {
		return console.error((e as Error).message), 1;
	}
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
