#!/usr/bin/env bun
//! Todo markdown obedece o OKF — isto é, declara `type:`?
//!
//!   my check okf                # o censo, por espécie
//!   my check okf --json
//!   my check okf --fix          # o plano do carimbo
//!   my check okf --fix --write   # aplica
//!
//!   --json → { total:int · sem:int · divergente:int · duvida:int · symlink:int }
//!            catraca: okf.sem · okf.divergente · okf.duvida — os três ABSOLUTOS (teto 0)
//!
//! O OKF (Open Knowledge Format, Google) exige UM campo — `type`, texto livre, sem
//! registro central, e o consumidor tem que tolerar espécie que não conhece. Todo o
//! resto é recomendação. O contrato está em
//! @03_resources/notes/2026-08-14T0111Z_okf-so-obriga-o-type-o-resto-e-recomendacao.md.
//!
//! O valor sai do CAMINHO (`typeOf` em @src/shared/markdown.ts): a pasta é o que a
//! casa já decidiu quando pôs o arquivo lá, e derivar do texto seria uma segunda
//! opinião sobre a mesma coisa.
//!
//! ## Por que o nome é `okf`, e não `types`
//!
//! Porque o que ele valida é o PADRÃO, não o campo. `type` é a única obrigação do
//! Open Knowledge Format, então "tem okf?" e "tem type?" são a mesma pergunta hoje —
//! mas se amanhã a casa passar a exigir `title` ou `status` (que o OKF recomenda), é
//! aqui que entra, e o verbo continua o mesmo. Um check chamado `types` teria que
//! virar `types-e-mais-quatro-campos`.
//!
//! ## Por que ele é UM check e não um por pasta
//!
//! `type` é o campo, não o domínio. `my check resources` e `my check projects`
//! perguntam sobre o que mora em `03_resources/` e `01_projects/`; este pergunta
//! sobre um CAMPO que existe em 897 arquivos espalhados por toda a casa. Dividi-lo
//! por pasta daria N donos pro mesmo carimbo — e dois donos do mesmo campo é a
//! segunda fonte que @CLAUDE.md recusa.
//!
//! `--fix` planeja e `--write` aplica, igual ao @src/check/citations.ts: carimbar
//! 900 arquivos sem plano impresso antes é irrevisável.
//!
//! depends_on: src/shared/markdown.ts · src/shared/argv.ts
//! impacts:    src/check/ratchet.ts

import { type Acao, type Carimbo, carimba, carimbos } from "../shared/markdown.ts";
import { has } from "../shared/argv.ts";

/** SEM `type` é uma coisa; `type` DIVERGENTE do caminho é outra — e confundir as
 *  duas travou a catraca em vermelho por dias.
 *
 *  `okf.sem` é métrica ABSOLUTA em `ratchet.ts` (teto zero, e o `--write` se recusa
 *  a subir), então ela precisa poder CHEGAR a zero. Enquanto `troca` entrava na
 *  soma, não podia: medido 19/08, os 43 do bucket eram 0 `insert`, 0 `create` e 43
 *  `troca` — ou seja, TODO markdown da casa já declarava `type`, e o número
 *  vermelho era o check discordando do valor escolhido.
 *
 *  A diferença tem consequência prática: `insert`/`create` se conserta sozinho (o
 *  campo falta, o `--fix` escreve), enquanto `troca` é reescrever uma afirmação que
 *  alguém fez de propósito. Uma é mecânica, a outra é julgamento por arquivo. */
export const semType = (cs: Carimbo[]): Carimbo[] => cs.filter((c) => c.acao === "insert" || c.acao === "create");

/** A lista é CAPADA, e o corte é IMPRESSO. Relatório que mostra calado os trinta
 *  primeiros de novecentos lê como "trinta faltando". */
