//! A VISTA DE UM CONTRATO. O Outline do VS Code mostra a FORMA; o hover mostra o
//! PORQUÊ; ninguém vê os dois ao mesmo tempo. Aqui a doc mora colada no símbolo, e é a
//! única coisa que esta tela faz de diferente de um editor.
//!
//! O ARGUMENTO VEM ANTES DO TIPO. Num repositório onde a regra é "o comentário só
//! sobrevive se impede uma redescoberta", o cabeçalho `//!` não é preâmbulo: é a metade
//! que decide se o resto faz sentido. Por isso ele é o herói, e a árvore vem depois.
//!
//! SEM ÍCONE, de propósito. O VS Code usa glifo porque a árvore dele é estreita; aqui
//! cabe a PALAVRA — `interface`, `namespace`, `type` — que já é o vocabulário e
//! dispensa legenda.
//!
//! Símbolo sem doc não mostra nada, e o vazio é legível: `teams.ts` manda "verbo óbvio
//! não leva doc", então a ausência é informação e não buraco.

import type { Outline, OutlineNode, SymbolKind } from "@/lib/outline";
import { headers } from "next/headers";

const COR: Record<SymbolKind, string> = {
	interface: "text-[#a277ff]",
	namespace: "text-[#82e2ff]",
	type: "text-[#61ffca]",
	method: "text-[#edecee]",
	property: "text-[#c9c5cf]",
	const: "text-[#ffca85]",
};

async function pega(id: string): Promise<Outline | undefined> {
	const h = await headers();
	const host = h.get("host") ?? "localhost:4173";
	const r = await fetch(`http://${host}/api/outline?id=${encodeURIComponent(id)}`, { cache: "no-store" });
	return r.ok ? ((await r.json()) as Outline) : undefined;
}

/** O TEXTO DO FONTE REFLUÍDO. O `//!` quebra em 88 colunas porque é código; na tela
 *  essa quebra vira frase picotada no meio. Então: linha em branco separa parágrafo,
 *  e dentro do parágrafo as linhas se juntam.
 *
 *  LINHA QUE COMEÇA COM `·`, `-` OU ESPAÇO NÃO SE JUNTA — é lista ou bloco alinhado, e
 *  refluir isso destrói a única estrutura que o autor desenhou à mão. */
function paragrafos(texto: string): string[][] {
	const out: string[][] = [];
	let atual: string[] = [];
	for (const linha of texto.split("\n")) {
		if (!linha.trim()) {
			if (atual.length) out.push(atual);
			atual = [];
			continue;
		}
		const preserva = /^[\s·-]/.test(linha);
		if (preserva || !atual.length) atual.push(linha.trimEnd());
		else if (/^[\s·-]/.test(atual[atual.length - 1])) atual.push(linha.trimEnd());
		else atual[atual.length - 1] += ` ${linha.trim()}`;
	}
	if (atual.length) out.push(atual);
	return out;
}

/** Crase é código e vai renderizada; `**` é ênfase e vira peso, não asterisco na tela.
 *  Nada mais — um renderizador de markdown inteiro aqui seria uma dependência pra ler
 *  duas marcas que esta casa realmente usa. */
function Inline({ texto }: { texto: string }) {
	const partes = texto.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
	return (
		<>
			{partes.map((p, i) => {
				if (p.startsWith("`") && p.endsWith("`"))
					return (
						<code key={i} className="rounded bg-[#241f2e] px-1.5 py-0.5 font-mono text-[0.88em] text-[#a277ff]">
							{p.slice(1, -1)}
						</code>
					);
				if (p.startsWith("**") && p.endsWith("**"))
					return (
						<strong key={i} className="font-semibold text-[#edecee]">
							{p.slice(2, -2)}
						</strong>
					);
				return <span key={i}>{p}</span>;
			})}
		</>
	);
}

function Prosa({ texto, className = "" }: { texto: string; className?: string }) {
	return (
		<div className={className}>
			{paragrafos(texto).map((linhas, i) => (
				<p key={i} className={i ? "mt-3.5" : ""}>
					{linhas.map((l, j) => (
						<span key={j} className={/^[\s·-]/.test(l) ? "block whitespace-pre" : ""}>
							<Inline texto={l} />
						</span>
					))}
				</p>
			))}
		</div>
	);
}

