//! `kanban` em disco — Board é o PROJETO, Column é o PLACE da task, Card é a task
//! DERIVADA (não uma segunda entidade que possa ficar sem par).
//!
//! O CONTRATO (@packages/interfaces/kanban.ts) foi escrito ANTES do código e erra em um
//! ponto medido aqui: o cabeçalho dizia `projects → uma LABEL. Deleted 20/08` como se
//! já tivesse acontecido. Não aconteceu — `01_projects/`, `src/projects/`,
//! `src/sprints/` continuam no disco e são o que `my projects check`, `my sprints
//! list` e `my tasks list` leem hoje, e o próprio pedido desta task manda confirmar
//! que os três continuam funcionando. `kanban` COMPÕE esses sistemas — não os
//! substitui — e a frase do contrato foi corrigida lá para dizer isso.
//!
//! POR QUE Board = projeto, e não uma entidade nova: um board sem card é uma pasta
//! vazia, e `01_projects/<slug>/` já É essa pasta. Duas raízes pra "onde o trabalho
//! mora" é a duplicação que o próprio contrato do kanban diz que `projects` virou.
//!
//! POR QUE Column reusa o vocabulário de `Place` (`backlog · tasks · in_progress ·
//! done`), e não o `ready`/`doing`/`review` do exemplo do contrato: aquele exemplo é
//! ilustração de forma livre, e `Place` já É a coluna — a mesma pasta, o mesmo
//! `ls`. Inventar um segundo nome pro mesmo conceito é o sinônimo que a regra de
//! LINGUAGEM UBÍQUA proíbe. Por isso as colunas de um board hoje são SEMPRE essas
//! quatro: elas não são escolha do board, são a forma que `tasks` já impõe no disco.
//! `open({ columns })` com colunas diferentes RECUSA — inventar coluna sem pasta por
//! trás seria a mentira que o resto da casa evita.
//!
//! O QUE É NOVO DE VERDADE, e mora em `01_projects/<slug>/.kanban/`:
//!   `board.json`      labels declaradas, limites por coluna, o grupo do swimlane
//!   `moves/<rotulo>.json`  o histórico de coluna de UM card, APENSADO a partir de
//!                          agora — não existe história anterior a isto (o mesmo
//!                          buraco que @packages/interfaces/tasks.ts já documentou pra
//!                          `Metrics.measure`), então os números de `Metrics` abaixo
//!                          nascem com `sample: 0` pra tudo que fechou antes de hoje.
//!
//! Card NÃO É gravado — é DERIVADO de `ler(dir)` mais o que está em `.kanban/`. Não
//! existe "task sem card": todo task dentro de um projeto já tem uma linha em
//! `cards()`, porque a pasta já diz a coluna. É por isso que `add()` não pode
//! significar "criar o card" — ele existe assim que a task existe; `add()` aqui
//! confirma o rastreio (labels + a primeira entrada do `moves/`) e RECUSA mover task
//! entre projetos, porque não existe verbo nesta casa que troque a pasta-raiz de uma
//! task sem reescrever citação — mover projeto é o `my projects rename`, que troca
//! NOME, não dono.
//!
//! depends_on: src/interfaces/kanban.ts · src/projects/model.ts · src/sprints/model.ts · src/tasks/model.ts · src/tasks/new.ts · src/tasks/done.ts
//! impacts:    src/kanban/open.ts · src/kanban/capture.ts · src/kanban/close.ts · src/kanban/add.ts · src/kanban/move.ts · src/kanban/tag.ts · src/kanban/label.ts · src/kanban/limit.ts · src/kanban/list.ts · src/kanban/check.ts · src/kanban/metrics.ts · src/kanban/rename.ts

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { KanbanSystem } from "@biliboss/interfaces/kanban.ts";
import type { TaskSystem } from "@biliboss/interfaces/tasks.ts";
import {
	FLOW,
	HUMAN_REVIEW,
	DONE as REMOTE_DONE,
	INTAKE as REMOTE_INTAKE,
	type RemoteBoard,
	type RemoteRef,
	byColumn,
	itemByIssue,
	parseRef,
	readBoard,
	readSnapshot,
	refToString,
} from "./remote.ts";
import { PROJETOS, slugs as boardSlugs } from "../projects/model.ts";
import { main as renameProject } from "../projects/rename.ts";
import { criar as criarTask } from "../tasks/new.ts";
import { done as doneTask } from "../tasks/done.ts";
import {
	ARQUIVO,
	BACKLOG,
	RODANDO,
	TASKS,
	type State,
	type Task,
	agora,
	escreverFm,
	ler,
	pastasDeTask,
	placeDe,
	projetoDe,
	rotuloDe,
} from "../tasks/model.ts";

export type Finding = { path: string; says: string };

/** AS QUATRO COLUNAS QUE EXISTEM DE VERDADE — o mesmo nome que `tasks/model.ts` já
 *  usa pra pasta. `Column` é `string` no contrato porque um board TEORICAMENTE pode
 *  ter outras; hoje, apoiado em `tasks`, nenhum tem. */
