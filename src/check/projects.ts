//! Quem está torto, e como — a MEDIDA agregada dos projetos.
//!
//!   my projects check                    alinhado, pro humano
//!   my projects check --project viacorretor    um projeto só
//!   my projects check --json              tudo de uma vez, pro `jq`
//!   my projects check --jsonl             uma LINHA por achado, pra filtrar
//!   my projects check --tsv               idem, pro corte com `cut`
//!   my projects check --watch --jsonl     STREAM: reemite quando o disco muda
//!
//!   --json → { projects:int · findings:[{slug,rule,problem,fix?,detail?}] }
//!            catraca: projects.findings = findings SEM `dangling_path` — é ARRAY, não número
//!
//! Era `my projects --check`, uma flag, e virou VERBO porque é o que ele sempre
//! foi: a pergunta "está torto?" não é um modo de criar projeto. E porque é a
//! FONTE — o deck do `agent-deck` reimplementava as regras em Svelte pra
//! desenhar o achado, e duas implementações de uma regra divergem na primeira
//! correção. Agora o deck consome este JSON.
//!
//! O grão muda com o formato, como manda a casa: `--jsonl`/`--tsv` saem na LINHA
//! que alguém vai filtrar (o achado), `--json` sai inteiro.
//!
//! `--watch` existe pelo mesmo motivo do poll de 4s do deck: um achado é uma
//! afirmação sobre o disco AGORA, e o objetivo de imprimir o achado é que alguém
//! conserte. Cartão acusando `viacorretor.md` depois do `git mv` é pior que
//! cartão nenhum — parece atual.
//!
//! exit 1 quando há achado, 0 quando não há — é o que faz isto servir de gate.
//! Em `--watch` não existe exit: ele fica.
//!
//! depends_on: src/projects/model.ts · src/sprints/move.ts · src/projects/rename.ts
//! impacts:    CLAUDE.md · 01_projects/_parked/agent-deck/src/ui/projects/CONTEXT.md

import { watch } from "node:fs";
import { type Finding, PROJETOS, findings, slugs } from "../projects/model.ts";

const argv = process.argv.slice(2);
const tem = (...nomes: string[]) => nomes.some((n) => argv.includes(n));
const valor = (nome: string) => {
	const i = argv.indexOf(nome);
	return i === -1 ? undefined : argv[i + 1];
};

const projeto = valor("--project") ?? valor("-P");
const json = tem("--json");
const jsonl = tem("--jsonl");
const tsv = tem("--tsv");
const observar = tem("--watch", "-w");

if (projeto && !slugs().includes(projeto)) {
	console.error(`não existe projeto \`${projeto}\` em 01_projects/`);
	process.exit(1);
}

const linhaTsv = (f: Finding) =>
	[f.slug, f.rule, f.problem, f.fix ?? "", JSON.stringify(f.detail ?? {})].join("\t");

function imprimir(achados: Finding[]) {
	if (json) {
		// o total sai junto: quem lê o JSON não deveria ter que contar pastas de novo
		console.log(
			JSON.stringify({
				projects: projeto ? 1 : slugs().length,
				findings: achados,
			}),
		);
		return;
	}
	if (jsonl) {
		for (const f of achados) console.log(JSON.stringify(f));
		return;
	}
	if (tsv) {
		for (const f of achados) console.log(linhaTsv(f));
		return;
	}

	console.log(`${projeto ? 1 : slugs().length} projetos · ${achados.length} achados`);
	for (const f of achados) console.log(`  ⚠ ${f.slug}: ${f.problem}`);
	if (!achados.length) console.log("  tudo com front matter, área, prazo e tasks em pasta.");
}

if (!observar) {
	const achados = findings(projeto);
	imprimir(achados);
	process.exit(achados.length ? 1 : 0);
}

// ---------------------------------------------------------------------------
// --watch: o modo stream. Reemite a leitura INTEIRA a cada mudança, não um diff.
//
// ponytail: varredura completa por evento, com debounce de 300ms. São ~25
// projetos e a leitura é de arquivo pequeno; um diff incremental seria estado
// paralelo pra economizar milissegundos que ninguém sente. Se um dia isto pesar,
// o caminho é indexar por slug e reavaliar só o slug que mudou — não cache.
//
// `recursive: true` é o que faz `tasks/001_x/CONTEXT.md` acordar o watcher, e é
// suportado no macOS e no Windows; no Linux exige Node 20+.
// ---------------------------------------------------------------------------
let debounce: ReturnType<typeof setTimeout> | undefined;
let ultimo = "";

const emitir = () => {
	const achados = findings(projeto);
	// O mesmo estado não é reemitido: um watcher recursivo dispara várias vezes
	// pelo mesmo save, e quem consome isso desenha tela — redesenhar igual pisca.
	const assinatura = JSON.stringify(achados);
	if (assinatura === ultimo) return;
	ultimo = assinatura;
	imprimir(achados);
};

emitir();

watch(PROJETOS, { recursive: true }, () => {
	clearTimeout(debounce);
	debounce = setTimeout(emitir, 300);
});
