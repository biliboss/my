#!/usr/bin/env bun
//! Os programas que esta casa NÃO ship: cada um responde `--version`, ou vira achado.
//!
//!     my tools check
//!     my tools check --json     # os achados pro jq
//!     my tools check --tsv      # programa · o que aconteceu
//!
//! É a única checagem HONESTA pra coisa de fora. Não dá pra verificar a lógica
//! deles — não é nossa, e muda sem nos avisar. O que dá pra verificar é o que o
//! chamador assume calado toda vez: que o binário existe, roda, e responde. Um
//! `gh` que sumiu do PATH aparece aqui como uma linha, e não como um stack trace
//! no meio de um ciclo.
//!
//! O my-graph não responde `--version`: ele é um servidor, e a pergunta
//! equivalente é `up()` — tem alguém escutando em `my-graph.localhost`.
//!
//! ASSÍNCRONO, e o `check()` dos outros sistemas não é. A diferença não é estilo:
//! aqui a resposta vem de um processo filho e de um socket, e não há como
//! perguntar isso sem esperar. Falha de programa de fora é EVENTO — nenhuma das
//! quatro sondas joga; todas viram `Finding`.
//!
//! depends_on: src/tools/graph.ts · src/shared/findings.ts
//! impacts:    src/interfaces/tools.ts

import { emit } from "../shared/findings.ts";
import { BASE, up } from "./graph.ts";

export type Finding = { path: string; says: string };

/** Teto pra sonda de versão. Um `--version` local é milissegundos; este número
 *  existe pra matar binário TRAVADO, não pra policiar latência — a mesma razão
 *  escrita em @src/gh/run.ts. */
const VERSION_TIMEOUT_MS = 5000;

/** Os programas de fora que esta casa chama, e o que cada um é. */
const PROGRAMS = [
	{ bin: "gh", says: "o GitHub por fora — `my gh issues`, `my gh prs`" },
	{ bin: "herdr", says: "o multiplexador onde a frota vive" },
	{ bin: "code", says: "o VS Code — a barra lateral que `my vscode set` escreve" },
];

/** A primeira linha do que o binário imprimiu, ou o motivo de não ter impresso. */
export async function version(bin: string, timeoutMs = VERSION_TIMEOUT_MS): Promise<{ ok: true; version: string } | { ok: false; error: string }> {
	try {
		const child = Bun.spawn([bin, "--version"], { stdout: "pipe", stderr: "pipe", timeout: timeoutMs });
		const [out, err] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
		await child.exited;
		if (child.exitedDueToTimeout) return { ok: false, error: `travou em \`${bin} --version\` depois de ${timeoutMs}ms` };
		if (child.exitCode !== 0) return { ok: false, error: err.trim() || `\`${bin} --version\` saiu ${child.exitCode}` };
		// Uma linha: `gh version 2.x (…)` tem duas, e a segunda é a URL de release.
		return { ok: true, version: out.trim().split("\n")[0] ?? "" };
	} catch (falha) {
		// Binário ausente cai aqui — `spawn` de um nome que não está no PATH joga.
		return { ok: false, error: falha instanceof Error ? falha.message : String(falha) };
	}
}

/** Uma sonda por programa: a linha humana (que mostra também quem PASSOU, senão
 *  ninguém sabe se o check chegou a perguntar) e o achado, quando há. */
async function probes(): Promise<{ line: string; finding?: Finding }[]> {
	const out: { line: string; finding?: Finding }[] = [];
	for (const p of PROGRAMS) {
		const r = await version(p.bin);
		out.push(
			r.ok
				? { line: `✓ ${p.bin.padEnd(10)} ${r.version}` }
				: { line: `✗ ${p.bin.padEnd(10)} ${r.error}`, finding: { path: p.bin, says: `${p.says} — ${r.error}` } },
		);
	}
	const servindo = await up();
	out.push(
		servindo
			? { line: `✓ ${"my-graph".padEnd(10)} servindo em ${BASE}` }
			: {
					line: `✗ ${"my-graph".padEnd(10)} nada escutando em ${BASE}`,
					finding: { path: BASE, says: "o viewer do grafo não está servindo — suba o Next de ~/src/my-graph em :4173" },
				},
	);
	return out;
}

/** O que apodreceu. Lista vazia é os quatro de pé. */
export async function check(): Promise<Finding[]> {
	return (await probes()).flatMap((p) => (p.finding ? [p.finding] : []));
}

export async function main(argv: string[] = Bun.argv.slice(2)): Promise<number> {
	const sondas = await probes();
	return emit(argv, {
		json: { programas: sondas.length },
		findings: sondas.flatMap((p) => (p.finding ? [p.finding] : [])),
		cols: (f) => [f.path, f.says],
		human: () => sondas.forEach((p) => console.log(p.line)),
	});
}

if (import.meta.main) process.exit(await main());
