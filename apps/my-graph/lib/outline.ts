//! UM CONTRATO, LIDO COMO ÁRVORE — e a prosa dele junto, que é a metade que o Outline
//! do VS Code não mostra.
//!
//! POR QUE O PARSER DE VERDADE AQUI, e regex no `extract.ts`. Lá a pergunta é "quais
//! arquivos e quais arestas" — doze declarações no topo, e um parser seria dependência
//! paga pra ler o que uma linha responde. Aqui a pergunta é a ESTRUTURA INTEIRA:
//! namespace dentro de namespace, membro de interface, o `type` que é folha e a
//! `interface` que é container. Regex erra isso, e erra em silêncio.
//!
//! `ts.createSourceFile` — o compilador já está em `devDependencies`, e ele responde a
//! árvore que o VS Code desenha porque é literalmente a mesma.
//!
//! A DOC VEM JUNTO DO SÍMBOLO, e é o ponto do arquivo. O Outline mostra a forma, o
//! hover mostra o porquê, e ninguém vê os dois ao mesmo tempo. Num repositório onde a
//! regra é "o comentário só sobrevive se impede uma redescoberta", ler a forma sem o
//! porquê é ler metade.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

/** O ÍCONE do VS Code, traduzido. Fechado: é a lista do que um contrato desta casa
 *  contém, e um `class` aqui seria notícia, não um caso a mais. */
export type SymbolKind = "interface" | "namespace" | "type" | "method" | "property" | "const";

export type OutlineNode = {
	name: string;
	kind: SymbolKind;
	/** A assinatura curta — `(id: NodeId): Promise<Detail>`. O que o Outline mostra em
	 *  cinza depois do nome, e o que decide se você precisa abrir o arquivo. */
	signature?: string;
	/** O JSDoc do símbolo, já sem os asteriscos. Vazio é comum e é informação: um verbo
	 *  óbvio não leva doc, e é regra escrita do `teams.ts`. */
	doc?: string;
	/** Opcional na origem — `role?: Role`. */
	optional?: boolean;
	children: OutlineNode[];
};

/** UMA SEÇÃO DO CABEÇALHO `//!`. O argumento do arquivo, que não pertence a símbolo
 *  nenhum e é a razão de metade destes contratos existirem. */
export type HeaderSection = { title: string; body: string };

export type Outline = {
	file: string;
	/** A primeira linha do `//!` — a frase que define o sistema. */
	tagline: string;
	sections: HeaderSection[];
	/** `implemented:`, `planned:`, `depends_on:` — os campos do rodapé do cabeçalho,
	 *  que são DADO e não prosa. */
	fields: Record<string, string>;
	symbols: OutlineNode[];
	counts: Record<SymbolKind, number>;
};

const DIR = process.env.MY_GRAPH_ROOT ?? join(process.cwd(), "..", "..", "packages", "interfaces");

/** Tira os `*` e o recuo do JSDoc. O texto é prosa e vai ser lido como prosa. */
function limpaDoc(raw: string): string {
	const linhas = raw
		.replace(/^\/\*\*?/, "")
		.replace(/\*\/$/, "")
		.split("\n")
		.map(l => l.replace(/^\s*\*\s?/, ""));
	// DEDENTA O BLOCO INTEIRO. A continuação de um JSDoc desta casa é ` *  texto` — dois
	// espaços, pra alinhar sob a primeira palavra. Tirando só o `* `, sobra UM espaço em
	// toda linha menos a primeira, e qualquer regra que trate "começa com espaço" como
	// bloco alinhado passa a ver lista onde há parágrafo.
	const corpo = linhas.filter(l => l.trim());
	const menor = corpo.reduce((m, l) => Math.min(m, l.length - l.trimStart().length), 99);
	return linhas.map(l => (l.trim() ? l.slice(menor) : l)).join("\n").trim();
}

function docDe(node: ts.Node, src: string): string | undefined {
	const ranges = ts.getLeadingCommentRanges(src, node.pos) ?? [];
	const jsdoc = ranges.filter(r => src.slice(r.pos, r.pos + 3) === "/**").at(-1);
	return jsdoc ? limpaDoc(src.slice(jsdoc.pos, jsdoc.end)) : undefined;
}

/** A assinatura SEM o corpo. Um método vira `(a: X): Y`, um type vira o lado direito —
 *  e um type longo é cortado, porque a lista é pra escanear, não pra ler. */