export const COLUMNS = [BACKLOG, TASKS, RODANDO, ARQUIVO] as const;
export type Column = (typeof COLUMNS)[number];
export const INTAKE: Column = BACKLOG;

const KDIR = (slug: string) => join(PROJETOS, slug, ".kanban");
const BOARD_FILE = (slug: string) => join(KDIR(slug), "board.json");
const MOVES_DIR = (slug: string) => join(KDIR(slug), "moves");
const MOVES_FILE = (slug: string, rotulo: string) => join(MOVES_DIR(slug), `${rotulo}.json`);

type BoardConfig = {
	labels: KanbanSystem.Entities.Label[];
	limits: Record<string, number>;
	swimlanes?: string;
};

const emptyConfig = (): BoardConfig => ({ labels: [], limits: {} });

function readConfig(slug: string): BoardConfig {
	const f = BOARD_FILE(slug);
	if (!existsSync(f)) return emptyConfig();
	return { ...emptyConfig(), ...JSON.parse(readFileSync(f, "utf8")) };
}

function writeConfig(slug: string, cfg: BoardConfig): void {
	mkdirSync(KDIR(slug), { recursive: true });
	writeFileSync(BOARD_FILE(slug), JSON.stringify(cfg, null, 2));
}

export type Move = KanbanSystem.Entities.Move;

function readMoves(slug: string, rotulo: string): Move[] {
	const f = MOVES_FILE(slug, rotulo);
	return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : [];
}

function writeMoves(slug: string, rotulo: string, moves: Move[]): void {
	mkdirSync(MOVES_DIR(slug), { recursive: true });
	writeFileSync(MOVES_FILE(slug, rotulo), JSON.stringify(moves, null, 2));
}

/** Fecha a entrada aberta (se houver) e abre uma nova quando a coluna mudou. Chamado
 *  toda vez que uma task muda de `Place` — `move()`, `add()` na primeira vez,
 *  `capture()`, `close()`. */
function recordMove(slug: string, rotulo: string, column: Column, at = agora()): Move[] {
	const moves = readMoves(slug, rotulo);
	const last = moves[moves.length - 1];
	if (last && !last.left_at) last.left_at = at;
	if (!last || last.column !== column) moves.push({ column, entered_at: at });
	writeMoves(slug, rotulo, moves);
	return moves;
}

// ============================================================================
// Card — derivado de Task, nunca gravado por si
// ============================================================================

const parseLabels = (raw: unknown): string[] =>
	Array.isArray(raw) ? raw.map(String) : typeof raw === "string" && raw.trim() ? [raw.trim()] : [];

/** A identidade de um card É `rotuloDe(t)` — `999_001_slug` —, não o nome nu da
 *  pasta: o NNN da task reinicia em cada sprint, e sem o prefixo dois cards de
 *  sprints diferentes disputariam o mesmo endereço. Mesma razão que já vale pro
 *  branch (`branchDe`) e pra worktree. */
export function cardOf(t: Task): KanbanSystem.Entities.Card {
	const slug = projetoDe(t.dir);
	const rotulo = rotuloDe(t);
	return {
		task: rotulo,
		board: slug,
		column: placeDe(t.dir) as Column,
		service: String(t.pedido.service ?? "standard"),
		labels: parseLabels(t.pedido.labels),
		moves: readMoves(slug, rotulo),
	};
}

/** Acha a task por `rotulo` OU pelo nome nu da pasta, em QUALQUER board — os verbos
 *  que o contrato não passa o board (`close`, `tag`, `move`) precisam varrer, porque
 *  a identidade do card não carrega o board consigo no tipo. */
function findTask(taskName: string): Task | undefined {
	for (const slug of boardSlugs())
		for (const dir of pastasDeTask(slug)) {
			const t = ler(dir);
			if (rotuloDe(t) === taskName || t.slug === taskName) return t;
		}
	return undefined;
}

// ============================================================================
// View
// ============================================================================

export function boards(): KanbanSystem.Entities.Board[] {
	return boardSlugs()
		.map(board)
		.filter((b): b is KanbanSystem.Entities.Board => !!b);
}

export function board(name: string): KanbanSystem.Entities.Board | undefined {
	if (!existsSync(join(PROJETOS, name))) return undefined;
	const cfg = readConfig(name);
	const limits: Record<string, number> = {};
	for (const c of COLUMNS) limits[c] = cfg.limits[c] ?? 0;
	return { name, columns: [...COLUMNS], limits, labels: cfg.labels, swimlanes: cfg.swimlanes };
}

export function cards(
	slug: string,
	where?: { column?: string; labels?: string[] },
): KanbanSystem.Entities.Card[] {
	return pastasDeTask(slug)
		.map((dir) => cardOf(ler(dir)))
		.filter((c) => !where?.column || c.column === where.column)
		.filter((c) => !where?.labels?.length || where.labels.every((l) => c.labels.includes(l)));
}

export function swimlanes(slug: string): Record<string, KanbanSystem.Entities.Card[]> {
	const b = board(slug);
	const group = b?.swimlanes;
	const out: Record<string, KanbanSystem.Entities.Card[]> = {};
	if (!group) return { "": cards(slug) };
	const byName = new Map((b?.labels ?? []).map((l) => [l.name, l.group]));
	for (const c of cards(slug)) {
		const row = c.labels.find((l) => byName.get(l) === group) ?? "";
		(out[row] ??= []).push(c);
	}
	return out;
}

