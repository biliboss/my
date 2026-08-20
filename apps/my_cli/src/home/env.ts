#!/usr/bin/env bun
//! Toda variável de ambiente que esta casa lê — declarada, com o que ela decide.
//!
//!     my home env                  a tabela
//!     my home env --set            só as que estão setadas AGORA, com o valor
//!     my home env --json | --tsv
//!
//! `Home.vars()` (@packages/interfaces/home.ts).
//!
//! POR QUE UMA TABELA ESCRITA À MÃO NÃO APODRECE AQUI: `my home check` varre o
//! fonte atrás de `process.env.X` e acusa toda leitura que não estiver nesta lista.
//! Declaração sem verificação é a regra que ninguém cumpre — foi assim que
//! `_events/` morreu (@CLAUDE.md). Com o check, esquecer de declarar sai vermelho.
//!
//! `MY_` É O PREFIXO, porque é o nome do comando. A casa tinha DOIS — `ME_DB`,
//! `ME_ROOT`, `ME_SPANS`, `ME_BY` de um lado e `MY_HOME`, `MY_AGENT`, `MY_RUN` do
//! outro — mais `WS_FILE`, `INBOX_DIR` e `ASKUSER_HOME` sem prefixo nenhum. As
//! `ME_*` continuam LIDAS porque estão exportadas em máquina; o que elas não são é
//! uma segunda família abençoada, e `deprecated` diz qual é a nova.
//!
//! `writes: true` É O CAMPO QUE IMPORTA. Ele separa "muda o que eu leio" de "aponta
//! a ESCRITA pra outro lugar", e a segunda já custou 41 linhas fora do git (20/08).
//!
//! depends_on: src/interfaces/home.ts
//! impacts:    src/home/check.ts

import type { HomeSystem } from "@biliboss/interfaces/home.ts";
import { fmtOf, out } from "../shared/gh.ts";

export type Var = HomeSystem.ValueObjects.Var & { deprecated?: string; by?: string };

/** ORDENADA POR CAMADA, não por alfabeto: as três raízes primeiro, porque são as que
 *  decidem onde tudo o mais acontece. */
export const VARS: Var[] = [
	{ name: "MY_HOME", decides: "a raiz da CASA — o que os verbos leem e escrevem", fallback: "~/src/me", writes: true },
	{ name: "MY_CODE", decides: "o checkout deste processo", fallback: "âncora `.git` pra cima", writes: false },
	{ name: "MY_MACHINE", decides: "onde mora o estado de máquina", fallback: "~/.me", writes: true },

	{ name: "MY_AGENT", decides: "quem eu sou no barramento e no crachá de claim", fallback: "gabriel", writes: false },
	{ name: "MY_RUN", decides: "o run corrente que um verbo carimba", writes: false },
	{ name: "MY_DEV_PORT", decides: "a porta do servidor de dev da extensão", fallback: "5177", writes: false },

	// ── as de fora: o ambiente que OUTRO programa publica, e que a casa só lê ──
	{ name: "HOME", decides: "o home do usuário — base de `~/src/me` e `~/.me`", writes: false },
	{ name: "HERDR_PANE_ID", decides: "em que pane eu estou; camada 2 da identidade de claim", writes: false },
	{ name: "HERDR_TAB_ID", decides: "em que aba eu estou", writes: false },
	{ name: "HERDR_WORKSPACE_ID", decides: "em que workspace eu estou", writes: false },
	{ name: "CLAUDE_CODE_SESSION_ID", decides: "a sessão; camada 1 da identidade de claim", writes: false },
	{ name: "CLAUDE_PID", decides: "o pid do harness; camada 3 da identidade", writes: false },
	{ name: "AI_AGENT", decides: "nome do agente quando o harness não é o Claude Code", writes: false },
	{ name: "CLAUDE_PROJECT_DIR", decides: "a raiz que o Claude Code publica pros hooks dele", writes: false },
	{ name: "GIT_DIR", decides: "herdado de um hook de git — `my tasks start` recusa quando existe, senão a worktree nova nasce apontando pro repo do hook", writes: false },
	{ name: "GIT_INDEX_FILE", decides: "idem `GIT_DIR`, e o par é o que prova que viemos de um hook", writes: false },
	{ name: "USER", decides: "quem assina quando não há agente", writes: false },

	// ── as que ainda não migraram de nome ──
	{ name: "ME_DB", decides: "o sqlite da máquina", fallback: "~/.me/me.db", writes: true, deprecated: "MY_MACHINE", by: "`my home store db`" },
	{ name: "ME_ROOT", decides: "a raiz que o gravador de execução carimba", writes: false, deprecated: "MY_HOME" },
	{ name: "ME_SPANS", decides: "pra onde a telemetria escreve", writes: true, deprecated: "MY_MACHINE" },
	{ name: "ME_BY", decides: "quem assina um span", writes: false, deprecated: "MY_AGENT" },
	{ name: "WS_FILE", decides: "o `.code-workspace` que `my vscode` edita", fallback: "~/src/main.code-workspace", writes: true },
	{ name: "INBOX_DIR", decides: "a pasta de inbox de um projeto", writes: true },
	{ name: "INBOX_PANE", decides: "o pane que recebe o aviso de item novo", writes: false },
	{ name: "ASKUSER_HOME", decides: "o checkout do `askuser`", fallback: "~/src/askuser", writes: false },
	{ name: "KIMI_BASE", decides: "a base da API usada por `my meta ask`", writes: false },
	{ name: "PROJETO_SELFTEST", decides: "só o autoteste de `my projects`", writes: true },
];

export const vars = (): Var[] => VARS;

export function main(argv: string[] = Bun.argv.slice(2)): number {
	const only = argv.includes("--set");
	const rows = VARS.filter((v) => !only || process.env[v.name] !== undefined).map((v) => ({
		...v,
		value: process.env[v.name],
	}));
	const fmt = fmtOf(argv);
	if (fmt !== "human") {
		out(fmt, rows, (r) => [r.name, r.writes ? "escreve" : "lê", r.fallback ?? "", r.deprecated ?? "", r.value ?? ""], (r) => JSON.stringify(r));
		return 0;
	}
	for (const r of rows) {
		const mark = r.value !== undefined ? "●" : " ";
		const w = r.writes ? "✎" : " ";
		const dep = r.deprecated ? ` · use ${r.deprecated}` : "";
		console.log(`${mark}${w} ${r.name.padEnd(24)} ${r.decides}${dep}`);
		if (r.value !== undefined) console.log(`     = ${r.value}`);
		else if (r.fallback) console.log(`     ${r.fallback}`);
	}
	console.log(`${rows.length} variáve(is) · ● setada agora · ✎ aponta ESCRITA`);
	return 0;
}

if (import.meta.main) process.exit(main());
