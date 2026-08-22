//! `Resources` (@biliboss/interfaces/resources.ts), implementado.
//!
//! ── ASSÍNCRONO, E O CONTRATO DIZ SÍNCRONO ───────────────────────────────────
//!
//! Sexta correção de contrato desta casa pelo mesmo motivo, e a mais barata de
//! errar: `Resources` declara `read()`, `list()` e `search()` retornando array cru.
//! Um `.ts` embarcado é carregado por `import()` DINÂMICO — é a única forma de
//! descobrir por varredura sem uma lista de inscrição — e `import()` devolve
//! promessa. Não existe versão síncrona disso.
//!
//! O contrato foi corrigido no mesmo commit em que isto nasceu, e não depois: uma
//! assinatura síncrona aqui é mentira que só aparece no primeiro `await` esquecido,
//! e o valor de implementar contra contrato é justamente RECUSÁ-LO onde ele mente.
//!
//! ── AS TRÊS LENTES SÃO TRÊS FILTROS, e é o ponto inteiro ────────────────────
//!
//! `hustler`, `hacker` e `hipster` leem o MESMO índice. Nenhuma tem loja, nenhuma
//! tem pasta própria, nenhuma pode divergir — porque não há o que divergir. Foi
//! exatamente a lição de `packages/my-hacker`, que virou pacote e morreu por isso
//! (@21dbf12).
//!
//! ── `unread` PRECISA DO SINK, e não tem um ainda ────────────────────────────
//!
//! `Resources extends UsageLogging`, e `unread(since)` só responde se `read()`
//! estiver gravando span. O sink desta casa é `shared/telemetry.ts`, que mora no
//! `my` — este pacote não pode importar um app. Então `uses()` e `unread()`
//! devolvem `[]` e DIZEM que devolvem: leitura não registrada não é "ninguém leu",
//! e as duas se parecem exatamente igual num array vazio.
//!
//! O dia em que o telemetry subir pra um pacote, isto vira três linhas. Está escrito
//! aqui pra ser um pedido em vez de um silêncio.
//!
//! depends_on: ./store.ts · ./resource.ts · @biliboss/interfaces/resources.ts

import { LENSES, type Finding, type ResourceSystem } from "@biliboss/interfaces/resources.ts";
import type { Shared } from "@biliboss/interfaces/shared.ts";
import type { Resource } from "./resource.ts";
import { index } from "./store.ts";

type Nome = ResourceSystem.ValueObjects.ResourceName;
type Kind = ResourceSystem.ValueObjects.Kind;
type Lens = keyof typeof LENSES;

/** Um nome casa pelo nome OU por um alias. Sem isto, `interview` — o nome que o
 *  vocabulário dos processos cita — não acharia `askuser.md`, que é a única página
 *  desta casa com aliases (medido 20/08). */
const casa = (r: Resource, nome: string) =>
	r.name === nome || r.aliases.includes(nome) || r.name.endsWith(`/${nome}`);

export const read = async (nomes: Nome[]): Promise<Resource[]> => {
	const todos = await index();
	// A ORDEM É A DOS NOMES PEDIDOS, não a do índice: quem pede cinco recursos vai
	// colar os cinco num prompt, e a ordem em que pediu é a ordem em que pensou.
	return nomes.flatMap((n) => todos.filter((r) => casa(r, n)));
};

export const list = async (kind?: Kind): Promise<Resource[]> =>
	(await index()).filter((r) => !kind || r.kind === kind);

/** Sem índice e sem ranking. Se um dia precisar dos dois, a resposta é o `FULLTEXT`
 *  do SurrealDB via `my-labels`, não um ranking escrito à mão aqui. */
export async function search(termo: string): Promise<Resource[]> {
	const t = termo.toLowerCase();
	return (await index()).filter((r) => r.name.toLowerCase().includes(t) || r.body.toLowerCase().includes(t));
}

export const processes = (): Promise<Resource[]> => list("processes");
export const templates = (): Promise<Resource[]> => list("templates");

/** Toda `mentions` aponta pra recurso que existe. É o check que fazia o antigo verbo
 *  `references` valer a pena, agora aplicado a todos. */
export async function check(): Promise<Finding[]> {
	const todos = await index();
	const achados: Finding[] = [];
	for (const r of todos) {
		for (const m of r.mentions) {
			if (!todos.some((x) => casa(x, m))) {
				achados.push({ path: r.path || r.name, says: `menciona \`${m}\`, que não é recurso desta casa` });
			}
		}
	}
	return achados;
}

/** NÃO REGISTRADO, e isto não é `[]` de "ninguém leu" — ver o cabeçalho. */
export const uses = (): Shared.Use[] => [];
export const unread = (_since: Shared.Instant): Shared.Use[] => [];

const daLente = async (lens: Lens): Promise<Resource[]> => (await index()).filter((r) => r.lens === lens);

/** UMA LENTE É UM FILTRO, e as sub-perguntas são o `asks` do contrato — dados, não
 *  prosa. `term` filtra por palavra dentro da lente; `reads` já decidiu quem entra. */
async function pergunta(lens: Lens, chave: string): Promise<Resource[]> {
	const cfg = (LENSES[lens].asks ?? {}) as Record<string, { term?: string }>;
	const term = cfg[chave]?.term;
	const base = await daLente(lens);
	if (!term) return base;
	const re = new RegExp(term, "i");
	return base.filter((r) => re.test(r.body));
}

export const hustler = {
	all: () => daLente("hustler"),
	promises: (client?: string) =>
		pergunta("hustler", "promises").then((rs) => (client ? rs.filter((r) => r.body.toLowerCase().includes(client.toLowerCase())) : rs)),
	offers: () => pergunta("hustler", "offers"),
};

export const hacker = {
	all: () => daLente("hacker"),
	gotchas: () => pergunta("hacker", "gotchas"),
	decisions: () => pergunta("hacker", "decisions"),
};

export const hipster = {
	all: () => daLente("hipster"),
	tokens: () => pergunta("hipster", "tokens"),
	voice: () => pergunta("hipster", "voice"),
};

export { index, home } from "./store.ts";
export { resource, short, type Resource } from "./resource.ts";