export function wip(slug: string): Record<string, { cards: number; limit: number }> {
	const b = board(slug);
	const out: Record<string, { cards: number; limit: number }> = {};
	for (const c of COLUMNS) out[c] = { cards: 0, limit: b?.limits[c] ?? 0 };
	for (const c of cards(slug)) out[c.column]!.cards++;
	return out;
}

export function blocked(slug: string): string[] {
	return Object.entries(wip(slug))
		.filter(([, w]) => w.limit > 0 && w.cards > w.limit)
		.map(([col]) => col);
}

export function check(): Finding[] {
	const out: Finding[] = [];
	for (const slug of boardSlugs()) {
		const b = board(slug);
		if (!b) continue;
		const path = `01_projects/${slug}`;

		for (const col of blocked(slug)) {
			const w = wip(slug)[col]!;
			out.push({ path, says: `${col}/: ${w.cards} card(s) acima do limite de ${w.limit}` });
		}

		const declared = new Set(b.labels.map((l) => l.name));
		const groupOf = new Map(b.labels.map((l) => [l.name, l.group]));
		for (const c of cards(slug)) {
			for (const l of c.labels)
				if (!declared.has(l)) out.push({ path: `${path}#${c.task}`, says: `label \`${l}\` não declarada no board (\`my kanban label ${slug} ${l}\`)` });
			const porGrupo = new Map<string, string>();
			for (const l of c.labels) {
				const g = groupOf.get(l);
				if (!g) continue;
				const outra = porGrupo.get(g);
				if (outra && outra !== l) out.push({ path: `${path}#${c.task}`, says: `duas labels do grupo \`${g}\`: \`${outra}\` e \`${l}\` — grupo é exclusivo` });
				porGrupo.set(g, l);
			}
		}

		// Histórico de coluna de task que não existe mais no disco: `.kanban/moves/`
		// não sabe sozinho que a task morreu — a task É a verdade, o log é derivado.
		const movesDir = MOVES_DIR(slug);
		if (existsSync(movesDir)) {
			const vivos = new Set(cards(slug).map((c) => c.task));
			for (const f of readdirSync(movesDir)) {
				const rotulo = f.replace(/\.json$/, "");
				if (!vivos.has(rotulo)) out.push({ path: `${path}/.kanban/moves/${f}`, says: `histórico de \`${rotulo}\` — a task não existe mais no disco` });
			}
		}
	}
	return out;
}

// ============================================================================
// Kanban — os verbos que escrevem
// ============================================================================

/** Cria um board novo — hoje, uma pasta de projeto MÍNIMA: sem `CONTEXT.md`, sem
 *  `resultado`/`área`/`prazo`. `my projects check` vai acusar `missing_context` num
 *  board recém-aberto, e É PRA ACUSAR: aqueles campos eram o que `projects` cobrava
 *  de um CONTAINER, e o contrato do kanban diz explicitamente que esse resultado e
 *  esse prazo agora são um CARD com label e prazo — nunca um container. Corrigir o
 *  check de `projects` pra parar de cobrar isso é migração de outro sistema, fora
 *  do escopo desta task, e não foi feita. */
export function open(spec: { name: string; columns?: string[] }): KanbanSystem.Entities.Board {
	if (spec.columns && (spec.columns.length !== COLUMNS.length || !spec.columns.every((c, i) => c === COLUMNS[i])))
		throw new Error(`colunas customizadas não são suportadas: um board é apoiado em \`tasks\`, e as colunas SÃO os quatro Place — ${COLUMNS.join(", ")}`);
	const dir = join(PROJETOS, spec.name);
	try {
		mkdirSync(dir);
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`já existe: 01_projects/${spec.name}/`);
		throw e;
	}
	mkdirSync(join(dir, TASKS));
	writeConfig(spec.name, emptyConfig());
	return board(spec.name)!;
}

/** Reusa `src/projects/rename.ts` inteiro: ele já resolve citantes por `rg` e
 *  reescreve `01_projects/<antigo>` em toda a casa. Reescrever essa varredura aqui
 *  seria a segunda implementação que o contrato deste arquivo já promete evitar. */
export function rename(from: string, to: string): KanbanSystem.Entities.Board {
	const code = renameProject([from, to]);
	if (code !== 0) throw new Error(`rename recusado: ${from} → ${to} (veja o stderr acima)`);
	return board(to)!;
}

