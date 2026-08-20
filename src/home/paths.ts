#!/usr/bin/env bun
//! As três raízes, e o PORQUÊ de cada uma.
//!
//!     my home paths                 as três, com a evidência
//!     my home paths --json          pro jq
//!     my home paths root            só uma, crua — pro `$(...)` de um script
//!
//! `Home.root/code/machine/area/store/ensure/resolve` (@packages/interfaces/src/home.ts).
//!
//! TUDO É FUNÇÃO, NUNCA CONSTANTE DE MÓDULO. `import` é içado acima de qualquer
//! `process.env.MY_HOME = …` no arquivo que importa, então uma constante calculada
//! na carga congela o valor de ANTES da atribuição. Medido em 20/08 da pior forma:
//! uma migração rodou contra o `~/src/me` de verdade e apagou um `.tsv` de 41
//! linhas, fora do git, irrecuperável.
//!
//! ESTE ARQUIVO NÃO IMPORTA NINGUÉM DA CASA, e é o que o deixa ser a camada de
//! baixo: qualquer import daqui pra cima seria um ciclo com quem já precisa saber
//! onde as coisas ficam.
//!
//! depends_on: src/interfaces/home.ts
//! impacts:    src/shared/file.ts · src/shared/db.ts · src/herdr/policy.ts ·
//!             src/herdr/agents/roster.ts · src/teams/model.ts

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";

import type { HomeSystem } from "@biliboss/interfaces/home.ts";

type Path = HomeSystem.ValueObjects.Path;

const HOME = () => process.env.HOME ?? homedir();

/** ONDE A CASA PADRÃO FICA ANOTADA — uma linha, o caminho, e nada mais.
 *
 *  ARQUIVO E NÃO O SQLITE, e a razão é ciclo: `shared/db.ts` pergunta a ESTE módulo
 *  onde o banco mora (`store("db")`). Guardar a casa lá dentro faria a camada de
 *  baixo depender de quem depende dela — e o preço seria pagar a abertura de um
 *  banco pra responder a pergunta mais básica que este arquivo tem.
 *
 *  Uma linha de texto também é o que deixa `cat ~/.me/home` responder sem o CLI, e
 *  isso importa no dia em que o CLI é justamente o que não está subindo. */
const DEFAULT_FILE = () => join(machine(), "home");

/** A casa ANOTADA, ou nada. Arquivo ilegível conta como nada: uma casa que ninguém
 *  consegue ler não é melhor que uma casa não escolhida, e cair no default é o
 *  comportamento que o usuário já conhece. */
export function storedRoot(): Path | undefined {
	try {
		const v = readFileSync(DEFAULT_FILE(), "utf8").trim();
		return v || undefined;
	} catch {
		return undefined;
	}
}

/** A CASA: o que os verbos leem e escrevem.
 *
 *  TRÊS CAMADAS, e a ordem é do mais VOLÁTIL pro mais estável: `MY_HOME` é desta
 *  chamada, o arquivo é desta máquina, o default é o que sempre foi. Env ganha
 *  porque é o que um teste e um CI usam pra apontar pra uma árvore descartável sem
 *  mexer no que a pessoa configurou — e uma alavanca de sessão que perde pra uma de
 *  disco é uma alavanca que não serve. */
export const root = (): Path => process.env.MY_HOME ?? storedRoot() ?? join(HOME(), "src/me");

/** ESCOLHE A CASA PADRÃO desta máquina. Recusa o que não existe: apontar pro vazio
 *  faz todo verbo reportar uma casa vazia, que é indistinguível de uma casa nova —
 *  e o erro só aparece quando alguém estranha que a lista veio curta. */
export function setRoot(path: Path): { ok: true; root: Path } | { erro: string } {
	const abs = path.startsWith("~") ? join(HOME(), path.slice(1)) : resolvePath(path);
	if (!existsSync(abs)) return { erro: `não existe: ${abs}` };
	mkdirSync(machine(), { recursive: true });
	writeFileSync(DEFAULT_FILE(), `${abs}\n`);
	return { ok: true, root: abs };
}

