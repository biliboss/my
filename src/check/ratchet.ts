#!/usr/bin/env bun
//! A catraca: nenhum número desta casa pode SUBIR.
//!
//!   bun run src/check/ratchet.ts            # compara com ci/baseline.json
//!   bun run src/check/ratchet.ts --json
//!   bun run src/check/ratchet.ts --write     # grava o estado atual como teto
//!
//! Existe porque `my check all` sai 1 hoje e vai sair 1 por muito tempo: 41
//! `CONTEXT.md` acima do teto, 18 citações erradas, 115 pastas sem mapa. Um CI que
//! exigisse zero seria vermelho no dia um, e CI vermelho no dia um é CI que
//! ninguém olha — a mesma falha que @src/check/pre-commit já se protegeu de
//! ("so this never becomes the hook everyone disables"). O `context.ts` chega a
//! dizer que os grandes ficam vermelhos DE PROPÓSITO, porque vermelho é o que
//! impede o backlog de ser esquecido.
//!
//! Então o critério não é o VALOR, é a DERIVADA. 41 passa; 42 reprova. Consertar
//! dez citações é um commit que também baixa o teto (`--write`), e o teto novo não
//! volta. A catraca não pede que ninguém conserte nada — ela proíbe piorar.
//!
//! ## A MEDIÇÃO mora em @src/shared/house.ts
//!
//! Aqui ficou a CLI — as flags, o `bun test`, o `ci/report.md`. Quem entra na catraca,
//! de onde sai cada número e qual é o teto é `House.ratchet()`, porque comparar hoje
//! contra ontem é o verbo da casa, não deste arquivo. Mudou de lugar em 20/08.
//!
//! `context`, `reciprocal`, `pointers` e `rules` ficaram DE FORA por não falarem
//! JSON, e a ausência dos quatro era impressa a cada rodada. Em 19/08 os quatro
//! entraram: três já falavam `--json` havia tempo — a lista tinha virado uma frase
//! que ninguém reconferia — e `rules` ganhou o dele junto com o emissor de
//! @src/shared/findings.ts. A cobertura agora é de 12 medidas, e não existe mais
//! "não coberto" pra imprimir.
//!
//! depends_on: src/shared/house.ts · ci/baseline.json · src/check/resources.ts · src/shared/markdown.ts · src/check/okf.ts · src/check/maps.ts · src/check/citations.ts
//! impacts:    .github/workflows/check.yml · 04_archive/my_check_v1/RFC_002_github_ci.md

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { carimbos, typeOf } from "../shared/markdown.ts";
import { tabela as tabelaMaps } from "./maps.ts";
import { tabela as tabelaResources } from "./resources.ts";
import { tabela as tabelaOkf } from "./okf.ts";
import { repoRoot } from "../shared/file.ts";
// A medição e o teto são da CASA (`House.ratchet()`); aqui é só a CLI em volta deles.
import { ABSOLUTAS, BASELINE, medir } from "../shared/house.ts";

const ROOT = repoRoot();

/** As falhas de teste, por NOME, LIDAS de uma saída de `bun test` já capturada.
 *
 *  Separada do `spawn` porque é a única parte que dá pra testar: o parser tem três
 *  regras (o `(fail)`, o módulo que não carrega, e o exit code que a saída não
 *  explica) e todas as três já erraram uma vez. @src/check/ratchet.test.ts. */
