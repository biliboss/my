//! O ÍNDICE: os `.ts` que este pacote embarca, mais o markdown da casa que o
//! `MY_HOME` aponta. Uma lista, duas fontes, precedência escrita.
//!
//! ── POR QUE DUAS FONTES E NÃO DUAS LOJAS ────────────────────────────────────
//!
//! O que o `21dbf12` matou foi UMA LOJA POR LENTE — `packages/my-hacker` com o
//! próprio store, que é a coisa que `resources.ts` recusa um nível acima: três
//! leituras de uma loja, nunca três lojas. Isto aqui é o contrário: UMA lista, e as
//! três lentes continuam sendo três perguntas sobre ela.
//!
//! As duas fontes existem porque as duas coisas são diferentes:
//!
//!   `.ts` DAQUI      conhecimento sobre o CÓDIGO, que viaja com ele. Quem instala
//!                    o pacote leva junto, e a página não depende de existir uma
//!                    casa. É o que faz `my-resources` ser útil fora desta máquina.
//!   markdown da CASA o que é do Gabriel — `03_resources/`, versionado no
//!                    `biliboss/me`, e que nenhum pacote público deveria carregar.
//!
//! A CASA GANHA quando os dois têm o mesmo nome, e a ordem importa: a página local é
//! uma decisão de quem escreve; a embarcada é semente. Mesma precedência que
//! `home.template()` já usa, pelo mesmo argumento — e ela é DECLARADA, que é o que
//! separa isto do dual-write que o @CLAUDE.md proíbe.
//!
//! ── SEM CASA AINDA É ÚTIL ───────────────────────────────────────────────────
//!
//! `MY_HOME` apontando pro vazio devolve só os embarcados, sem erro. Um pacote que
//! exige uma casa privada pra listar o que ele mesmo ship é um pacote que ninguém
//! consegue usar.
//!
//! ── A LENTE É RÓTULO, NÃO PASTA ─────────────────────────────────────────────
//!
//! Um `.ts` daqui declara `lens` no próprio valor. Um markdown da casa cai na lente
//! pela pasta, porque é o que `LENSES[*].reads` sabe hoje — e `reads` está rebaixado
//! a SEMENTE no contrato justamente porque pasta é uma leitura congelada num
//! caminho. Quando `my-labels` estiver de pé, a lente do markdown vem de
//! `wearing(<lente>)` e este arquivo perde o `porPasta()`.
//!
//! depends_on: ./resource.ts · @biliboss/interfaces/resources.ts

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { LENSES, type ResourceSystem } from "@biliboss/interfaces/resources.ts";
import type { Resource } from "./resource.ts";
import { resource } from "./resource.ts";

type Kind = ResourceSystem.ValueObjects.Kind;
type Lens = keyof typeof LENSES;

/** A casa, pela mesma alavanca que o resto da família usa. Lida por FUNÇÃO: `import`
 *  é içado acima de qualquer `process.env.MY_HOME = …`, e uma const de módulo
 *  congelaria o valor de antes da atribuição — a armadilha que já custou dado real
 *  nesta casa (20/08). */
export const home = (): string => process.env.MY_HOME ?? join(process.env.HOME ?? homedir(), "src/me");

// `import.meta.url` e não `import.meta.dir`: o segundo é do Bun e o `tsc` não o
// conhece, então o pacote não checaria fora do runtime que o criou. Um pacote
// publicável não pode depender de uma extensão do runtime pra tipar.
const AQUI = join(new URL(".", import.meta.url).pathname, "resource");

/** Os `.ts` embarcados. Descobertos por VARREDURA, nunca por lista: um arquivo novo
 *  em `resource/` JÁ é um recurso. Lista de inscrição é a regra que ninguém cumpre. */
export async function embarcados(): Promise<Resource[]> {
	if (!existsSync(AQUI)) return [];
	const out: Resource[] = [];
	for (const f of readdirSync(AQUI).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
		const mod = await import(join(AQUI, f));
		for (const v of Object.values(mod)) {
			if (v && typeof v === "object" && "id" in v && "body" in v) out.push(v as Resource);
		}
	}
	return out;
}

/** O `kind` é a PRIMEIRA pasta sob `03_resources/` — `references/clis/x.md` é
 *  `references`. É a definição que o contrato dá, e ela é posicional de propósito:
 *  ler o `type:` do frontmatter faria dois lugares decidirem a mesma coisa. */
const kindDe = (rel: string): Kind => (rel.split("/")[0] ?? "references") as Kind;

/** A lente de um markdown, pela pasta em que ele caiu. Some quando `my-labels`
 *  estiver de pé — ver o cabeçalho. */
function porPasta(rel: string): Lens | undefined {
	for (const [lente, cfg] of Object.entries(LENSES)) {
		if (cfg.reads.some((p) => rel === p || rel.startsWith(`${p}/`))) return lente as Lens;
	}
	return undefined;
}

/** `nome:` do frontmatter não existe nesta casa — o NOME é o caminho sem extensão e
 *  sem o `03_resources/`, que é como toda citação já aponta. */
const nomeDe = (rel: string) => rel.replace(/\.md$/, "");

/** Uma lista de nomes num campo de frontmatter. */
function lista(fm: string, campo: string): string[] {
	const linha = new RegExp(`^${campo}:\\s*(.+)$`, "m").exec(fm)?.[1];
	if (!linha) return [];
	return linha
		.replace(/^\[|\]$/g, "")
		.split(/[,·]/)
		.map((s) => s.trim().replace(/^["']|["']$/g, ""))
		.filter(Boolean);
}

function* walk(dir: string, raiz: string): Generator<string> {
	if (!existsSync(dir)) return;
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		if (e.name.startsWith(".") || e.name === "node_modules") continue;
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* walk(p, raiz);
		else if (e.name.endsWith(".md")) yield p.slice(raiz.length + 1);
	}
}

/** O markdown da casa. Vazio quando não há casa — sem erro, ver o cabeçalho. */
export function daCasa(raiz = join(home(), "03_resources")): Resource[] {
	if (!existsSync(raiz) || !statSync(raiz).isDirectory()) return [];
	const out: Resource[] = [];
	for (const rel of walk(raiz, raiz)) {
		const body = readFileSync(join(raiz, rel), "utf8");
		const fm = /^---\n([\s\S]*?)\n---/.exec(body)?.[1] ?? "";
		out.push(
			resource({
				name: nomeDe(rel),
				kind: kindDe(rel),
				path: join(raiz, rel),
				body,
				answers: /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? nomeDe(rel),
				at: "",
				lens: porPasta(rel) ?? "hacker",
				aliases: lista(fm, "aliases"),
				mentions: lista(fm, "mentions"),
			}),
		);
	}
	return out;
}

let cache: Resource[] | undefined;

/** TUDO, com a casa ganhando por NOME. Cacheado por processo: um `read` de cinco
 *  nomes varreria `03_resources/` cinco vezes sem isto. */
export async function index(recarrega = false): Promise<Resource[]> {
	if (cache && !recarrega) return cache;
	const casa = daCasa();
	const nomes = new Set(casa.map((r) => r.name));
	// A ORDEM É A PRECEDÊNCIA: a casa entra inteira, e do embarcado só entra o que
	// ela não tem. Um `Map` por nome faria a mesma coisa e esconderia qual venceu.
	cache = [...casa, ...(await embarcados()).filter((r) => !nomes.has(r.name))];
	return cache;
}

export const limpaCache = (): void => {
	cache = undefined;
};
