//! O ÚNICO índice de conhecimento desta casa, e as três lentes sobre ele.
//!
//! LIB, não comando: quem tem porta é cada subverbo ao lado (`read.ts`, `list.ts`, as
//! pastas das lentes). Aqui mora o que todos eles compartilham — achar o `.md`, dizer
//! de que KIND ele é, e resolver um nome sem caminho.
//!
//! ## `references` VIROU UM KIND (20/08)
//!
//! Eram dois verbos, `my resources` e `my references`, e a fronteira entre eles era
//! prosa no cabeçalho de cada um: "aquilo é do sistema, isto é do mundo". Duas
//! vocabulários pra uma pergunta só — quem procurava tinha que saber qual antes de
//! procurar, e medido em 19/08 o `-g` do primeiro já varria o segundo porque a divisão
//! não sobrevivia a "isto já está escrito em algum lugar?".
//!
//! O kind é o CAMINHO, não um campo: `.md` dentro de uma pasta `references/` (em
//! qualquer profundidade, em qualquer lugar do repo) é kind `references`; o resto de
//! `03_resources/<pasta>/` leva o nome da pasta. É a mesma regra dos dois índices
//! antigos somada, e é por isso que `my references <nome>` continua achando a página
//! que mora dentro de um workflow.
//!
//! ## O NOME é a chave, e ele é único
//!
//! Citação nesta casa diz o nome, nunca o caminho — é o que deixa um workflow citar a
//! referência de outro e sobreviver a uma mudança de pasta. Repetido não é sorteio:
//! `resolve` derruba com os DOIS caminhos. E o índice NÃO derruba mais só por existir
//! (o `assertUnique` do antigo `references.ts` fazia isso): ele passou a cobrir
//! `rules/` e `templates/`, onde `system_design` legitimamente existe duas vezes, e um
//! índice que joga tira do ar as 250 páginas por causa de duas.
//!
//! ## O SPAN por nome lido, e por que ele existe
//!
//! `read()` abre um span POR NOME, com o nome do recurso no lugar do verbo — é o que
//! faz `unread(since)` ser medição em vez de opinião. O sink é um JSONL fora do repo
//! (`~/.me/spans.jsonl`), porque cada chamada do `my` é um processo novo e um sink em
//! memória responderia "ninguém leu nada" pra sempre.
//!
//! depends_on: src/interfaces/resources.ts · src/shared/telemetry.ts · 03_resources/
//! impacts:    src/check/references.ts · 03_resources/CONTEXT.md · 02_areas/00_workflows/00_main/03_qa/references/qa_driver.md

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import {
	KINDS,
	LENSES,
	STACK,
	type Finding,
	type Hacker,
	type Hipster,
	type Hustler,
	type ResourceSystem,
	type Resources,
} from "@biliboss/interfaces/resources.ts";
import type { Shared } from "@biliboss/interfaces/shared.ts";
import { home, repoRoot } from "../shared/file.ts";
import { MemorySpanSink, Telemetry, type SpanSink } from "../shared/telemetry.ts";

export type Resource = ResourceSystem.Entities.Resource;
export type Kind = ResourceSystem.ValueObjects.Kind;
export type Lens = ResourceSystem.ValueObjects.Lens;

export const ROOT = home();
export const RESOURCES = join(ROOT, "03_resources");
/** Um processo é uma PASTA com `CONTEXT.md` — o mesmo caminho que `src/meta.ts` lê. */
const WORKFLOWS = join(ROOT, "02_areas", "00_workflows");

/** Pastas que nunca guardam conhecimento da casa: dependência de terceiro, artefato de
 *  build, e a saída de um run. Sem a poda, um `resources/` de build do Tauri entra no
 *  índice e inventa nome duplicado. */
const PRUNE = new Set(["node_modules", ".git", "target", "dist", "build", "output", "_runs", "_events"]);

// ─── o índice ───────────────────────────────────────────────────────────────────

