#!/usr/bin/env bun
//! A CASA SE MEDINDO: os quatro verbos de `House` (@src/interfaces/shared.ts).
//!
//!   bun run src/shared/house.ts            # check() + coverage(), o que é barato
//!   bun run src/shared/house.ts --all      # + ratchet() e metrics(), que rodam os checks
//!
//! Mora em `shared` pela razão que o antigo `system.ts` dava pra existir: ele roda o
//! `check()` de cada sistema POR FORMA — qualquer módulo que exporte
//! `check(): Finding[]` — então não importa vizinho nenhum e nada ganharia mudando de
//! camada. Um arquivo cujo único argumento era "não dependo de ninguém" está
//! descrevendo `shared`.
//!
//! A DESCOBERTA É ESTRUTURAL, e é a parte que não pode ser um registro: um sistema
//! novo passa a ser coberto por EXISTIR, não por alguém lembrar de inscrevê-lo numa
//! lista. Lista de inscrição é a regra que ninguém cumpre e nada verifica —
//! @CLAUDE.md já enterrou uma dessas em 17/08.
//!
//! A CATRACA veio de `src/check/ratchet.ts` em 20/08, inteira. Lá ficou só a CLI (as
//! flags, o `bun test`, o `ci/report.md`); a medição e o teto moram aqui, porque
//! comparar hoje contra ontem é justamente o que nenhum check por sistema consegue
//! fazer sozinho.
//!
//! depends_on: src/interfaces/shared.ts · src/shared/file.ts · ci/baseline.json
//! impacts:    src/check/ratchet.ts

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { House, Shared } from "../interfaces/shared.ts";
import { repoRoot } from "./file.ts";

const ROOT = repoRoot();
const SRC = join(ROOT, "src");
export const BASELINE = join(ROOT, "ci/baseline.json");

/** O que um sistema achou de podre em si mesmo. Declarado aqui de novo, e não
 *  importado de um contrato de sistema: quem lê a forma não pode depender de quem a
 *  tem. É a mesma frase que cada `src/interfaces/<sistema>.ts` escreve no próprio. */
export type Finding = { path: string; says: string };

/** `require` e não `import()`: `House.check()` é SÍNCRONO no contrato, e em Bun o
 *  `require` carrega `.ts`/ESM sem promessa. Medido antes de escrever isto. */
const req = createRequire(import.meta.url);

/** Um SISTEMA é uma pasta de `src/`; um `.ts` solto em `src/` é um sistema de um
 *  arquivo só. `interfaces/` fica de fora por não ser sistema — é o contrato de
 *  todos —, e `node_modules` por não ser nosso. */
export function modulos(): { system: string; file: string }[] {
	const out: { system: string; file: string }[] = [];
	const ts = (f: string) => f.endsWith(".ts") && !f.endsWith(".test.ts");
	for (const e of readdirSync(SRC, { withFileTypes: true })) {
		if (e.name === "node_modules" || e.name === "interfaces") continue;
		if (e.isDirectory()) {
			for (const f of readdirSync(join(SRC, e.name))) {
				if (ts(f)) out.push({ system: e.name, file: join(SRC, e.name, f) });
			}
		} else if (ts(e.name)) {
			out.push({ system: e.name.slice(0, -3), file: join(SRC, e.name) });
		}
	}
	return out;
}

/** Quem SEQUER diz `export … check`. É um pré-filtro de TEXTO, e ele não é preciosismo
 *  de velocidade: carregar todo `.ts` de `src/` pra perguntar a forma EXECUTA os que
 *  são script — `src/system_design/new.ts` não tem guarda de `import.meta.main`, e a
 *  primeira versão disto morreu imprimindo o `uso:` dele e saindo. A forma continua
 *  sendo a autoridade (o `typeof` abaixo); o texto só decide quem vale abrir. */
const DECLARA = /^export\s+(?:async\s+function|function|const|let)\s+check\b|^export\s*\{[^}]*\bcheck\b/m;

/** O `check` exportado por um módulo, ou nada. Nada TAMBÉM quando o módulo não
 *  carrega (um `import "vscode"` fora do host, por exemplo): módulo que não abre não
 *  declara check, e derrubar a varredura inteira por causa de um vizinho seria
 *  trocar a medida por uma exceção. */
