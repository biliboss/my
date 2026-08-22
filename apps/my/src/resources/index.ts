#!/usr/bin/env bun
//! O que esta casa sabe, N de uma vez — o verbo pelado.
//!
//!     my resources                          lista tudo, agrupado por assunto
//!     my resources mkt_funnel               o assunto INTEIRO, todos os arquivos
//!     my resources askuser                  uma página só, pelo nome
//!     my resources project issues           o arquivo DENTRO do assunto — narrowing
//!     my resources -g askuser               onde o termo aparece, e quantas vezes
//!     my resources -g 'rocks?db' -c         só o número
//!
//! É o `index.ts` da pasta, e por isso a CLI o chama quando ninguém pede subverbo —
//! `my resources read x` vai pro `read.ts` ao lado. A gramática é a que estava em
//! `src/resources.ts` até 20/08, inteira, porque `my resources <assunto>` é citado às
//! dezenas nesta casa e virar pasta não é motivo pra quebrar citação.
//!
//! ## `--grep` responde uma pergunta que ler não responde
//!
//! "Isto aqui já está escrito em algum lugar?" e "quanto deste assunto já existe em
//! casa?" são perguntas de CONTAGEM, e a resposta some quando a saída é o texto
//! inteiro: quem abre três recursos pra procurar um termo lê tudo e ainda pode não
//! achar.
//!
//! É `-i` por padrão porque o que se procura é um ASSUNTO, não um token: quem escreve
//! `-g askuser` quer `AskUser` e `ASKUSER` junto. `-s` liga a sensibilidade pra quando
//! o caso importa (`Rodada` a classe, não a palavra).
//!
//! **O ASSUNTO resolve, e o arquivo também.** `my resources mkt_funnel` imprime a pasta
//! inteira porque um ambiente só se entende junto — o CONTEXT.md sem o arquivo de como
//! rodar é um mapa sem a estrada.
//!
//! **E o arquivo depois do assunto ENCOLHE aquele assunto** — `project issues` é o
//! `issues.md` de `project`, não a pasta toda mais ele. Encolher só vale pro que os
//! argumentos ANTERIORES trouxeram: `project mkt_funnel` são dois assuntos e saem
//! inteiros.
//!
//! depends_on: src/resources/store.ts
//! impacts:    03_resources/CONTEXT.md · src/cli/core/router.ts

import { Command } from "commander";
import { relative } from "node:path";
import { ROOT, index, print, subject, type Resource } from "./store.ts";

export function command(): Command {
	return new Command("resources")
		.description("o que esta casa sabe, N de uma vez")
		.argument("[alvos...]", "assunto ou nome. Com --grep, ESTREITA a busca")
		.option("-g, --grep <regex>", "onde o termo aparece, e QUANTAS vezes em cada")
		.option("-c, --count", "só o total. Um número, pra script")
		.option("-s, --case-sensitive", "o padrão é ignorar caixa — se procura assunto, não token")
		.option("--json", "tudo de uma vez, pro jq")
		.option("--jsonl", "uma linha por recurso")
		.option("--tsv", "ocorrências · assunto · nome · linhas")
		.addHelpText(
			"after",
			`
  my resources                          lista tudo, agrupado por assunto
  my resources mkt_funnel               o assunto INTEIRO
  my resources project issues           o arquivo DENTRO do assunto
  my resources -g askuser               onde aparece, e quantas vezes em cada
  my resources -g 'rocks?db' -c         só o número

  --grep varre a casa INTEIRA: busca não herda a divisão de kinds que existe pra
  leitura. Exit 1 quando nada casa, como o grep.`,
		);
}

export type Achado = {
	name: string;
	subject: string;
	/** Quantas VEZES o termo aparece — não em quantas linhas. */
	ocorrencias: number;
	/** Os números de linha onde ele aparece, 1-based. */
	linhas: number[];
};

/**
 * Conta as ocorrências do padrão em cada recurso. Só quem tem ao menos uma sai.
 *
 * **Ocorrências, não linhas.** Um `grep -c` conta linhas que casam, e uma linha com o
 * termo três vezes vale 1 — o que responde "onde está" e não "quanto existe". A
 * pergunta que motivou este verbo é a segunda.
 *
 * `lastIndex` zera antes de cada arquivo: um `RegExp` com `g` guarda posição entre
 * chamadas, e reaproveitá-lo sem zerar faria o segundo arquivo começar no meio.
 */
export function grep(padrao: RegExp, recursos: Resource[]): Achado[] {
	const out: Achado[] = [];
	for (const r of recursos) {
		padrao.lastIndex = 0;
		const casos = [...r.body.matchAll(padrao)];
		if (!casos.length) continue;
		// A linha sai do OFFSET, contando as quebras até ele. Vale a varredura: o número
		// de linha é o que transforma "existe" em "abra aqui".
		const linhas = casos.map((c) => r.body.slice(0, c.index).split("\n").length);
		out.push({ name: r.name, subject: subject(r), ocorrencias: casos.length, linhas: [...new Set(linhas)] });
	}
	return out.sort((a, b) => b.ocorrencias - a.ocorrencias || a.subject.localeCompare(b.subject));
}

