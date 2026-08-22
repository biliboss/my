#!/usr/bin/env bun
//! Toma um pedido — vira card na coluna de intake (`backlog/`), e acorda ninguém.
//!
//!     my kanban capture my-teams-v1 "fix up the cockpit" "o corpo do pedido, verbatim"
//!
//! O que era `my inbox capture`, com o board escolhido em vez da inbox da casa.
//! HERDA a recusa de `my kanban add`: sem sprint ABERTA no board, não nasce card —
//! nenhuma task nesta casa nasce fora de uma sprint, capturada ou não. A mensagem
//! de erro ensina o próximo passo (`my sprints new`).
//!
//! depends_on: src/kanban/model.ts
//! impacts:    —

import { capture } from "./model.ts";

export function main(argv: string[]): number {
	const [board, title, ...resto] = argv;
	const body = resto.join(" ");
	if (!board || !title || !body) return console.error('uso: my kanban capture <board> "<título>" "<pedido>"'), 1;
	try {
		const c = capture(board, title, body);
		console.log(`${c.board}#${c.task}  (${c.column}/)`);
		return 0;
	} catch (e) {
		return console.error((e as Error).message), 1;
	}
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