export function checkDe(file: string): (() => Finding[]) | undefined {
	// Este arquivo NÃO se varre: `house.check()` devolve `Record`, não `Finding[]`,
	// e carregar a si mesmo pela forma seria recursão.
	if (file === import.meta.path) return undefined;
	try {
		if (!DECLARA.test(readFileSync(file, "utf8"))) return undefined;
		const fn = (req(file) as Record<string, unknown>).check;
		return typeof fn === "function" ? (fn as () => Finding[]) : undefined;
	} catch {
		return undefined;
	}
}

// =============================================================================
// a catraca — quem entra, e de onde sai o número
// =============================================================================

/** Medida ABSOLUTA: o teto dela é ZERO e não se negocia. A catraca normal compara com
 *  `ci/baseline.json` e só reprova quando o número SOBE — o que é certo pra backlog
 *  (116 pastas sem mapa não se conserta num commit) e ERRADO pra invariante.
 *
 *  A diferença é operacional, não filosófica: um teto é EDITÁVEL. Bastava alguém
 *  rodar `--write` com três markdown sem `type` pra o teto virar 3 e o portão calar
 *  pra sempre — sem ninguém mentir, só rodando o comando que a própria mensagem de
 *  sucesso sugere. Absoluta é a medida em que isso não pode acontecer: o `--write`
 *  RECUSA gravar teto diferente de zero, e a comparação ignora o baseline.
 *
 *  O CRITÉRIO é medido, não escolhido: entra o que JÁ está em zero hoje. `okf.sem` e
 *  `okf.duvida` (todo markdown declara `type`), `resources.orfaos` (nenhum recurso sem
 *  quem o cite) e `notes.fora_do_contrato` (o contrato de ID). Estado
 *  alcançado é justamente o que se perde por descuido, e é o único que dá pra exigir
 *  sem mentir.
 *
 *  Quem NÃO entra, e por quê: `citations.error` (11), `maps.sem_mapa` (116),
 *  `projects.findings` (86) e `untracked.fontes` (1) são BACKLOG real — nenhum se
 *  conserta num commit, e exigir zero deles hoje seria escolher o vermelho permanente
 *  que @src/check/context.ts já documentou como o modo de falha do portão que ninguém
 *  olha. Cada um entra aqui no dia em que chegar a zero. */
export const ABSOLUTAS = new Set(["okf.sem", "okf.duvida", "resources.orfaos", "notes.fora_do_contrato"]);

/** Quem entra na catraca, e de onde sai o número. Cada `medida` recebe o objeto
 *  que aquele check imprime com `--json` e devolve um inteiro — nada de string,
 *  porque o que a catraca compara é ordem de grandeza, não redação.
 *
 *  ## Só quem fala JSON entra
 *
 *  Ler o número do `--json` e não da frase é o que impede o portão de cair quando
 *  alguém reescreve uma mensagem sem nada ter piorado. */