export function capture(boardName: string, title: string, body: string): KanbanSystem.Entities.Card {
	if (!existsSync(join(PROJETOS, boardName))) throw new Error(`não existe board \`${boardName}\` — my kanban open ${boardName}`);
	// Pousa em `backlog/` — a coluna de intake — via a MESMA opção que
	// `src/tasks/new.ts` já expõe. Herda a recusa dela também: sem sprint aberta,
	// `criar` recusa, e é a recusa REAL desta casa hoje — nenhuma task nasce fora de
	// uma sprint, capturada ou não. Abrir uma sprint automaticamente seria decidir
	// política de produto que ninguém pediu; a mensagem de erro já ensina o próximo
	// passo (`my sprints new`).
	const criada = criarTask(boardName, title, { backlog: true });
	if ("erro" in criada) throw new Error(criada.erro);
	// O corpo VERBATIM, à parte do template — é o que sobrevive pra julgar o
	// resultado depois, igual a `Inbox.capture` fazia.
	appendFileSync(join(criada.task.dir, "CONTEXT.md"), `\n## Captured\n\n${body}\n`);
	const t = ler(criada.task.dir);
	recordMove(boardName, rotuloDe(t), placeDe(t.dir) as Column);
	return cardOf(t);
}

export function close(
	taskName: string,
	answer: { became: string } | { dropped: string },
): KanbanSystem.Entities.Card {
	const t = findTask(taskName);
	if (!t) throw new Error(`nenhum card \`${taskName}\``);
	const slug = projetoDe(t.dir);
	// `close` é o `Inbox.process`/`Inbox.drop` de antes: registra o desfecho e
	// arquiva. NÃO é `my tasks done` — aquele roda prova e commita código, e nem
	// todo card é código. Um card fechado com `became` que nunca passou por `my
	// tasks done` continua aparecendo em `my tasks check` como "done sem prova" —
	// é a MESMA regra, e ela está certa: entregar sem prova é isso mesmo que
	// `tasks` já flagra, kanban não inventa uma segunda.
	if ("dropped" in answer) {
		// `tasks.done({dropped})` NÃO arquiva — é o comportamento de HOJE do próprio
		// `src/tasks/done.ts` (só o caminho que commita chama `arquivar`), e kanban
		// herda em vez de inventar um segundo. A pasta fica onde estava; o
		// `state:` é que muda.
		const fechada = doneTask(t, { dropped: answer.dropped });
		if ("erro" in fechada) throw new Error(fechada.erro);
	} else {
		escreverFm(join(t.dir, "output.md"), { state: "done" as State, ended_at: agora(), became: answer.became });
		// Ao contrário de `tasks.done()` (que só arquiva depois de commitar código),
		// `close({became})` arquiva na hora: a coluna É o `state`, e um card `done`
		// que continuasse em `in_progress/` mentiria os dois eixos um contra o outro.
		moverParaColuna(t.dir, ARQUIVO);
	}
	const depois = findTask(rotuloDe(t))!;
	recordMove(slug, rotuloDe(depois), placeDe(depois.dir) as Column);
	return cardOf(depois);
}

/** Confirma o rastreio de uma task que já existe no board: aplica labels e garante
 *  que `moves/` tem pelo menos a entrada de agora. NÃO cria a task — ela já existe
 *  assim que a pasta existe, e não existe verbo nesta casa que troque o projeto
 *  DONO de uma task sem reescrever citação, então `add` RECUSA quando a task está
 *  noutro board — mover é `my projects rename` (nome), nunca dono. */
export function add(taskName: string, boardName: string, labels: string[] = []): KanbanSystem.Entities.Card {
	const t = findTask(taskName);
	if (!t) throw new Error(`nenhuma task \`${taskName}\` em nenhum board`);
	const slug = projetoDe(t.dir);
	if (slug !== boardName) throw new Error(`\`${taskName}\` mora em \`${slug}\`, não em \`${boardName}\` — não existe verbo que troque o dono de uma task`);
	if (labels.length) escreverFm(join(t.dir, "CONTEXT.md"), { labels });
	const rotulo = rotuloDe(ler(t.dir));
	if (!readMoves(slug, rotulo).length) recordMove(slug, rotulo, placeDe(t.dir) as Column);
	return cardOf(ler(t.dir));
}

/** Move a pasta pra base da coluna alvo, replicando a mesma regra de
 *  `puxar`/`devolver`/`arquivar` de `src/tasks/model.ts` — subir até o `tasks/` que
 *  contém a task antes de descer na coluna nova — mas GENERALIZADA pras quatro
 *  colunas, porque aqueles três só sabem ir pras três que já tinham verbo. Não fica
 *  em `tasks/model.ts` porque nenhuma das quatro colunas ali contempla ida DIRETA
 *  pra `backlog/` a partir de qualquer lugar — só o kanban precisa disso. */
function moverParaColuna(dirTask: string, alvo: Column): string {
	const nome = dirTask.split("/").pop()!;
	const base = dirTask.slice(0, dirTask.length - nome.length - 1);
	const raizTasks = base.endsWith(`/${BACKLOG}`) || base.endsWith(`/${RODANDO}`) || base.endsWith(`/${ARQUIVO}`) ? dirname(base) : base;
	const destino = alvo === TASKS ? join(raizTasks, nome) : join(raizTasks, alvo, nome);
	if (destino === dirTask) return dirTask;
	mkdirSync(dirname(destino), { recursive: true });
	renameSync(dirTask, destino);
	return destino;
}