export function falhasDaSaida(saida: string, exitCode: number): string[] {
	// O SUMÁRIO é o recibo de que o runner chegou ao fim. Sem ele, o que veio antes
	// não é "nenhuma falha": é uma suíte interrompida, e ler zero falha daí é
	// exatamente o verde falso que custou as 47 rodadas. Sem `Ran N tests`, a
	// catraca não tem medida — e não ter medida é reprovar, nunca passar.
	if (!/^Ran \d+ tests? across \d+ files?\./m.test(saida))
		throw new Error(
			`bun test não imprimiu o sumário \`Ran N tests\` (exit ${exitCode}) — runner morto no meio, a medida não existe:\n${saida.slice(-600)}`,
		);

	const falhas = [...saida.matchAll(/^\(fail\) (.+?) \[[\d.]+ms\]$/gm)].map((m) => m[1]!);

	// UM ARQUIVO QUE NEM CARREGA não tem `(fail)` nenhum — ele nem chega a ter teste.
	// `bun test` diz `# Unhandled error between tests`, e o regex acima não casava:
	// medido 19/08, `src/system/metrics.test.ts` importava um símbolo que não existia
	// mais, os 5 testes dele não rodavam havia dias, e a catraca dizia verde. Um teste
	// que some é pior que um que falha — o teto continua o mesmo e a cobertura, não.
	//
	// O NOME é o arquivo, porque é o que existe aqui: erro de carga acontece ANTES de
	// qualquer teste ter nome. Some ao baseline como uma entrada por arquivo quebrado.
	//
	// Só o marcador `# Unhandled error`, NUNCA um `error:` solto — a primeira versão
	// disto também casava `error:` e marcou `src/vscode/set.test.ts` como "não
	// carrega" quando ele carrega e só tem um `expect` falhando. Contar a mesma falha
	// duas vezes, com nome diferente, faria a catraca reprovar por um teste que já
	// estava no baseline pelo nome certo.
	for (const m of saida.matchAll(/^# Unhandled error between tests$/gm)) {
		const arquivo = saida
			.slice(0, m.index)
			.match(/^([\w./-]+\.test\.(?:ts|mjs)):$/gm)
			?.at(-1)
			?.replace(/:$/, "");
		falhas.push(`módulo não carrega: ${arquivo ?? "arquivo desconhecido"}`);
	}

	// O EXIT CODE é a autoridade; os regexes acima são só quem dá NOME à falha. Saiu
	// diferente de zero e nenhum nome foi extraído = o `bun test` reprovou por algo
	// que este parser não conhece (formato de saída novo, crash fora de teste). Ler
	// isso como "zero falhas" seria confiar no parser contra o runner — a mesma
	// aposta que já saiu cara aqui. Uma entrada nomeada entra no baseline e força a
	// olhar.
	if (exitCode !== 0 && falhas.length === 0)
		falhas.push(`bun test saiu ${exitCode} sem nomear falha — a saída mudou de formato?`);

	return [...new Set(falhas)].sort();
}

/** As falhas de teste, por NOME. Contar não basta: "2 falhas" vira "algumas
 *  falhas" no mês seguinte, e ninguém percebe a troca de quais. */
function testesQueFalham(): string[] {
	// `./src/` e NUNCA `src/`: o argumento do `bun test` é filtro de SUBSTRING, não
	// caminho. Sem a `./` ele casa `01_projects/vscode-terminal-automation/src/hook.test.mjs`,
	// que termina em `process.exit(...)` — e um `exit` MATA o runner no meio: sem
	// sumário, sem exit code, e sem os arquivos que ainda não rodaram. Medido 19/08:
	// `bun test src/` saía 0 com um teste falhando, e `bun test ./src/` saía 1 na
	// mesma árvore. Esta catraca leu 47 rodadas de uma suíte que não reprovava.
	//
	// `node_modules` NÃO precisa de exclusão, e isto foi medido e não suposto: o
	// `bun test` já o pula na varredura de pasta. `src/extension/node_modules/@braintree/
	// sanitize-url/.../index.test.ts` roda (49 testes) quando nomeado à mão, e não
	// aparece nenhuma vez sob `./src/`. Flag pra um problema que não reproduz é flag
	// que ninguém sabe por que existe.
	const p = Bun.spawnSync(["bun", "test", "./src/"], { cwd: ROOT });
	return falhasDaSaida(`${p.stdout.toString()}${p.stderr.toString()}`, p.exitCode);
}

/** Tudo depois desta linha é o log. É o que deixa as tabelas serem reescritas sem
 *  tocar uma rodada registrada. */
const MARKER = "<!-- runs below — appended, never rewritten -->";

/** O relatório, e a catraca é a ÚNICA que o escreve.
 *
 *  Foi decisão, não sobra: os quatro checks MEDEM e nenhum publica, porque dois
 *  escritores no mesmo arquivo é a falha que este repo já documentou no `folders` do
 *  `main.code-workspace` — a próxima escrita apaga a entrada da anterior e ninguém
 *  entende por quê. Aqui a catraca já lê o `--json` de todos; publicar é de graça pra
 *  ela e impossível de coordenar pros outros.
 *
 *  As tabelas são REGENERADAS do disco a cada rodada e o log é só append: tabela
 *  derivada que pode envelhecer é a segunda fonte que @CLAUDE.md recusa, e histórico
 *  que uma rodada posterior sobrescreve não é histórico. */
function escreve(report: string, linha: string): void {
	const log = existsSync(report) ? (readFileSync(report, "utf8").split(MARKER)[1]?.trimStart() ?? "") : "";
	const cabecalho = log.startsWith("| when |") ? "" : "| when | check | ok | detail |\n|---|---|---|---|\n";
	const corpo = [tabelaResources(report).md, tabelaOkf(carimbos()), tabelaMaps().md].join("\n\n");
	// O `type` do relatório sai do MESMO `typeOf` que ele cobra dos outros. Cravar um
	// literal fez o próprio report aparecer como achado na primeira rodada.
	const head = `---\ntype: ${typeOf(relative(ROOT, report))}\n---\n\n# o estado da casa\n\nEscrito por \`my check ratchet\`. As tabelas são regeneradas do disco; o log abaixo é append.\n\n${corpo}\n\n## Runs\n\n${MARKER}\n\n`;
	writeFileSync(report, `${head}${cabecalho}${log}${linha}\n`);
}

export function main(argv: string[]): number {
	// `--md` imprime a MESMA medição em markdown, pro `$GITHUB_STEP_SUMMARY`: a página
	// da run mostra tabela, não um code fence com texto alinhado dentro.
	const md = argv.includes("--md");
	const atual = medir();
	const testes = testesQueFalham();

	if (argv.includes("--write")) {
		// A recusa que dá sentido a `ABSOLUTAS`: sem ela o baseline aceitaria o número
		// de hoje como teto novo, e a invariante viraria backlog em silêncio.
		const violadas = Object.entries(atual).flatMap(([c, ms]) =>
			Object.entries(ms).filter(([n, v]) => ABSOLUTAS.has(`${c}.${n}`) && v !== 0).map(([n, v]) => `${c}.${n} = ${v}`),
		);
		if (violadas.length) {
			console.error(`baseline NÃO escrito — medida absoluta fora de zero:\n  ${violadas.join("\n  ")}`);
			console.error("  Conserte o achado; teto de invariante não sobe. `my check okf --fix --write` carimba o que falta.");
			return 1;
		}
		writeFileSync(BASELINE, `${JSON.stringify({ checks: atual, testes_que_falham: testes }, null, 2)}\n`);
		console.log(`ci/baseline.json escrito · ${testes.length} teste(s) falhando, nomeados`);
		return 0;
	}
	if (!existsSync(BASELINE)) {
		console.error("ci/baseline.json não existe — `--write` grava o estado atual como teto");
		return 1;
	}
	const base = JSON.parse(readFileSync(BASELINE, "utf8")) as { checks: typeof atual; testes_que_falham: string[] };

	// `--out-dir` porque o relatório é entregável de PROJETO e o check mora em `src/`.
	// Sem a flag, mudar o check de pasta levaria a saída junto pra dentro do código.
	const oi = argv.indexOf("--out-dir");
	// O default é `ci/`, ao lado do `baseline.json`, e não a pasta do projeto que
	// nasceu com isto: `01_projects/my_check_v1/` foi pro `04_archive/` em 19/08, e
	// arquivo é "ninguém toca, PRA SEMPRE" — um CI escrevendo lá a cada push seria a
	// contradição por escrito. Arquivar forçou a pergunta certa: quem é o dono do
	// relatório depois que o projeto acaba? O portão, não o projeto.
	const outDir = oi === -1 ? join(ROOT, "ci") : argv[oi + 1];
	if (outDir === undefined || !existsSync(outDir)) {
		console.error(`--out-dir não existe: ${outDir ?? "(vazio)"}`);
		return 1;
	}

	let subiu = 0;
	// As linhas guardadas, não só impressas: o `--md` renderiza a MESMA medição como
	// tabela pra página da run. Reparsear a saída de texto no bash do workflow foi a
	// primeira ideia e é a pior — texto alinhado muda de forma e leva o portão com ele.
	const linhas: { check: string; nome: string; n: number; teto?: number; sinal: string }[] = [];
	for (const [check, medidas] of Object.entries(atual))
		for (const [nome, n] of Object.entries(medidas)) {
			const absoluta = ABSOLUTAS.has(`${check}.${nome}`);
			// Absoluta compara com ZERO, não com o baseline: o teto dela não mora em
			// arquivo nenhum, então não há o que editar pra afrouxar.
			const teto = absoluta ? 0 : base.checks[check]?.[nome];
			const sinal = absoluta ? (n === 0 ? "=" : "✗") : teto === undefined ? "?" : n > teto ? "✗" : n < teto ? "↓" : "=";
			if (absoluta ? n !== 0 : teto !== undefined && n > teto) subiu++;
			linhas.push({ check, nome, n, teto, sinal });
			if (!md) console.log(`${sinal} ${check}.${nome}: ${n}${teto === undefined ? " (sem teto no baseline)" : ` / teto ${teto}`}`);
		}

	// Teste é a exceção da catraca: aqui o critério é o CONJUNTO, não o número. Uma
	// falha nova reprova mesmo se outra tiver sido consertada no mesmo commit —
	// senão duas trocas se cancelam e o portão não vê nada.
	const novas = testes.filter((t) => !base.testes_que_falham.includes(t));
	if (!md) {
		for (const t of novas) console.log(`✗ teste NOVO falhando: ${t}`);
		for (const t of base.testes_que_falham.filter((t) => !testes.includes(t))) console.log(`↓ teste consertado: ${t}`);
	}

	const total = subiu + novas.length;
	if (!md)
		console.log(
			`\n${total === 0 ? "catraca ok" : `catraca REPROVA: ${total} pioraram`} · ${linhas.length} medidas, todos os checks cobertos`,
		);
	if (total === 0 && !md) console.log("  baixou algum número? `--write` grava o teto novo no mesmo commit.");

	const report = join(outDir, "report.md");
	escreve(report, `| ${new Date().toISOString()} | ratchet | ${total === 0 ? "✓" : "✗"} | ${total} pioraram |`);
	if (!md) console.log(`→ ${relative(ROOT, report)}`);

	if (md) {
		const emoji = total === 0 ? "✅" : "❌";
		console.log(`## ${emoji} catraca — ${total === 0 ? "nenhum número subiu" : `${total} pioraram`}\n`);
		console.log("| | check | medida | hoje | teto |");
		console.log("|---|---|---|---|---|");
		for (const l of linhas)
			console.log(
				`| ${l.sinal} | \`${l.check}\` | ${l.nome} | **${l.n}** | ${l.teto === undefined ? "— (sem teto)" : ABSOLUTAS.has(`${l.check}.${l.nome}`) ? "**0 · invariante**" : l.teto} |`,
			);
		if (novas.length) console.log(`\n**Teste NOVO falhando:** ${novas.map((t) => `\`${t}\``).join(", ")}`);
		// O que a catraca NÃO cobre sai na página junto, e não só no log: portão que
		// esconde a própria cobertura é portão em que se confia mais do que se deve.
		console.log(`\n<sub>${linhas.length} medidas · todos os checks cobertos · relatório completo abaixo</sub>`);
	}
	return total === 0 ? 0 : 1;
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