const CATRACA: { check: string; medidas: Record<string, (j: any) => number> }[] = [
	{
		check: "citations",
		medidas: {
			// Só `error`. `warn` e `info` são história contada numa frase e pasta
			// congelada — o próprio `citations.ts` diz que history must never fail a
			// commit, e travar nelas contrariaria o cabeçalho dele.
			//
			// O campo é `level`, e o primeiro palpite (`severity`) devolveu ZERO em vez
			// de erro: a catraca gravou `citations.error: 0` como teto e teria passado
			// verde sobre 19 citações quebradas. Daí a asserção de inteiro em `medir`.
			//
			// E alvo `~/` NÃO conta: os 4 erros que o runner achou eram todos
			// `~/src/main.code-workspace`, `~/.claude/skills/…` — arquivos que existem
			// na máquina do Gabriel e não podem existir num runner. O MESMO commit dá 0
			// aqui e 4 lá, e número que depende de qual máquina rodou não é teto.
			error: (j) => j.findings.filter((f: any) => f.level === "error" && !String(f.target).startsWith("~")).length,
		},
	},
	// `divergente` entrou em 19/08 e NÃO é absoluto, de propósito. Ele conta markdown
	// que declara `type` com valor diferente do que o caminho sugeriria — opinião do
	// check, não defeito do arquivo. Até então ele estava DENTRO do `sem`, e por isso
	// `okf.sem` marcava 43 com teto zero: a catraca ficou travada em vermelho medindo
	// discordância de rótulo, enquanto o invariante que ela prometia guardar (todo
	// markdown declara `type`) já estava em zero e ninguém sabia.
	{ check: "okf", medidas: { sem: (j) => j.sem, divergente: (j) => j.divergente, duvida: (j) => j.duvida } },
	{ check: "resources", medidas: { orfaos: (j) => j.orfaos.length } },
	{ check: "maps", medidas: { sem_mapa: (j) => j.sem_mapa } },
	{
		check: "projects",
		medidas: {
			// `dangling_path` NÃO conta, e é a mesma razão do `~/` no `citations`: a regra
			// pergunta se o `repo_local` de um projeto existe NESTA MÁQUINA, e o runner
			// nunca terá `~/src/acme-mono`. O mesmo commit dava 86 no clone limpo e 88 no CI,
			// e a catraca reprovava por uma diferença de máquina — o portão precisa medir
			// o REPO, não o laptop.
			findings: (j) => j.findings.filter((f: any) => f.rule !== "dangling_path").length,
		},
	},
	{ check: "untracked", medidas: { fontes: (j) => j.fontes } },
	{ check: "notes", medidas: { fora_do_contrato: (j) => j.achados.length } },
	// Os quatro que entraram em 19/08. `pointers.dead` e `rules.fora_do_lugar` nascem
	// com teto ZERO porque é onde estão hoje — ponteiro pro vazio e regra fora da pasta
	// são defeito, não backlog. `context.acima_do_teto` e `reciprocal.sem_volta` nascem
	// com o número de hoje, que é backlog real: 44 mapas grandes e 227 arestas sem a
	// outra metade não se consertam num commit, e exigir zero deles seria o vermelho
	// permanente que este arquivo já recusa acima.
	// `gates` SAIU em 19/08, e o zero dele era falso: a catraca spawna cada check
	// SEM lista de arquivos, e `gates.ts` sem argumento não roda gate nenhum —
	// `rodados: []`, logo `falhou: 0` por construção, nunca medido. Um teto que
	// nenhum commit pode furar não é teto; é uma linha verde que dá a impressão de
	// cobertura. O gate real roda no `pre-commit`, com os arquivos do stage.
	{ check: "context", medidas: { acima_do_teto: (j) => j.achados.length } },
	{ check: "reciprocal", medidas: { sem_volta: (j) => j.missing.length } },
	{ check: "pointers", medidas: { dead: (j) => j.dead } },
	{ check: "rules", medidas: { fora_do_lugar: (j) => j.fora_do_lugar } },
	// Nasce em 14, não em 0: são referências que já citam outra desde antes do check
	// existir, e cada conserto é reescrever o texto pra ficar autossuficiente —
	// julgamento, não mecânica. Teto medido, como `context` e `reciprocal`.
	{ check: "references", medidas: { mencoes: (j) => j.mencoes } },
];

/** O número de HOJE de cada medida, spawnando o `--json` de cada check. */
export function medir(): Record<string, Record<string, number>> {
	const out: Record<string, Record<string, number>> = {};
	for (const { check, medidas } of CATRACA) {
		const p = Bun.spawnSync(["bun", "run", `src/check/${check}.ts`, "--json"], { cwd: ROOT });
		// Exit 1 é ACHADO, não falha — é o estado normal destes checks. Acima disso o
		// check quebrou, e medir a saída de um check quebrado é inventar número.
		if (p.exitCode > 1) throw new Error(`${check}.ts quebrou (exit ${p.exitCode}): ${p.stderr.toString().slice(0, 400)}`);
		// STDOUT VAZIO É QUEBRA, não achado — e este buraco derrubou a primeira rodada
		// no GitHub: `knowledge.ts` morreu por falta de `rg` no runner, saiu 1 (que a
		// linha acima aceita como estado normal) e imprimiu NADA, então o
		// `JSON.parse("")` estourou com "Unexpected EOF" sem dizer qual check era.
		// Exit 1 + nada no stdout não é um check com achado: é um check morto.
		const saida = p.stdout.toString().trim();
		if (!saida) throw new Error(`${check}.ts não imprimiu JSON (exit ${p.exitCode}): ${p.stderr.toString().slice(0, 400)}`);
		const json = JSON.parse(saida);
		out[check] = Object.fromEntries(
			Object.entries(medidas).map(([nome, f]) => {
				const n = f(json);
				// CONTROLE NEGATIVO da própria leitura: número que não é número é campo
				// que não existe. Foi assim que `severity` (o nome errado de `level`)
				// virou `0` calado e quase entrou no baseline como teto.
				if (!Number.isInteger(n)) throw new Error(`${check}.${nome} não leu inteiro (${n}) — o campo do --json mudou de nome?`);
				return [nome, n];
			}),
		);
	}
	return out;
}

