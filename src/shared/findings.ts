//! Um check fala os QUATRO formatos, e o lugar de adicionar é este.
//!
//! A regra da casa é `#one_workflow_shape` aplicada à saída: `--json` inteiro pro
//! `jq`, `--tsv`/`--jsonl` na LINHA que alguém vai filtrar, e sem flag alinhado pro
//! humano. Comando que só fala com humano obriga o próximo a reparsear texto
//! alinhado, e alinhamento muda.
//!
//! Medido 19/08, antes disto: dos 15 checks de `src/check/`, **14 não falavam
//! `--tsv` nem `--jsonl`** e `rules.ts` não falava formato nenhum. A causa não era
//! desleixo — era não haver um lugar único: cada check montava a própria saída com
//! `console.log` cru (9 em `citations.ts`, 6 em `gates.ts`), então os quatro formatos
//! custariam quatro `if` por arquivo, quinze vezes.
//!
//! POR QUE `human` É UM CALLBACK, e não um template daqui. A catraca
//! (@src/check/ratchet.ts) e o `ci/report.md` LEEM a saída humana dos checks; um
//! header reformatado por este arquivo quebraria a catraca em silêncio, e a catraca é
//! justamente quem avisaria. Passando a impressão humana como callback, a saída de
//! cada check continua byte a byte a mesma POR CONSTRUÇÃO — não por eu ter conferido.
//! O que este arquivo unifica é só o que não existia: os três formatos de máquina.
//!
//! ponytail: `--watch` não entra aqui. Um check é uma pergunta que sai com código de
//! saída, e `--watch` não tem código de saída — quem precisa de stream é
//! @src/check/projects.ts, e ele tem o próprio laço. Se um segundo check precisar,
//! aí o laço sobe pra cá.
//!
//! depends_on: src/shared/gh.ts
//! impacts:    src/check/maps.ts · src/check/pointers.ts · src/check/rules.ts · src/check/untracked.ts · src/workflows/list.ts

import { type Fmt, fmtOf } from "./gh.ts";

/** TSV sem cabeçalho, mesma razão do `gh.ts`: cabeçalho é linha que todo consumidor
 *  tem que pular, e quem pula errado soma o texto como dado. As colunas ficam na
 *  docstring de quem chama. */
const tsv = (cols: (string | number | undefined)[]) =>
	cols.map((c) => String(c ?? "").replace(/[\t\n]/g, " ")).join("\t");

export type Check<T> = {
	/** O que sai no `--json` ao lado de `findings` — os totais, e o que mais aquele
	 *  check já publicava. Aparece ANTES de `findings` no objeto, de propósito: quem
	 *  abre o json lê o número primeiro. */
	json?: Record<string, unknown>;
	/** Os ACHADOS, e só eles: é o que `--jsonl`/`--tsv` emitem por linha, é o que vai
	 *  na chave `findings` do `--json`, e é o comprimento que decide o exit. */
	findings: T[];
	/** As colunas do `--tsv`, na ordem. */
	cols: (f: T) => (string | number | undefined)[];
	/** A saída humana INTEIRA, impressa por quem já sabia imprimi-la. */
	human: () => void;
};

/** Imprime no formato que a flag pedir e devolve o código de saída — `1` quando há
 *  achado, que é o que faz de um check um portão e não um relatório. */
export function emit<T>(argv: string[], check: Check<T>): number {
	const fmt: Fmt = fmtOf(argv);
	if (fmt === "json") console.log(JSON.stringify({ ...check.json, findings: check.findings }, null, 2));
	else if (fmt === "jsonl") for (const f of check.findings) console.log(JSON.stringify(f));
	else if (fmt === "tsv") for (const f of check.findings) console.log(tsv(check.cols(f)));
	else check.human();
	return check.findings.length ? 1 : 0;
}