export function move(taskName: string, to: string): KanbanSystem.Entities.Card {
	if (!(COLUMNS as readonly string[]).includes(to)) throw new Error(`coluna desconhecida: \`${to}\` — ${COLUMNS.join(", ")}`);
	const t = findTask(taskName);
	if (!t) throw new Error(`nenhum card \`${taskName}\``);
	const slug = projetoDe(t.dir);
	const de = placeDe(t.dir);
	if (de === to) return cardOf(t);

	const w = wip(slug)[to]!;
	if (w.limit > 0 && w.cards >= w.limit)
		throw new Error(`${to}/ está no limite (${w.cards}/${w.limit}) — my kanban limit ${slug} ${to} <n> pra abrir espaço, ou é isso que o board existe pra impedir`);

	const destino = moverParaColuna(t.dir, to as Column);
	const depois = ler(destino);
	recordMove(slug, rotuloDe(depois), to as Column);
	return cardOf(depois);
}

export function label(boardName: string, l: KanbanSystem.Entities.Label): KanbanSystem.Entities.Board {
	if (!existsSync(join(PROJETOS, boardName))) throw new Error(`não existe board \`${boardName}\``);
	const cfg = readConfig(boardName);
	const i = cfg.labels.findIndex((x) => x.name === l.name);
	if (i >= 0) cfg.labels[i] = l;
	else cfg.labels.push(l);
	writeConfig(boardName, cfg);
	return board(boardName)!;
}

export function tag(taskName: string, labels: string[]): KanbanSystem.Entities.Card {
	const t = findTask(taskName);
	if (!t) throw new Error(`nenhum card \`${taskName}\``);
	const slug = projetoDe(t.dir);
	const b = board(slug)!;
	const groupOf = new Map(b.labels.map((x) => [x.name, x.group]));
	const porGrupo = new Map<string, string>();
	for (const l of labels) {
		const g = groupOf.get(l);
		if (!g) continue;
		const outra = porGrupo.get(g);
		if (outra) throw new Error(`\`${outra}\` e \`${l}\` são do mesmo grupo \`${g}\` — no máximo uma por card`);
		porGrupo.set(g, l);
	}
	escreverFm(join(t.dir, "CONTEXT.md"), { labels });
	return cardOf(ler(t.dir));
}

export function limit(boardName: string, column: string, n: number): KanbanSystem.Entities.Board {
	if (!(COLUMNS as readonly string[]).includes(column)) throw new Error(`coluna desconhecida: \`${column}\` — ${COLUMNS.join(", ")}`);
	const cfg = readConfig(boardName);
	cfg.limits[column] = n;
	writeConfig(boardName, cfg);
	return board(boardName)!;
}

// ============================================================================
// Metrics — lidas do `moves/` de cada card, e HONESTAS sobre o que ele não tem
// ============================================================================
//
// `moves/` só existe a partir de HOJE: nenhum card fechado antes desta task tem
// história de coluna, porque a história não existia. É o MESMO buraco que
// @packages/interfaces/tasks.ts já documentou pra `Metrics.measure` — "este arquivo
// grava só a posição, nunca a transição" — e a resposta é a mesma: os números
// abaixo são REAIS sobre o que `moves/` viu, e `sample: 0` é a resposta honesta
// pra tudo que fechou antes. Fabricar história a partir do `mtime` da pasta
// inflaria precisão que não existe — o `aging()` abaixo é o único que se permite
// isso, e só porque ele é sobre o PRESENTE (idade de algo aberto agora), não
// sobre um ciclo já fechado.

const HORA = 3_600_000;
const percentil = (xs: number[], p: number): number => {
	if (!xs.length) return 0;
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
};

function allCards(): { slug: string; card: KanbanSystem.Entities.Card }[] {
	return boardSlugs().flatMap((slug) => cards(slug).map((card) => ({ slug, card })));
}

/** O valor que agrupa um card num `by` — a label dele que pertence àquele grupo,
 *  ou `undefined` se nenhuma. `flow`/`efficiency`/`rework` compartilham esta
 *  peneira, e sem `by` tudo cai no balde `"all"`. */
function bucketOf(slug: string, card: KanbanSystem.Entities.Card, by?: string): string {
	if (!by) return "all";
	const b = board(slug);
	const groupOf = new Map((b?.labels ?? []).map((l) => [l.name, l.group]));
	return card.labels.find((l) => groupOf.get(l) === by) ?? "(sem label do grupo)";
}

function cicloELead(moves: Move[]): { cycle: number; lead: number } | undefined {
	const chegouNoDone = moves.find((m) => m.column === ARQUIVO);
	if (!chegouNoDone || !moves.length) return undefined;
	const fim = Date.parse(chegouNoDone.entered_at);
	const inicioLead = Date.parse(moves[0]!.entered_at);
	const entrouEmDoing = moves.find((m) => m.column === RODANDO) ?? moves[0]!;
	const inicioCiclo = Date.parse(entrouEmDoing.entered_at);
	return { cycle: (fim - inicioCiclo) / HORA, lead: (fim - inicioLead) / HORA };
}