function Simbolo({ n, nivel }: { n: OutlineNode; nivel: number }) {
	return (
		<li className="relative">
			{/* A GUIA. Um fio por nível, e é o que o olho segue quando um namespace tem
			    doze filhos — a indentação sozinha some depois do terceiro. */}
			<div className="group grid grid-cols-[auto_1fr] gap-x-4 py-2.5">
				<span
					className="select-none pt-[3px] font-mono text-[10px] uppercase tracking-[0.18em] text-[#6d6d6d]"
					style={{ minWidth: "5.5rem" }}
				>
					{n.kind}
				</span>
				<div className="min-w-0">
					<h3 className="font-mono text-[15px] leading-snug">
						<span className={COR[n.kind]}>{n.name}</span>
						{n.optional && <span className="text-[#6d6d6d]">?</span>}
						{n.signature && (
							<span className="ml-2 break-words text-[13px] text-[#6d6d6d]">{n.signature}</span>
						)}
					</h3>
					{n.doc && (
						<Prosa
							texto={n.doc}
							className="mt-1.5 max-w-[64ch] text-[13.5px] leading-[1.62] text-[#b6b1bf]"
						/>
					)}
				</div>
			</div>
			{n.children.length > 0 && (
				<ul className="ml-[5.5rem] border-l border-[#2b2635] pl-6">
					{n.children.map(c => (
						<Simbolo key={`${n.name}.${c.name}`} n={c} nivel={nivel + 1} />
					))}
				</ul>
			)}
		</li>
	);
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const o = await pega(id);

	if (!o) {
		return (
			<main className="mx-auto max-w-2xl px-6 py-24 text-[#edecee]">
				<p className="font-mono text-sm text-[#ff6767]">sem contrato “{id}”</p>
				<p className="mt-2 text-sm text-[#6d6d6d]">
					A pasta lida é a do <code className="font-mono">MY_GRAPH_ROOT</code> do servidor.
				</p>
			</main>
		);
	}

	const total = o.counts.interface + o.counts.namespace + o.counts.type;

	return (
		<main className="min-h-screen bg-[#15141b] text-[#edecee]">
			<div className="mx-auto max-w-[68rem] px-6 py-14 md:px-12 md:py-20">
				{/* HERÓI: o argumento, não o nome. O nome cabe numa linha; a tese é o que
				    justifica o arquivo existir. */}
				<header className="border-b border-[#2b2635] pb-12">
					<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
						<span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#6d6d6d]">
							interface view
						</span>
						<h1 className="font-mono text-[2.6rem] leading-none tracking-tight text-[#a277ff] md:text-[3.4rem]">
							{id}
						</h1>
					</div>
					<p className="mt-6 max-w-[60ch] text-[19px] leading-[1.5] text-[#edecee] md:text-[22px]">
						<Inline texto={o.tagline.replace(/^`[^`]+`\s*—\s*/, "")} />
					</p>
					<dl className="mt-10 flex flex-wrap gap-x-10 gap-y-3 font-mono text-[11px] uppercase tracking-[0.16em]">
						{(
							[
								["interfaces", String(o.counts.interface)],
								["tipos", String(o.counts.type)],
								["verbos", String(o.counts.method)],
								["campos", String(o.counts.property)],
							] as const
						).map(([k, v]) => (
							<div key={k} className="flex items-baseline gap-2">
								<dd className="text-[15px] tracking-normal text-[#61ffca]">{v}</dd>
								<dt className="text-[#6d6d6d]">{k}</dt>
							</div>
						))}
					</dl>
				</header>

				{/* O ARGUMENTO. Uma seção por barra do cabeçalho — a estrutura que o autor
				    já escreveu, lida em vez de reinventada. */}
				{o.sections.length > 0 && (
					<section className="border-b border-[#2b2635] py-12">
						<div className="grid gap-12">
							{o.sections.map(s => (
								<article key={s.title || s.body.slice(0, 24)}>
									{s.title && (
										<h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[#82e2ff]">
											{s.title}
										</h2>
									)}
									<Prosa
										texto={s.body}
										className="max-w-[70ch] text-[14.5px] leading-[1.7] text-[#b6b1bf]"
									/>
								</article>
							))}
						</div>
					</section>
				)}

				{/* OS CAMPOS. Dado, não prosa — por isso tabela e não parágrafo. */}
				{Object.keys(o.fields).length > 0 && (
					<section className="border-b border-[#2b2635] py-10">
						<dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[10rem_1fr]">
							{Object.entries(o.fields).map(([k, v]) => (
								<div key={k} className="contents">
									<dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#6d6d6d]">{k}</dt>
									<dd className="font-mono text-[13px] leading-relaxed text-[#b6b1bf]">{v}</dd>
								</div>
							))}
						</dl>
					</section>
				)}

				{/* A ÁRVORE. Mesma ordem do arquivo: a sequência é do autor. */}
				<section className="py-12">
					<h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#6d6d6d]">
						a forma
					</h2>
					<ul>
						{o.symbols.map(n => (
							<Simbolo key={n.name} n={n} nivel={0} />
						))}
					</ul>
				</section>
			</div>
		</main>
	);
}