/** `aliases: a, b` ou uma lista YAML no front matter. Sem front matter, vazio. */
function readAliases(head: string): string[] {
	const fm = head.match(/^---\n([\s\S]*?)\n---/);
	if (!fm) return [];
	const line = fm[1]!.match(/^aliases:\s*(.*)$/m);
	if (!line) return [];
	const inline = line[1]!.trim();
	if (inline)
		return inline
			.replace(/^\[|\]$/g, "")
			.split(",")
			.map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
			.filter(Boolean);
	return [...fm[1]!.matchAll(/^aliases:\n((?:\s*-\s*.+\n?)+)/m)]
		.flatMap((m) => m[1]!.split("\n"))
		.map((l) => l.replace(/^\s*-\s*/, "").trim().replace(/^['"]|['"]$/g, ""))
		.filter(Boolean);
}

/** O que uma página CITA, na gramática de citação desta casa: o verbo mais o nome.
 *  `my meta resources <x>`, `my references <x>` e `my resources <x>` caem todos aqui —
 *  o que casa é o `<verbo> <nome>` no fim, então o prefixo do runner não importa. */
const MENTION = /\bmy (?:meta\s+)?(?:references|resources)\s+(?!--|-)([a-z0-9_]+)/g;

/** As menções fora de bloco de código. Um fence é EXEMPLO da sintaxe, não travessia —
 *  a própria `010_references.md` ensina o comando num ```bash, e sem esta guarda o
 *  documento que define a regra apareceria violando a regra. */
function mentionsOf(body: string): string[] {
	const out = new Set<string>();
	let fenced = false;
	for (const line of body.split("\n")) {
		if (line.trimStart().startsWith("```")) {
			fenced = !fenced;
			continue;
		}
		if (fenced) continue;
		for (const m of line.matchAll(MENTION)) out.add(m[1]!);
	}
	return [...out];
}

function mds(dir: string, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		if (e.name.startsWith(".") || PRUNE.has(e.name)) continue;
		const child = join(dir, e.name);
		if (e.isDirectory()) mds(child, out);
		else if (e.name.endsWith(".md")) out.push(child);
	}
	return out;
}

/** Toda pasta `references/` ou `resources/` do repo, em qualquer profundidade. É o
 *  escopo do antigo `my references`, preservado inteiro. */
function refFolders(dir: string, out: string[] = []): string[] {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		if (!e.isDirectory() || e.name.startsWith(".") || PRUNE.has(e.name)) continue;
		const child = join(dir, e.name);
		if (e.name === "references" || e.name === "resources") out.push(child);
		else refFolders(child, out);
	}
	return out;
}

/** O kind sai do CAMINHO: dentro de uma pasta `references/`, é `references`; senão é a
 *  primeira pasta abaixo de `03_resources/`. Aberto de propósito — a pasta que alguém
 *  criar amanhã chega como ela mesma em vez de virar "outros". */
function kindOf(path: string, root: string): Kind {
	const segs = relative(root, path).split("/");
	const dirs = segs.slice(0, -1);
	if (dirs.includes("references") || dirs.includes("resources")) return "references";
	return segs[0] === "03_resources" ? (segs[1] ?? "references") : "references";
}

function resourceAt(path: string, root: string, name = basename(path, ".md")): Resource {
	const body = readFileSync(path, "utf8");
	return {
		name,
		kind: kindOf(path, root),
		path,
		body,
		mentions: mentionsOf(body),
		aliases: readAliases(body.slice(0, 512)),
	};
}

/** A STACK como recurso: ela é conhecimento que todo agente pergunta e que nunca teve
 *  arquivo — morava numa janela de chat, e virou constante no contrato. Sintética,
 *  então, mas não inventada: o corpo é a constante renderizada, e o `path` aponta pro
 *  arquivo onde ela de fato mora. Sem isto, `STACK` seria configuração que ninguém lê. */
function stackResource(): Resource {
	const body = [
		"# stack",
		"",
		"O que esta casa usa quando ninguém disse o contrário. Mora em `packages/interfaces/resources.ts`.",
		"",
		...Object.entries(STACK).map(([k, v]) => `- **${k}** — ${v}`),
		"",
	].join("\n");
	return {
		name: "stack",
		kind: "references",
		// TRÊS RAÍZES E ESTA É A DO CHECKOUT. `home()` é a casa, `code()` é o pacote
		// (`apps/my_cli/`), e `packages/interfaces/` não está em nenhuma das duas: ela
		// é irmã do pacote, na raiz do monorepo. É o único lugar do fonte que precisa
		// da terceira, e é por isso que `repoRoot()` continua existindo.
		path: join(repoRoot(), "packages/interfaces/resources.ts"),
		body,
		mentions: [],
		aliases: [],
	};
}

let cache: Resource[] | undefined;

/** Tudo que esta casa sabe, achado no disco. `raiz` existe pro TESTE — apontar o índice
 *  pra uma fixture é o que prova as regras sem depender do estado do repo. */
export function index(raiz?: string): Resource[] {
	if (raiz === undefined && cache) return cache;
	const root = raiz ?? ROOT;
	const resources = join(root, "03_resources");
	const seen = new Set<string>();
	const out: Resource[] = [];

	const push = (path: string, name?: string) => {
		if (seen.has(path)) return;
		seen.add(path);
		out.push(resourceAt(path, root, name));
	};

	// 1 · as referências, onde quer que morem. `CONTEXT.md` fica de fora: é o mapa da
	// pasta, e é o único nome que se repete por DESIGN — incluí-lo tornaria todo nome de
	// referência ambíguo.
	//
	// SALVO QUANDO NÃO HÁ O QUE MAPEAR. Um `CONTEXT.md` sozinho na subárvore é a página,
	// não o mapa dela, e medido em 20/08 são três: `references/scripts/system`,
	// `references/skills/drip` e `references/acme/contracts` — a última é a ÚNICA
	// página de promessa a cliente que esta casa tem, e a regra cega fazia
	// `my resources hustler promises` devolver zero com o arquivo ali. Entra pelo nome da
	// PASTA, como um processo.
	for (const folder of refFolders(root))
		for (const path of mds(folder)) {
			if (basename(path) !== "CONTEXT.md") push(path);
			else if (mds(dirname(path)).length === 1) push(path, basename(dirname(path)));
		}

	// 2 · o resto de `03_resources/`, com o nome da pasta como kind.
	for (const path of mds(resources)) if (basename(path) !== "CONTEXT.md") push(path);

	// 3 · os processos: a pasta é o processo, e o `CONTEXT.md` dela é o corpo. É a única
	// exceção à linha acima, e é o que `src/meta.ts` já assumia sobre este caminho.
	const workflows = join(root, "02_areas", "00_workflows");
	if (existsSync(workflows))
		for (const domain of readdirSync(workflows, { withFileTypes: true })) {
			if (!domain.isDirectory() || domain.name.startsWith(".")) continue;
			for (const step of readdirSync(join(workflows, domain.name), { withFileTypes: true })) {
				if (!step.isDirectory() || step.name === "references" || step.name === "resources") continue;
				const ctx = join(workflows, domain.name, step.name, "CONTEXT.md");
				if (existsSync(ctx)) {
					seen.add(ctx);
					const body = readFileSync(ctx, "utf8");
					out.push({
						name: step.name,
						kind: "processes",
						path: ctx,
						body,
						mentions: mentionsOf(body),
						aliases: [],
					});
				}
			}
		}

	if (raiz === undefined) out.push(stackResource());
	out.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
	if (raiz === undefined) cache = out;
	return out;
}

/** O nome, e o caminho da pasta até ele a partir de `03_resources/` — `mukutu/mkt_funnel`
 *  e não só `mkt_funnel`, porque um cliente pode ter vários produtos. Fora de
 *  `03_resources/` (um workflow, um projeto) é o caminho a partir da raiz do repo. */
export function subject(r: Resource): string {
	const dir = dirname(r.path);
	return dir.startsWith(RESOURCES) ? relative(RESOURCES, dir) || "." : relative(ROOT, dir);
}

/** O nome resolve, e AMBÍGUO derruba com os dois caminhos. Nome primeiro, alias depois:
 *  o nome do arquivo ganha de um alias de outra página, e assim renomear nunca é
 *  sequestrado por um sinônimo alheio. */
export function resolve(name: string, all = index()): Resource {
	const hits = all.filter((r) => r.name === name);
	const found = hits.length ? hits : all.filter((r) => r.aliases.includes(name));
	if (!found.length) throw new Error(`nenhum recurso chamado "${name}"`);
	if (found.length > 1)
		throw new Error(
			`"${name}" existe em ${found.map((r) => relative(ROOT, r.path)).join(" e ")} — nome de recurso é único; renomeie um`,
		);
	return found[0]!;
}

const under = (r: Resource, prefixes: readonly string[]) =>
	prefixes.some((p) => {
		const full = join(RESOURCES, p);
		return r.path === full || r.path.startsWith(`${full}/`);
	});

// ─── o sink dos spans ───────────────────────────────────────────────────────────

/** JSONL, e FORA do repo: `~/.me/`, a mesma casa do `me.db`. Um span por linha, append
 *  puro — é a escrita que não precisa de lock entre dois `my` rodando ao mesmo tempo.
 *  `ME_SPANS` sobrescreve, e é o que deixa o teste medir sem sujar o arquivo real. */
export const spansPath = (): string => process.env.ME_SPANS ?? join(process.env.HOME!, ".me", "spans.jsonl");

export class JsonlSpanSink implements SpanSink {
	constructor(readonly path = spansPath()) {}

	append(span: Shared.Span): void {
		mkdirSync(dirname(this.path), { recursive: true });
		appendFileSync(this.path, `${JSON.stringify(span)}\n`);
	}

	read(since?: Shared.Instant): readonly Shared.Span[] {
		if (!existsSync(this.path)) return [];
		return readFileSync(this.path, "utf8")
			.split("\n")
			.filter(Boolean)
			.map((l) => JSON.parse(l) as Shared.Span)
			.filter((s) => !since || s.at >= since);
	}
}

/** QUEM leu. O agente se identifica por `ME_BY`; sem isso, o usuário da máquina. */
const by = () => process.env.ME_BY ?? process.env.USER ?? "cli";

// ─── as lentes ──────────────────────────────────────────────────────────────────

/** Uma pergunta de lente: as pastas onde ela olha, ou o termo que ela procura DENTRO
 *  do que a lente lê. As duas formas existem porque as duas são verdade — @LENSES. */
type Ask = { readonly in?: readonly string[]; readonly term?: string };

function ask(lens: Lens, question: string, narrow?: string): Resource[] {
	const conf = LENSES[lens];
	const a = (conf.asks as Record<string, Ask>)[question];
	const scope = index().filter((r) => under(r, a?.in ?? conf.reads));
	const found = a?.term ? scope.filter((r) => new RegExp(a.term!, "i").test(r.body)) : scope;
	return narrow ? found.filter((r) => new RegExp(narrow, "i").test(`${r.name} ${r.path} ${r.body}`)) : found;
}

const all = (lens: Lens): Resource[] => index().filter((r) => under(r, LENSES[lens].reads));

// ─── a loja ─────────────────────────────────────────────────────────────────────

/** ESTENDE `Telemetry` em vez de guardar uma: `Resources extends UsageLogging` no
 *  contrato, e delegar seis métodos a um campo seria escrever o que a herança já diz. */
export class Store extends Telemetry implements Resources {
	constructor(sink: SpanSink = new JsonlSpanSink()) {
		super(sink);
	}

	/** Toda citação aponta pra coisa que existe. O ASSUNTO conta junto do nome porque o
	 *  verbo resolve os dois — `my resources mkt_funnel` pede a pasta inteira, e tratá-lo
	 *  como nome quebrado seria o check acusando a própria gramática. */
	check(): Finding[] {
		const nomes = new Set(index().flatMap((r) => [r.name, ...r.aliases, ...subject(r).split("/")]));
		const out: Finding[] = [];
		for (const r of index())
			for (const cita of r.mentions)
				if (!nomes.has(cita))
					out.push({ path: relative(ROOT, r.path), says: `menciona \`${cita}\`, que não é recurso desta casa` });
		return out;
	}

	/** N de uma vez, e UM SPAN POR NOME — o span é o que `unread` lê depois. Ler um por
	 *  chamada é como um agente gasta uma janela de contexto em índice. */
	read(names: string[]): Resource[] {
		const all = index();
		// Resolve TODOS antes de abrir span nenhum: um nome errado no meio da lista não
		// pode deixar metade da leitura registrada.
		const found = names.map((n) => resolve(n, all));
		return found.map((r) => this.around(r.name, by(), () => r));
	}

	list(kind?: Kind): Resource[] {
		return kind ? index().filter((r) => r.kind === kind) : index();
	}

	search(term: string): Resource[] {
		const re = new RegExp(term, "i");
		return index().filter((r) => re.test(r.name) || re.test(r.body));
	}

	processes(): Resource[] {
		return this.list("processes");
	}

	templates(): Resource[] {
		return this.list("templates");
	}

	/** O QUE NINGUÉM ABRIU desde `since`. É `dead()` com o catálogo carregado de nomes de
	 *  recurso em vez de nomes de verbo: mesma pergunta, mesma sink, outro assunto. O
	 *  `first_seen` é o mtime do arquivo — a data em que a página passou a existir pra
	 *  quem procura, e o único carimbo que o disco realmente tem. */
	unread(since: Shared.Instant): Shared.Use[] {
		this.catalog(index().map((r) => ({ what: r.name, first_seen: statSync(r.path).mtime.toISOString() })));
		return [...this.dead(since)];
	}

	hustler: Hustler = {
		all: () => all("hustler"),
		promises: (client?: string) => ask("hustler", "promises", client),
		offers: () => ask("hustler", "offers"),
	};

	hacker: Hacker = {
		all: () => all("hacker"),
		gotchas: (about?: string) => ask("hacker", "gotchas", about),
		decisions: () => ask("hacker", "decisions"),
	};

	hipster: Hipster = {
		all: () => all("hipster"),
		product: () => ask("hipster", "product"),
		system: () => ask("hipster", "system"),
		voice: () => ask("hipster", "voice"),
	};
}

/** A loja do processo. Um sink de arquivo, uma vez — quem testa passa o seu. */
export const store = new Store();

/** Pro teste: uma loja que não escreve no JSONL de verdade. */
export const memoryStore = () => new Store(new MemorySpanSink());

export { KINDS, LENSES, STACK };

// ─── impressão ──────────────────────────────────────────────────────────────────

/** VERBATIM, nunca resumo: quem pede uma página quer a página. O cabeçalho carrega o
 *  caminho porque quem leu quer poder editar. */
export function print(rs: Resource[]): void {
	for (const r of rs) {
		console.log(`\n=== ${r.name} · ${relative(ROOT, r.path)}\n`);
		console.log(r.body.trimEnd());
	}
}

/** UMA LINHA POR RECURSO, que é o grão de quem vai escolher o próximo a abrir: o nome
 *  é o que se cita, o caminho é o que se edita. */
export function printNames(rs: Resource[]): number {
	for (const r of rs) console.log(`${r.name.padEnd(34)} ${relative(ROOT, r.path)}`);
	console.log(`\n${rs.length} recurso(s)`);
	return rs.length ? 0 : 1;
}

/** O erro CARREGA o mapa: quem errou o nome não precisa de um segundo comando. */
export function naoAchou(e: unknown): number {
	console.error(`${(e as Error).message}\n\nos assuntos:\n  ${[...new Set(index().map(subject))].sort().join("  ")}`);
	return 1;
}