export function flow(
	by?: string,
): { label: string; cycle_p50: number; cycle_p85: number; lead_p50: number; lead_p85: number; sample: number }[] {
	const baldes = new Map<string, { cycle: number; lead: number }[]>();
	for (const { slug, card } of allCards()) {
		const d = cicloELead(card.moves);
		if (!d) continue;
		const chave = bucketOf(slug, card, by);
		(baldes.get(chave) ?? baldes.set(chave, []).get(chave)!).push(d);
	}
	return [...baldes.entries()].map(([label, ds]) => ({
		label,
		cycle_p50: percentil(ds.map((d) => d.cycle), 50),
		cycle_p85: percentil(ds.map((d) => d.cycle), 85),
		lead_p50: percentil(ds.map((d) => d.lead), 50),
		lead_p85: percentil(ds.map((d) => d.lead), 85),
		sample: ds.length,
	}));
}

/** Uma entrada em `done` por DIA, mais antigo primeiro. Só conta o que `moves/`
 *  viu — um card fechado ontem por `my tasks done` sem nunca ter passado por
 *  `my kanban move`/`add`/`close` não deixou rastro aqui, e não entra. */
export function throughput(days: number): number[] {
	const hoje = new Date();
	hoje.setUTCHours(0, 0, 0, 0);
	const contagem = new Array(days).fill(0);
	for (const { card } of allCards())
		for (const m of card.moves) {
			if (m.column !== ARQUIVO) continue;
			const d = new Date(m.entered_at);
			d.setUTCHours(0, 0, 0, 0);
			const i = days - 1 - Math.round((hoje.getTime() - d.getTime()) / 86_400_000);
			if (i >= 0 && i < days) contagem[i]++;
		}
	return contagem;
}

/** Monte Carlo puro sobre `throughput`: amostra um dia real da história por
 *  iteração, soma até bater `alvo`. 1000 corridas — o de sempre pra esta conta,
 *  sem inventar distribuição nenhuma sobre uma história que já é a amostra.
 *
 *  SEM throughput nenhum (`.kanban/moves/` vazio, ou nenhum `done` ainda visto), o
 *  laço nunca bate `alvo` e sai só no teto de `3650` dias — de propósito, e não um
 *  `0` cedo: `0` mentiria "termina hoje", e o teto é o sinal honesto de "não há
 *  história pra prever nada", que `goal()` abaixo já lê certo (`fits: 0`). */
function simular(alvo: number, historia: number[], corridas = 1000): number[] {
	const dias: number[] = [];
	for (let i = 0; i < corridas; i++) {
		let feitos = 0;
		let d = 0;
		while (feitos < alvo && d < 3650) {
			d++;
			feitos += historia[Math.floor(Math.random() * historia.length)]!;
		}
		dias.push(d);
	}
	return dias.sort((a, b) => a - b);
}

export function forecast(cardsN: number): { days_p50: number; days_p85: number; days_p95: number } {
	const dias = simular(cardsN, throughput(30));
	return { days_p50: percentil(dias, 50), days_p85: percentil(dias, 85), days_p95: percentil(dias, 95) };
}

export function goal(cardsN: number, by: string): { probability: number; fits: number } {
	const alvoEmDias = Math.max(0, Math.round((Date.parse(by) - Date.now()) / 86_400_000));
	const dias = simular(cardsN, throughput(30));
	const cabem = dias.filter((d) => d <= alvoEmDias).length;
	return { probability: dias.length ? cabem / dias.length : 0, fits: cabem };
}

export function aging(): { task: string; age_hours: number; column_hours: number }[] {
	const out: { task: string; age_hours: number; column_hours: number }[] = [];
	for (const { card } of allCards()) {
		if (card.column === ARQUIVO) continue;
		const t = findTask(card.task);
		if (!t) continue;
		// `moves[0]` é a verdade quando existe; sem ela (card mais velho que
		// `.kanban/`), o `birthtime` da pasta é o mesmo fallback que
		// `src/inbox/layout.ts` já usa pra idade sem história.
		const nasceu = card.moves[0]?.entered_at ?? new Date(statSync(t.dir).birthtimeMs).toISOString();
		const entrouNaColuna = [...card.moves].reverse().find((m) => m.column === card.column)?.entered_at ?? nasceu;
		out.push({
			task: card.task,
			age_hours: (Date.now() - Date.parse(nasceu)) / HORA,
			column_hours: (Date.now() - Date.parse(entrouNaColuna)) / HORA,
		});
	}
	return out.sort((a, b) => b.age_hours - a.age_hours);
}

/** As facts que `TaskSystem.Metrics` já declara como o buraco: `output.md`
 *  guarda só o ÚLTIMO valor de cada campo, nunca a transição. `kanban` não tem
 *  informação a mais que `tasks` não tenha — herda a mesma resposta honesta. */
const FALTANDO: TaskSystem.Metrics.MissingFact[] = [
	"work_started",
	"work_stopped",
	"claim_taken",
	"claim_released",
	"proof_attempted",
	"worktree_opened",
	"worktree_closed",
	"first_commit",
];
const indisponivel = <T>(): TaskSystem.Metrics.Measure<T> => ({ kind: "unavailable", missing: FALTANDO });