/** O CHECKOUT deste processo, por ÂNCORA e nunca por contar `../`.
 *
 *  Dez arquivos carregavam `join(import.meta.dir, "../..")` e um carregava
 *  `"../../.."` por estar um nível mais fundo — aritmética que quebra calada no dia
 *  em que alguém move o arquivo. `.git` e não `CLAUDE.md`: numa worktree o `.git` é
 *  ARQUIVO, não pasta, e `existsSync` aceita os dois.
 *
 *  RECUSA em vez de adivinhar. Raiz errada escreve arquivo real no lugar errado. */
export function code(from = import.meta.dir): Path {
	if (process.env.MY_CODE) return process.env.MY_CODE;
	for (let dir = from; ; dir = dirname(dir)) {
		if (existsSync(join(dir, ".git"))) return dir;
		if (dirname(dir) === dir) throw new Error(`não achei o checkout (nenhum .git de ${from} pra cima)`);
	}
}

/** A MÁQUINA: o que é verdade daqui e de nenhum outro lugar. */
export const machine = (): Path => process.env.MY_MACHINE ?? join(HOME(), ".me");

/** Uma pasta da casa. Existir não é checado de propósito — `my inbox` numa casa
 *  nova CRIA a dele, e um getter que recusa o inexistente impede o primeiro uso. */
export const area = (name: HomeSystem.ValueObjects.Area): Path => join(root(), name);

/** ONDE CADA COISA DE MÁQUINA MORA, num lugar só.
 *
 *  Antes disto cada chamador montava o caminho: `db.ts` lia `ME_DB`, `policy.ts` e
 *  `roster.ts` gravavam `_data/` DENTRO DO CHECKOUT, e `teams/model.ts` montava
 *  `~/.me/teams` na mão. Enquanto checkout e casa eram a mesma pasta o erro do
 *  `_data/` não aparecia; publicado o código, ele vira estado de máquina dentro de
 *  repositório público — e some no primeiro clone. */
const STORES: Record<string, string> = {
	db: "me.db",
	worktrees: "worktrees",
	teams: "teams",
	agents: "agents.json",
	workspaces: "workspaces.json",
	window: "window",
};

export const store = (name: HomeSystem.ValueObjects.Store): Path =>
	join(machine(), STORES[name] ?? name);

/** O ÚNICO QUE ESCREVE, e escreve só `mkdir -p`. Devolve o caminho pra encadear.
 *
 *  Um store que é ARQUIVO (`db`, `agents`) tem a PASTA dele criada, nunca ele: um
 *  `mkdir` sobre `me.db` faria o SQLite abrir contra um diretório. */
export function ensure(name: HomeSystem.ValueObjects.Store): Path {
	const p = store(name);
	mkdirSync(p.endsWith(".json") || p.endsWith(".db") ? dirname(p) : p, { recursive: true });
	return p;
}

/** AS DUAS ÁRVORES QUE UMA CITAÇÃO PODE ESTAR NOMEANDO, na ordem de tentar.
 *
 *  `//! depends_on: src/tasks/model.ts · 02_areas/00_workflows/CONTEXT.md` cita as
 *  DUAS numa linha só — a primeira é código, a segunda é conteúdo — e enquanto os
 *  dois viviam na mesma pasta a distinção não existia. Separados, resolver contra
 *  uma raiz só faz metade das citações apontar pro vazio, e os checks de citação
 *  passaram a acusar o repositório inteiro (medido 20/08, `my check reciprocal`
 *  morrendo com ENOENT na primeira linha).
 *
 *  CASA PRIMEIRO, e a ordem importa: `src/` existe nas duas quando alguém roda
 *  contra um checkout antigo, e o conteúdo é o que a prosa cita por convenção.
 *
 *  Um array e não `root() || code()`: quem varre precisa das duas, não da primeira
 *  que existir. Sem duplicata quando ainda são a mesma pasta. */
