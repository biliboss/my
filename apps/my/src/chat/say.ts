#!/usr/bin/env bun
//! Fala num canal — `Chat.say` do contrato (@packages/interfaces/chat.ts). Absorve
//! `ask.ts` inteiro: `--ask` bloqueia esperando a resposta, no mesmo verbo que
//! manda, em vez de um verbo à parte pra uma flag.
//!
//!     my chat say plantao-coding qa-workflow "afira a #179, mesmo contrato"
//!     my chat say plantao-coding all "build quebrou" --thread 022_my_teams
//!     my chat say plantao-coding qa-workflow "a #179 já foi?" --ask
//!     my chat say plantao-coding gabriel "sim, pode mergear" --re 42
//!     echo "texto longo" | my chat say plantao-coding gabriel -
//!
//! `from` NUNCA é argumento — sai de `MY_AGENT`, e cai pra `gabriel` quando não
//! existe, porque quem digita na sessão principal é ele (mesma regra do
//! `src/agents/send.ts` que este arquivo substitui).
//!
//! `--re <valor>` resolve pra `answers`: numérico vira o `seq` respondido, direto.
//! NÃO-numérico nunca inventa um `seq` — mesma disciplina que `store.ts` já toma
//! com `channel: ""` — e cai pra `thread` como texto puro, quando `--thread` não
//! foi dado (é o caso do `re` de `_today`, uma string tipo
//! `pm@2026-08-21T13:20:30Z`, sem `seq` nenhum pra resolver contra).
//!
//! depends_on: src/chat/store.ts
//! impacts:    src/agents/send.ts
//!
//! O domínio mora em `@my/chat`; aqui fica só o que a CLI imprime.

import * as chat from "@my/chat";
const { say, ask, read, inbox, unanswered, seen, listen, check, allMessages, listChannels, registerChannel, show, busPath, now, whoAmI } = chat as any;

export async function main(argv: string[]): Promise<number> {
	const rest0 = [...argv];
	const askFlag = rest0.includes("--ask");
	if (askFlag) rest0.splice(rest0.indexOf("--ask"), 1);

	const [channel, to, ...rest] = rest0;
	if (!channel || !to || rest.length === 0) {
		console.error('usage: say <canal> <para> "<texto>" [--thread <id>] [--re <seq|texto>] [--ask]   (- lê do stdin)');
		return 2;
	}
	const i = rest.indexOf("--thread");
	let thread = i > -1 ? rest.splice(i, 2)[1] : undefined;
	const j = rest.indexOf("--re");
	let answers: number | undefined;
	if (j > -1) {
		const value = rest.splice(j, 2)[1]!;
		const resolved = resolveRe(value, thread);
		thread = resolved.thread ?? thread;
		answers = resolved.answers;
	}
	const text = rest[0] === "-" ? await Bun.stdin.text() : rest.join(" ");

	if (askFlag) {
		const reply = await ask(channel, to, text, thread);
		console.log(`#${reply.seq}  ${reply.from}: ${reply.text}`);
		return 0;
	}
	const m = say(channel, to, text, thread, answers);
	console.log(`#${m.seq} → ${to}`);
	return 0;
}

if (import.meta.main) process.exitCode = await main(Bun.argv.slice(2));

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