export const taskMetrics: TaskSystem.Metrics.TaskMeasure = {
	touched: indisponivel(),
	claims: indisponivel(),
	proofs: indisponivel(),
	worktrees: indisponivel(),
	first_claim_to_first_commit: indisponivel(),
};

/** `touched / cycle`, por balde de `by`. Precisa de `touched` — que é exatamente o
 *  que `taskMetrics` acima admite não ter —, então a resposta é `unavailable` em
 *  vez de um número calculado sobre um numerador inventado. */
export function efficiency(
	by?: string,
): TaskSystem.Metrics.Measure<{ label: string; ratio: number; sample: number }[]> {
	return indisponivel();
}

/** Rework é o único que `moves/` responde sozinho, sem precisar de `touched`:
 *  a coluna que RECUOU — `done → in_progress`, `in_progress → backlog` — está
 *  gravada linha a linha. Ordem das colunas é `COLUMNS`; recuo é índice menor
 *  depois de índice maior. */
export function rework(): { label: string; rate: number }[] {
	const ordem = new Map(COLUMNS.map((c, i) => [c, i]));
	const baldes = new Map<string, { total: number; comRecuo: number }>();
	for (const { slug, card } of allCards()) {
		const chave = "all";
		let recuou = false;
		for (let i = 1; i < card.moves.length; i++)
			if ((ordem.get(card.moves[i]!.column as Column) ?? 0) < (ordem.get(card.moves[i - 1]!.column as Column) ?? 0)) recuou = true;
		const b = baldes.get(chave) ?? { total: 0, comRecuo: 0 };
		b.total++;
		if (recuou) b.comRecuo++;
		baldes.set(chave, b);
	}
	return [...baldes.entries()].map(([label, b]) => ({ label, rate: b.total ? b.comRecuo / b.total : 0 }));
}

export { findTask };

// ============================================================================
// THE REMOTE BOARD — GitHub Projects v2 beside the folders
// ============================================================================
//
// TWO BOARDS, AND THEY ARE NOT THE SAME BOARD. A local board is `01_projects/<slug>/`
// and its columns ARE the four `Place` folders on disk. A remote board is a GitHub
// Projects v2 project and its columns are the options of the `Status` field —
// `Inbox → Todo → In Progress → Human Review → Done`. Merging them into one column
// vocabulary would be the second truth this file's header already refuses: the folders
// have no `Human Review` and GitHub has no `backlog/` directory.
//
// So they are LINKED, not fused. A local board may declare which project it appears on
// (`.kanban/board.json#remote`), and every verb below says which of the two it is
// answering about. Nothing is mirrored: a card is not copied from one to the other,
// and there is no sync. A sync between two boards is a dual-write, and this house's
// migration rule says one path must die — but neither of these has: the folders are
// where a task's work lives, and the project is where a HUMAN looks at it.
//
// THE ONE THING THAT ONLY EXISTS REMOTELY IS `Human Review`, and it is the reason this
// module exists at all. It is the column only Gabriel moves a card out of. `guardMove`
// below is where that rule is code instead of prose.
//
// BUDGET: every function here whose name starts with `remote` spends GraphQL points.
// The cost is on each one. None of them may be called from a loop or a timer.

export { FLOW, HUMAN_REVIEW, REMOTE_INTAKE, REMOTE_DONE, byColumn, itemByIssue, readBoard, refToString };
export type { RemoteBoard, RemoteRef };

/** The link a local board declares to a GitHub project. ONLY owner and number are ever
 *  stored — a URL a human can type. Project id, field id and the five option ids are
 *  deliberately absent: the old `_today/.gh_projects.jsonl` cached all of them and its
 *  own header admitted that option ids change whenever anyone edits the Status field.
 *  A cached option id lands a card in a column that no longer exists, so they are
 *  re-read on every command and trusted from no file. */
export function linkOf(slug: string): RemoteRef | undefined {
	const r = (readConfig(slug) as BoardConfig & { remote?: RemoteRef }).remote;
	return r?.owner && r?.number ? { owner: r.owner, number: Number(r.number) } : undefined;
}

export function link(slug: string, ref: RemoteRef): RemoteRef {
	if (!existsSync(join(PROJETOS, slug))) throw new Error(`no board \`${slug}\` — my kanban open ${slug}`);
	const cfg = readConfig(slug) as BoardConfig & { remote?: RemoteRef };
	cfg.remote = ref;
	writeConfig(slug, cfg);
	return ref;
}

export const links = (): { slug: string; ref: RemoteRef }[] =>
	boardSlugs()
		.map((slug) => ({ slug, ref: linkOf(slug) }))
		.filter((x): x is { slug: string; ref: RemoteRef } => !!x.ref);

/** WHICH BOARD A NAME MEANS. `gh:24` and `gh:biliboss/24` are always the remote one;
 *  a local slug is remote only when it declares a link AND the caller asked for it.
 *  Returning `undefined` for the remote arm rather than falling back to the local board
 *  is deliberate — a silent fallback would answer a question about GitHub with the
 *  contents of a folder. */