/**
 * Compila o padrão do usuário. `g` sempre — é o que faz contar em vez de achar o
 * primeiro; `i` a menos que peçam o contrário.
 *
 * Regex inválida devolve a mensagem em vez de estourar: quem digitou `[askuser` merece
 * "falta um `]`", não um stack trace.
 */
export function compila(padrao: string, sensivel: boolean): RegExp | string {
	try {
		return new RegExp(padrao, sensivel ? "g" : "gi");
	} catch (e) {
		return `regex inválida: ${(e as Error).message}`;
	}
}

export function main(argv: string[]): number {
	const all = index();

	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (e) {
		// `exitOverride` transforma `--help` e erro de flag em exceção pra não matar o
		// processo do `my` inteiro. O commander já imprimiu o que precisava.
		return (e as { exitCode?: number }).exitCode ?? 1;
	}
	const o = cmd.opts();
	const resto = cmd.args;
	const formato = o.json ? "json" : o.jsonl ? "jsonl" : o.tsv ? "tsv" : "";

	if (o.grep) {
		const padrao = compila(o.grep as string, Boolean(o.caseSensitive));
		if (typeof padrao === "string") return console.error(padrao), 1;

		// Os posicionais ESTREITAM a busca: `my resources mukutu -g askuser` procura
		// dentro de mukutu. Sem argumento, procura na casa INTEIRA — kind nenhum fica de
		// fora, e medido em 19/08: procurar `AskUserQuestion` só nos assuntos devolvia
		// ZERO enquanto o termo estava em `references/` e `rules/`. Um zero que mente é
		// pior que nenhuma resposta, porque quem pergunta age sobre ele.
		const escopo = resto.length
			? all.filter((r) => resto.some((a) => subject(r) === a || subject(r).endsWith(`/${a}`) || r.name === a))
			: all;
		const achados = grep(padrao, escopo);
		const total = achados.reduce((s, a) => s + a.ocorrencias, 0);

		if (o.count && !formato) console.log(total);
		else if (formato === "json") console.log(JSON.stringify({ padrao: String(padrao), total, achados }));
		else if (formato === "jsonl") for (const a of achados) console.log(JSON.stringify(a));
		else if (formato === "tsv")
			for (const a of achados) console.log(`${a.ocorrencias}\t${a.subject}\t${a.name}\t${a.linhas.join(",")}`);
		else if (!achados.length) console.log(`nenhum recurso com /${o.grep}/`);
		else {
			const larg = Math.max(...achados.map((a) => String(a.ocorrencias).length));
			for (const a of achados)
				console.log(
					`${String(a.ocorrencias).padStart(larg)}  ${a.subject}/${a.name}  ${a.linhas.slice(0, 6).join(",")}${a.linhas.length > 6 ? "…" : ""}`,
				);
			console.log(`\n${total} ocorrência(s) em ${achados.length} recurso(s)`);
		}
		// EXIT 1 SEM ACHADO, como o grep: é o que deixa `my resources -g x -c || echo
		// "não existe"` funcionar num script sem parsear a saída.
		return achados.length ? 0 : 1;
	}

	if (o.count || o.caseSensitive) return console.error("-c e -s só valem com -g — veja `my resources -h`"), 1;

	if (!resto.length) {
		const bySubject = new Map<string, string[]>();
		for (const r of all) {
			const s = subject(r);
			if (!bySubject.has(s)) bySubject.set(s, []);
			bySubject.get(s)!.push(r.name);
		}
		for (const [s, names] of [...bySubject].sort()) console.log(`${s}\n  ${names.join("  ")}\n`);
		console.log(`${all.length} recursos · \`my resources -h\` pros subverbos`);
		return 0;
	}

	const found: Resource[] = [];
	for (const arg of resto) {
		// NARROWING: `my resources project issues` — assunto, e depois o arquivo DENTRO
		// dele. Sem isto o segundo argumento fica decorativo, o que é pior que qualquer
		// das duas leituras: quem escreveu o nome de um arquivo pediu aquele arquivo.
		const dentro = found.filter((r) => r.name === arg);
		if (dentro.length) {
			found.length = 0;
			found.push(...dentro);
			continue;
		}

		// Assunto primeiro: `mkt_funnel` casa `mukutu/mkt_funnel` e traz a pasta toda.
		const bySubject = all.filter((r) => subject(r) === arg || subject(r).endsWith(`/${arg}`));
		if (bySubject.length) {
			found.push(...bySubject);
			continue;
		}
		const byName = all.filter((r) => r.name === arg || r.aliases.includes(arg));
		if (byName.length > 1) {
			console.error(
				`"${arg}" existe em ${byName.map((r) => relative(ROOT, r.path)).join(" e ")} — nome de recurso é único; renomeie um`,
			);
			return 1;
		}
		if (!byName.length) {
			console.error(
				`nenhum recurso "${arg}"\n\nos assuntos:\n  ${[...new Set(all.map(subject))].sort().join("  ")}`,
			);
			return 1;
		}
		found.push(byName[0]!);
	}

	// Dedup por CAMINHO: o assunto traz a pasta e o nome aponta o arquivo DENTRO dela,
	// então os dois argumentos casam o mesmo `.md` e ele sairia duas vezes. A ordem é a
	// do primeiro casamento — quem pediu o assunto primeiro vê o CONTEXT primeiro.
	const seen = new Set<string>();
	print(found.filter((r) => !seen.has(r.path) && seen.add(r.path)));
	return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