export function tabela(cs: Carimbo[], cap = 30): string {
	const sem = semType(cs);
	const divergentes = cs.filter((c) => c.acao === "troca");
	const porType = [...new Set(cs.map((c) => c.type))]
		.map((type) => {
			const meus = cs.filter((c) => c.type === type);
			return { type, n: meus.length, ok: meus.filter((c) => c.acao === "skip" || c.acao === "link").length };
		})
		.sort((a, b) => b.n - a.n);
	return [
		"## OKF `type`",
		"",
		"O OKF obriga UM campo: `type` no frontmatter — espécie livre, sem registro central, e o consumidor tolera tipo que não conhece. O valor sai do CAMINHO, nenhum arquivo foi julgado à mão. `doc` é o resto: caminho que nenhuma regra classifica, e isso é achado, não default. Symlink não é carimbado — o alvo real já é.",
		"",
		// A terceira coluna diz DIVERGE, e não "falta": ela conta quem declarou um
		// `type` diferente do que o caminho sugere. Chamar isso de falta foi o que
		// deixou a tabela dizer `resource: 40 falta` sobre 40 arquivos que declaram
		// `type: meeting` — todos eles têm o campo.
		"| `type` | markdown | bate | diverge |",
		"|---|---|---|---|",
		...porType.map((b) => `| \`${b.type}\` | ${b.n} | ${b.ok} | ${b.n - b.ok} |`),
		`| **total** | **${cs.length}** | **${cs.length - sem.length - divergentes.length}** | **${divergentes.length}** |`,
		"",
		// O symlink saía só no `--json` e no `--fix`. Um número que existe em um
		// formato e não no outro é o formato humano mentindo por omissão.
		`**Sem \`type\`: ${sem.length}** · **diverge: ${divergentes.length}** · **symlink: ${cs.filter((c) => c.acao === "link").length}** (não carimbado — o alvo real já é) · **dúvida: ${cs.filter((c) => c.acao === "duvida").length}**`,
		"",
		`### Sem \`type\`${sem.length > cap ? ` (os ${cap} primeiros de ${sem.length})` : ""}`,
		"",
		sem.length === 0 ? "Nenhum — todo markdown declara `type`." : sem.slice(0, cap).map((c) => `- \`${c.file}\` → \`${c.type}\``).join("\n"),
		"",
		`### Divergente do caminho${divergentes.length > cap ? ` (os ${cap} primeiros de ${divergentes.length})` : ""}`,
		"",
		"Declara `type`, e o valor é outro do que o caminho sugeriria. **Isto é OPINIÃO do check, não defeito do arquivo** — quem escreveu pode saber algo que a regra de caminho não sabe. Por isso não é invariante: trocar um `type` já escrito é reescrever uma afirmação.",
		"",
		divergentes.length === 0
			? "Nenhum."
			: divergentes.slice(0, cap).map((c) => `- \`${c.file}\`: \`${c.era}\` → \`${c.type}\``).join("\n"),
	].join("\n");
}

export function main(argv: string[]): number {
	// Caminho solto no argv = julgue SÓ estes. É o que o pre-commit passa (a lista
	// do stage); sem nenhum, varre a casa inteira, que é o que o `check all` quer.
	// O filtro por `.md` é porque o stage traz `.ts` e `.yaml` junto, e carimbo de
	// `type:` é coisa de markdown.
	const alvos = argv.filter((a) => !a.startsWith("-") && a.endsWith(".md"));
	const cs = carimbos(alvos.length ? alvos : undefined);
	const conta = (a: Acao) => cs.filter((c) => c.acao === a).length;
	// `pendentes` é o que o `--fix --write` escreveria: inclui `troca`, porque o
	// fixer sabe trocar. O que ele NÃO é: a métrica da catraca. Ver `semType`.
	const pendentes = cs.filter((c) => c.acao === "insert" || c.acao === "create" || c.acao === "troca");
	const sem = semType(cs);
	const divergentes = cs.filter((c) => c.acao === "troca");
	const duvidas = cs.filter((c) => c.acao === "duvida");

	if (has("json", argv)) {
		console.log(
			JSON.stringify(
				{ total: cs.length, sem: sem.length, divergente: divergentes.length, duvida: duvidas.length, symlink: conta("link") },
				null,
				2,
			),
		);
		return sem.length === 0 ? 0 : 1;
	}

	if (has("fix", argv)) {
		console.log(
			`${cs.length} markdown · insert ${conta("insert")} · create ${conta("create")} · troca ${conta("troca")} · skip ${conta("skip")} · symlink ${conta("link")} · dúvida ${duvidas.length}`,
		);
		// A troca é impressa arquivo por arquivo: mudar um `type` já escrito é
		// reescrever uma afirmação, e isso ninguém deve descobrir pelo contador.
		for (const c of cs.filter((x) => x.acao === "troca")) console.log(`  ~ ${c.file}: ${c.era} → ${c.type}`);
		// Dúvida é SEMPRE impressa inteira: é a lista do que NÃO foi tocado.
		for (const d of duvidas) console.log(`  ? ${d.file} — \`---\` na linha 1 que não parece frontmatter, NÃO tocado`);
		if (!has("write", argv)) {
			console.log("\nplano só. `--fix --write` aplica.");
			return pendentes.length === 0 ? 0 : 1;
		}
		for (const c of cs) carimba(c);
		console.log(`\ncarimbados ${pendentes.length} arquivos.`);
		return 0;
	}

	console.log(tabela(cs).split("\n").slice(4).join("\n"));
	// EXIT pelo `sem`, não pelo `pendentes`: divergência é opinião do check, e um
	// check que sai 1 pra sempre por opinião é o vermelho permanente que ninguém lê.
	return sem.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