export function refOf(name: string, opts: { remote?: boolean } = {}): RemoteRef | undefined {
	const direct = parseRef(name);
	if (direct) return direct;
	return opts.remote ? linkOf(name) : undefined;
}

/** `soulperuibe#57` · `gh:24#57` — a card on a remote board. The address a human types
 *  is the ISSUE number, because that is the number printed everywhere else; the
 *  `PVTI_…` project item id is resolved from it and never typed.
 *
 *  FIELD VALUES LIVE ON THE ITEM, not on the issue — which is why the item id has to be
 *  resolved at all, and why somebody reading only the issue never sees its column. */
export function parseCardAddress(s: string): { board: string; issue: number } | undefined {
	const i = s.lastIndexOf("#");
	if (i <= 0) return undefined;
	const issue = Number(s.slice(i + 1));
	return Number.isInteger(issue) && issue > 0 ? { board: s.slice(0, i), issue } : undefined;
}

/** THE `Human Review` RULE, as code. Called before any remote move, and the only place
 *  the policy is written down.
 *
 *  `gate` is not `refuse`: leaving `Human Review` is Gabriel's to decide, so the answer
 *  is "ask a human", and `src/kanban/move.ts` turns that into a real question on a real
 *  screen through `my askuser ask`. An agent cannot satisfy it by passing a flag.
 *
 *  Moving INTO `Human Review` is free — that is what an agent does when it is done, and
 *  making it expensive would just push work around the column. */
export function guardMove(from: string | undefined, to: string): { ok: true } | { gate: string } | { refuse: string } {
	if (from === to) return { refuse: `already in \`${to}\`` };
	if (from === HUMAN_REVIEW)
		return { gate: `\`${HUMAN_REVIEW}\` → \`${to}\` is Gabriel's call, not an agent's. Nothing leaves this column without a human saying so.` };
	if (to === REMOTE_DONE && from !== HUMAN_REVIEW)
		return { refuse: `\`${from ?? "(no status)"}\` → \`${REMOTE_DONE}\` skips \`${HUMAN_REVIEW}\`. Nothing reaches Done without passing it — move it to \`${HUMAN_REVIEW}\` and let Gabriel close it.` };
	return { ok: true };
}

// ---------------------------------------------------------------------------
// What is rotten on a remote board
// ---------------------------------------------------------------------------

/** THE REMOTE FINDINGS. **COSTS 1 POINT PER BOARD**, which is why it is NOT part of
 *  `check()` above: `check()` is the function `src/shared/house.ts` finds by FORM and
 *  runs on every `my check all`, and a network call in there would spend the shared
 *  GraphQL budget on every sweep — the exact shape of the 30-second polling that
 *  emptied it on 21/08. `my kanban check --remote` asks for this explicitly.
 *
 *  `HUMAN REVIEW` is a finding and not an error: it is what `today waiting` printed —
 *  the queue in front of Gabriel — and a board where it is empty is a board where
 *  nothing is waiting on him. */
export function remoteFindings(b: RemoteBoard): Finding[] {
	const out: Finding[] = [];
	const at = (i: { number?: number; id: string }) => `${refToString(b.ref)}#${i.number ?? i.id}`;
	const known = new Set(b.columns.map((c) => c.name));

	if (b.truncated)
		out.push({ path: refToString(b.ref), says: `TRUNCATED: the board holds more than 100 items and everything read here is a prefix of it` });

	const snap = readSnapshot(b.ref)?.status ?? {};
	for (const i of b.items) {
		if (i.parent)
			out.push({ path: at(i), says: `SUB-ISSUE of #${i.parent}: it nests under the parent and shows in NO column — invisible on the board` });

		if (!i.status) {
			const was = snap[i.id];
			// A card that HAD a column and now has none is the silent wipe:
			// `updateProjectV2Field` recreated the options and orphaned every item that
			// pointed at the old ids. The snapshot is the only remaining record of where
			// it was, so the finding carries the command that puts it back.
			if (was)
				out.push({ path: at(i), says: `STATUS LOST: it was in \`${was.column}\` on ${was.seen_at.slice(0, 16)} and is in no column now — the Status field was recreated. Restore: my kanban move ${refToString(b.ref)}#${i.number} "${was.column}"` });
			else out.push({ path: at(i), says: `NO STATUS: in no column at all — it does not appear on the board` });
			continue;
		}

		if (!known.has(i.status)) out.push({ path: at(i), says: `column \`${i.status}\` is not an option of the Status field any more` });
		else if (!(FLOW as readonly string[]).includes(i.status))
			out.push({ path: at(i), says: `column \`${i.status}\` is outside the flow (${FLOW.join(" → ")}) — it is kept as-is, but nothing routes through it` });

		if (i.status === HUMAN_REVIEW)
			out.push({ path: at(i), says: `HUMAN REVIEW: waiting on Gabriel since ${i.updated_at?.slice(0, 16) ?? "?"} — "${i.title.slice(0, 60)}"` });

		if (i.state === "CLOSED" && i.status !== REMOTE_DONE)
			out.push({ path: at(i), says: `closed on GitHub but sitting in \`${i.status}\` — it never passed \`${HUMAN_REVIEW}\`` });
	}
	return out;
}