/** O TETO de cada medida, lido do baseline. Absoluta ignora o arquivo e vale zero. */
export function teto(): Record<string, Record<string, number>> {
	if (!existsSync(BASELINE)) throw new Error("ci/baseline.json não existe — `my check ratchet --write` grava o estado atual como teto");
	return (JSON.parse(readFileSync(BASELINE, "utf8")) as { checks: Record<string, Record<string, number>> }).checks;
}

// =============================================================================
// a casa
// =============================================================================

export const house: House = {
	check(): Record<string, readonly Finding[]> {
		const out: Record<string, Finding[]> = {};
		for (const { system, file } of modulos()) {
			const fn = checkDe(file);
			if (!fn) continue;
			(out[system] ??= []).push(...fn());
		}
		return out;
	},

	/** Quantos módulos daquele sistema declaram um check. `0` é a resposta que
	 *  interessa: é "nada a verificar" deixando de ser suposição. */
	coverage(): Record<string, number> {
		const out: Record<string, number> = {};
		for (const { system, file } of modulos()) out[system] = (out[system] ?? 0) + (checkDe(file) ? 1 : 0);
		return out;
	},

	ratchet(): Record<string, { was: number; now: number }> {
		const base = teto();
		const out: Record<string, { was: number; now: number }> = {};
		for (const [check, medidas] of Object.entries(medir()))
			for (const [nome, now] of Object.entries(medidas)) {
				const chave = `${check}.${nome}`;
				// Medida SEM teto no baseline vira teto de si mesma: é o que o `--write`
				// gravaria, e é o que a catraca já fazia (não reprovar por ela). Fingir
				// teto zero reprovaria uma medida nova só por ela ser nova.
				out[chave] = { was: ABSOLUTAS.has(chave) ? 0 : (base[check]?.[nome] ?? now), now };
			}
		return out;
	},

	metrics(): readonly Shared.Measure[] {
		const at = new Date().toISOString();
		const achados = this.check();
		const cobertura = this.coverage();
		return [
			...Object.entries(this.ratchet()).map(([name, { now }]) => ({ name, value: now, at })),
			{ name: "findings", value: Object.values(achados).reduce((n, fs) => n + fs.length, 0), at },
			{ name: "systems", value: Object.keys(cobertura).length, at },
			{ name: "systems_with_check", value: Object.values(cobertura).filter((n) => n > 0).length, at },
		];
	},
};

if (import.meta.main) {
	const cobertura = house.coverage();
	const achados = house.check();
	console.log("coverage() — módulos com `check()` por sistema:");
	for (const [system, n] of Object.entries(cobertura).sort()) console.log(`  ${n === 0 ? "—" : n} ${system}`);
	const comCheck = Object.values(cobertura).filter((n) => n > 0).length;
	console.log(`\n${comCheck}/${Object.keys(cobertura).length} sistemas declaram check`);
	console.log(`check() → ${Object.values(achados).reduce((n, f) => n + f.length, 0)} achado(s) em ${Object.keys(achados).length} sistema(s)`);
	for (const [system, fs] of Object.entries(achados)) for (const f of fs) console.log(`  ${system}: ${f.path} — ${f.says}`);

	if (Bun.argv.includes("--all")) {
		console.log("\nmetrics():");
		for (const m of house.metrics()) console.log(`  ${m.name.padEnd(28)} ${m.value}`);
	}
}