function assinatura(node: ts.Node, src: string): string | undefined {
	if (ts.isMethodSignature(node) || ts.isFunctionTypeNode(node)) {
		const params = node.parameters.map(p => src.slice(p.pos, p.end).trim()).join(", ");
		const ret = node.type ? `: ${src.slice(node.type.pos, node.type.end).trim()}` : "";
		return `(${params})${ret}`;
	}
	if (ts.isPropertySignature(node) && node.type) return src.slice(node.type.pos, node.type.end).trim();
	if (ts.isTypeAliasDeclaration(node)) {
		const t = src.slice(node.type.pos, node.type.end).trim().replace(/\s+/g, " ");
		return t.length > 120 ? `${t.slice(0, 117)}…` : t;
	}
	return undefined;
}

function nome(node: ts.Node): string | undefined {
	const n = (node as { name?: ts.Node }).name;
	return n && ts.isIdentifier(n as ts.Identifier) ? (n as ts.Identifier).text : undefined;
}

/** ANDA A ÁRVORE DO COMPILADOR e devolve só o que um leitor procura. Namespace,
 *  interface, type, membro — nada de import, nada de modifier. */
function colhe(node: ts.Node, src: string): OutlineNode[] {
	const out: OutlineNode[] = [];

	const visita = (n: ts.Node) => {
		const nm = nome(n);
		if (!nm) return ts.forEachChild(n, visita);

		if (ts.isModuleDeclaration(n)) {
			const corpo = n.body && ts.isModuleBlock(n.body) ? colhe(n.body, src) : [];
			out.push({ name: nm, kind: "namespace", doc: docDe(n, src), children: corpo });
			return;
		}
		if (ts.isInterfaceDeclaration(n)) {
			out.push({
				name: nm,
				kind: "interface",
				doc: docDe(n, src),
				children: n.members.flatMap(m => {
					const mn = nome(m);
					if (!mn) return [];
					return [{
						name: mn,
						kind: ts.isMethodSignature(m) ? ("method" as const) : ("property" as const),
						signature: assinatura(m, src),
						doc: docDe(m, src),
						optional: !!(m as ts.PropertySignature).questionToken,
						children: [],
					}];
				}),
			});
			return;
		}
		if (ts.isTypeAliasDeclaration(n)) {
			out.push({ name: nm, kind: "type", signature: assinatura(n, src), doc: docDe(n, src), children: [] });
			return;
		}
		if (ts.isVariableDeclaration(n)) {
			out.push({ name: nm, kind: "const", doc: docDe(n.parent.parent, src), children: [] });
			return;
		}
		ts.forEachChild(n, visita);
	};

	ts.forEachChild(node, visita);
	return out;
}

/** O CABEÇALHO `//!` PARTIDO EM SEÇÕES. As barras de caixa alta (`── TÍTULO ──`) são a
 *  convenção que esta casa já usa pra separar argumento de argumento; ler isso é ler a
 *  estrutura que o autor já escreveu, em vez de inventar uma. */
function cabecalho(linhas: string[]): { tagline: string; sections: HeaderSection[]; fields: Record<string, string> } {
	const bang = linhas.filter(l => l.startsWith("//!")).map(l => l.replace(/^\/\/!\s?/, ""));
	const fields: Record<string, string> = {};
	const sections: HeaderSection[] = [];
	let atual: HeaderSection | null = null;
	let tagline = "";

	for (const l of bang) {
		const campo = l.match(/^(\w[\w ]*):\s{2,}(.+)$/);
		if (campo) { fields[campo[1].trim()] = campo[2].trim(); continue; }
		const titulo = l.match(/^──+\s*(.+?)\s*──+$/);
		if (titulo) { atual = { title: titulo[1], body: "" }; sections.push(atual); continue; }
		if (!tagline && l.trim()) { tagline = l.trim(); continue; }
		if (atual) atual.body += `${l}\n`;
		else if (l.trim()) {
			// Prosa antes da primeira barra: é o argumento de abertura e merece seção.
			atual = { title: "", body: `${l}\n` };
			sections.push(atual);
		}
	}
	for (const s of sections) s.body = s.body.trim();
	return { tagline, sections: sections.filter(s => s.body), fields };
}

export function outline(id: string): Outline | undefined {
	const file = `${id}.ts`;
	let texto: string;
	try {
		texto = readFileSync(join(DIR, file), "utf8");
	} catch {
		return undefined;
	}
	const src = ts.createSourceFile(file, texto, ts.ScriptTarget.ES2022, true);
	const symbols = colhe(src, texto);
	const counts = { interface: 0, namespace: 0, type: 0, method: 0, property: 0, const: 0 } as Record<SymbolKind, number>;
	const conta = (ns: OutlineNode[]) => {
		for (const n of ns) { counts[n.kind]++; conta(n.children); }
	};
	conta(symbols);
	return { file, ...cabecalho(texto.split("\n")), symbols, counts };
}
