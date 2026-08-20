#!/usr/bin/env bun
//! A sprint-PASTA vira as `units` que o workflow de coding consome.
//!
//!   my sprints units -P my_check_v1 --work-repo ~/src/acme-mono --base staging
//!   my sprints units 999 -P my_check_v1 --work-repo … --base …   # uma sprint só
//!
//! É a fronteira entre o DISCO e o workflow dinâmico. `.claude/workflows/cycle.js`
//! recebe `{ run, work_repo, base, units[] }` e abre uma worktree e um PR por
//! unidade; até agora esse objeto vinha do `sprints.yaml` de um run — a forma
//! ANTERIOR, de quando a sprint era uma linha em yaml. Desde 18/08 a sprint é uma
//! PASTA com as tasks dentro, e este arquivo é o que faltava pro workflow ler a
//! forma nova sem ninguém montar JSON à mão.
//!
//! **Uma sprint = uma unidade = uma worktree = um PR.** As tasks dentro dela vão em
//! SÉRIE, na ordem do NNN, e isso não é preferência: duas tasks concorrentes na
//! mesma worktree disputam o índice do git, e o commit de uma sai com o trabalho da
//! outra dentro (@02_areas/00_workflows/00_main/01_coding/references/cc_dynamic_workflow.md).
//!
//! ## Só o que está em `inprogress`
//!
//! Sem argumento ele emite as sprints em `inprogress/`, e é o que faz o comando ser
//! seguro de repetir: sprint `aberta` ainda está sendo escrita, sprint em `done/` já
//! virou PR. `my sprints move <nnn> inprogress` é o gesto que declara "esta pode
//! rodar", e ele é DELIBERADO — um workflow que varresse tudo dispararia agente pra
//! sprint que alguém estava editando.
//!
//! ## O que ele RECUSA
//!
//! Task sem `proof` não vira unidade. O contrato de código desta casa é prova antes
//! do commit (#proof_per_task), e agente sem prova declarada inventa uma — o que dá
//! commit verde sobre trabalho que ninguém verificou. Sprint acima do teto de 10 min
//! também recusa: a alavanca é PARTIR, e deixar passar aqui é o que transforma o teto
//! em decoração.
//!
//! depends_on: src/sprints/model.ts · 02_areas/00_workflows/00_main/01_coding/references/cc_dynamic_workflow.md
//! impacts:    .claude/workflows/cycle.js

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { lembra, projetoCorrente } from "../tasks/model.ts";
import { RAIZ } from "../projects/model.ts";
import { type Sprint, acharSprint, criticaDoTeto, minutos, sprints } from "./model.ts";

/** O corpo do `CONTEXT.md` da task, que vai INTEIRO pro agente.
 *
 *  O `## Why` é o que impede a task de ser executada ao pé da letra e entregar a
 *  coisa errada com a prova passando — então ele atravessa, e não um resumo dele
 *  (@03_resources/references/system/011_a_corrente.md: o que não está no arquivo não
 *  atravessa).
 *
 *  O resto (`proof`, `title`, `duration`, `references`) NÃO é parseado aqui:
 *  `readTasksDir` já faz isso, e um segundo parser do mesmo front matter foi
 *  exatamente o que escrevi primeiro — ele leu o COMENTÁRIO de `proof: |` como se
 *  fosse o comando. Um parser, um lugar. */
function corpoDaTask(dir: string): string {
	const ctx = join(RAIZ, dir, "CONTEXT.md");
	if (!existsSync(ctx)) return "";
	const texto = readFileSync(ctx, "utf8");
	const i = texto.search(/^#\s+/m);
	return i < 0 ? "" : texto.slice(i).split("\n").slice(1).join("\n").trim();
}

/** Uma sprint vira uma unidade. `id` é o NNN — é ele que nomeia o branch. */
function unidade(s: Sprint) {
	return {
		id: s.nnn,
		title: s.titulo,
		estado: s.estado,
		minutes: minutos(s),
		critica: criticaDoTeto(s),
		tasks: s.tasks.map((t) => ({ id: t.id, title: t.title, proof: t.proof, references: t.references, description: corpoDaTask(t.dir) })),
	};
}

export function command(): Command {
	return new Command("units")
		.description("a sprint-PASTA vira as `units` que o workflow de coding consome")
		.argument("[sprint]", "`999` ou `999_<slug>`. Omitido, todas as que estão em `inprogress/`")
		.option("-P, --project <slug>", "o projeto. Passado uma vez, fica lembrado")
		.option("-w, --work-repo <path>", "o repo onde o código é escrito")
		.option("-b, --base <branch>", "o branch de integração")
		.option("--force", "emite mesmo com task sem `proof` ou sprint acima do teto");
}

export function main(argv: string[]): number {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (e) {
		return (e as { exitCode?: number }).exitCode ?? 1;
	}
	const [alvo] = cmd.args;
	const o = cmd.opts();
	const morre = (m: string) => (console.error(m), 1);

	const { slug } = projetoCorrente(o.project);
	if (!slug) return morre("sem projeto corrente: passe `-P <slug>` uma vez e ele fica lembrado");
	if (o.project) lembra(slug);

	let alvos: Sprint[];
	if (alvo) {
		const s = acharSprint(slug, alvo);
		if ("erro" in s) return morre(s.erro);
		alvos = [s];
	} else {
		alvos = sprints(slug).filter((s) => s.estado === "inprogress");
		if (!alvos.length) return morre(`nenhuma sprint em \`inprogress/\`\n  declare uma: my sprints move <nnn> inprogress -P ${slug}`);
	}

	const units = alvos.map(unidade);
	// As duas recusas, e as duas antes de emitir: o workflow não valida nada — ele
	// dispara agente. Deixar passar aqui é decidir que a prova é opcional.
	const semProof = units.flatMap((u) => u.tasks.filter((t) => !t.proof).map((t) => `${u.id}/${t.id}`));
	// PLACEHOLDER não é referência, e este comando é o primeiro que consegue ver isso:
	// `- <caminho#ancora>` sai do template e sobrevive a qualquer revisão humana,
	// porque ninguém relê o front matter. O agente recebe a lista e vai LER o que está
	// nela — mandá-lo abrir `<caminho#ancora>` é mandá-lo inventar a referência.
	const placeholders = units.flatMap((u) =>
		u.tasks.filter((t) => t.references?.some((r: string) => /^<.*>$/.test(String(r)))).map((t) => `${u.id}/${t.id}`),
	);
	const acimaDoTeto = units.filter((u) => u.critica);
	if (!o.force) {
		if (semProof.length) return morre(`task sem \`proof\`: ${semProof.join(", ")}\n  #proof_per_task — agente sem prova declarada inventa uma`);
		if (placeholders.length)
			return morre(`\`references\` ainda é o placeholder do template: ${placeholders.join(", ")}\n  #anchored_references — o agente LÊ essa lista, e \`<caminho#ancora>\` manda ele inventar`);
		if (acimaDoTeto.length) return morre(acimaDoTeto.map((u) => `${u.id}: ${u.critica}`).join("\n"));
	}

	console.log(
		JSON.stringify(
			// `mode: pr` é o desfecho deste caminho: a unidade termina em PR ABERTO,
			// porque quem aprova é o `03_qa` e quem integra é gente. O outro produtor
			// de `units` (`my meta plan`) emite `merge`, e o script é o MESMO —
			// `.claude/workflows/cycle.js`, onde o modo é dado e não forma.
			{ run: `${slug}/${units.map((u) => u.id).join("+")}`, work_repo: o.workRepo, base: o.base, mode: "pr", units },
			null,
			2,
		),
	);
	return 0;
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