export const trees = (): Path[] => (root() === code() ? [root()] : [root(), code()]);

/** UM TEMPLATE, DA CASA SE ELA TIVER, SENÃO DO CÓDIGO.
 *
 *  Os moldes de task, sprint, projeto e system_design são do SISTEMA — vêm no
 *  repositório e ninguém precisa inventá-los pra abrir a primeira task. Mas uma casa
 *  pode querer os seus, e a precedência é a casa, sempre: o molde é uma decisão de
 *  quem escreve, não de quem instalou.
 *
 *  ISTO NÃO É DUAL-WRITE, é precedência declarada, e a diferença é a regra do
 *  @CLAUDE.md: o proibido é a cópia pendurada que ninguém sabe qual vale. Aqui a
 *  ordem está escrita, é a mesma em todo chamador, e a de baixo é semente — ela só
 *  aparece quando a de cima não existe.
 *
 *  Antes de 20/08 não havia escolha a fazer: código e casa eram a mesma pasta, e os
 *  quatro `TPL` do fonte apontavam pro único `03_resources/templates/` que existia. */
export function template(rel: string): Path {
	const mine = join(root(), "03_resources/templates", rel);
	return existsSync(mine) ? mine : join(code(), "03_resources/templates", rel);
}

/** MUDA UM STORE DE CASA UMA VEZ SÓ, e nunca apaga a origem.
 *
 *  `_data/agents.json` e `_data/workspaces.json` moravam DENTRO do checkout, e o
 *  conteúdo deles é vivo — a cerca de workspaces bloqueada agora, o roster de quem
 *  está de pé. Deletar depois de copiar transforma qualquer bug de caminho em perda
 *  irreversível; a origem vira `.migrado` e fica.
 *
 *  `existsSync(novo)` PRIMEIRO: rodar duas vezes não pode desfazer a primeira. */
export function adopt(from: Path, name: HomeSystem.ValueObjects.Store): Path {
	const to = store(name);
	if (!existsSync(to) && existsSync(from)) {
		ensure(name);
		renameSync(from, to);
		try {
			writeFileSync(`${from}.migrado`, `mudou pra ${to}\n`);
		} catch {
			// A nota é cortesia, não contrato: um checkout somente-leitura não deve
			// impedir a mudança que já deu certo.
		}
	}
	return to;
}

/** As três com a evidência de como foram decididas. `why` existe porque "por que
 *  ele escreveu ali" é a pergunta de toda investigação de caminho errado, e
 *  reconstruí-la depois é impossível. */
export function resolve(): HomeSystem.Entities.Resolved {
	return {
		root: root(),
		code: code(),
		machine: machine(),
		why: {
			root: process.env.MY_HOME ? "env:MY_HOME" : storedRoot() ? `file:${DEFAULT_FILE()}` : "default:~/src/me",
			code: process.env.MY_CODE ? "env:MY_CODE" : "anchor:.git",
			machine: process.env.MY_MACHINE ? "env:MY_MACHINE" : "default:~/.me",
		},
		at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
	};
}

export function main(argv: string[] = Bun.argv.slice(2)): number {
	const r = resolve();
	const one = argv.find((a) => !a.startsWith("--"));
	if (one) {
		const v = (r as unknown as Record<string, string>)[one];
		if (!v) return console.error(`raiz desconhecida: \`${one}\` — root · code · machine`), 1;
		console.log(v);
		return 0;
	}
	if (argv.includes("--json")) return console.log(JSON.stringify(r, null, 2)), 0;
	for (const k of ["root", "code", "machine"] as const) {
		const missing = existsSync(r[k]) ? "" : "  ← não existe";
		console.log(`${k.padEnd(8)} ${r[k].padEnd(34)} ${r.why[k]}${missing}`);
	}
	return 0;
}

if (import.meta.main) process.exit(main());
