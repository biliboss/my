import { join } from "node:path";
import { root as home } from "@my/shared/paths";
import type { Batch, ChatSystem } from "@my/interfaces/chat.ts";

// ─── store ───────────────────────────────────────────────────────


import {
	appendFileSync,
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	readSync,
	readdirSync,
	renameSync,
	statSync,
	writeFileSync,
} from "node:fs";

// LIDO A CADA CHAMADA, nunca guardado numa const de módulo: um `import` estático
// é IÇADO pro topo do arquivo por ES modules — ele roda antes de qualquer outra
// linha do arquivo que o importa, inclusive um `process.env.MY_HOME = …` escrito
// textualmente ANTES do `import` no arquivo de teste. Uma const de módulo
// calculada na carga teria congelado o valor de `MY_HOME` de antes desse ponto —
// medido nesta casa: um teste que setava `MY_HOME` pra um `mkdtemp` e importava
// `store.ts` na sequência ainda assim escreveu no `~/src/me` REAL, porque o
// `import` já tinha rodado primeiro. `home()` como função é o que faz o valor
// nascer no momento do USO, não da carga do módulo.
// A implementação subiu pra `home/paths.ts` em 20/08 — este arquivo foi quem
// aprendeu que ela tem que ser FUNÇÃO, e a lição virou contrato lá.
export const busPath = () => join(home(), ".my_chat.tsv");
const cursorsDir = () => join(home(), ".my_chat_cursors");
const channelsFile = () => join(home(), ".my_chat_channels.tsv");

const oldBusPath = () => join(home(), ".my_agents_chat.tsv");
const oldMarksDir = () => join(home(), ".my_agents_chat");

const HEADER = "seq\tchannel\tfrom\tto\tat\ttext\tthread\tanswers";

export type Msg = ChatSystem.Entities.Message;
export type Direct = ChatSystem.Entities.Direct;
export type Broadcast = ChatSystem.Entities.Broadcast;
export type Channel = ChatSystem.Entities.Channel;

/** The room, and the only reserved word in the `to` column. */
export const ALL = "all";

/** Which of the two a message is. A predicate and not a column — the wire keeps
 *  one shape, and this is the whole discriminator. */
export const broadcast = (m: Msg): m is Broadcast => m.to === ALL;

/** Addressed to ONE. The complement, so a caller never writes `!broadcast(m)` and
 *  loses the narrowing. */
export const direct = (m: Msg): m is Direct => m.to !== ALL;

/** Mesma regra da casa velha: um caractere de controle no meio de um TSV corrompe
 *  toda linha DEPOIS dele pra quem lê por coluna. Escapa na ESCRITA — na leitura
 *  o estrago já aconteceu. */
const clean = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();

/** ISO8601 até o segundo, como o barramento velho — duas mensagens no mesmo
 *  segundo são comuns, e é `seq` quem desempata, não o relógio. */
export const now = () => new Date().toISOString().slice(0, 19) + "Z";

export const whoAmI = () => process.env.MY_AGENT ?? "gabriel";

/** MIGRA UMA VEZ, na primeira leitura desta casa. Idempotente: se `.my_chat.tsv`
 *  já existe, não faz nada — inclusive num arquivo recém-criado por `migrar()`
 *  com zero linhas de dados (só o header). */
function migrar(): void {
	const bus = busPath();
	const oldBus = oldBusPath();
	const oldMarks = oldMarksDir();
	if (existsSync(bus)) return;
	if (!existsSync(oldBus)) {
		writeFileSync(bus, HEADER + "\n");
		return;
	}
	const velhas = readFileSync(oldBus, "utf8").split("\n").filter(Boolean);
	const linhas = velhas.map((linha, i) => {
		const [at, from, to, ...resto] = linha.split("\t");
		const text = resto.join("\t");
		// channel · thread · answers vazios: ver o cabeçalho deste arquivo.
		return [String(i + 1), "", from ?? "", to ?? "", at ?? "", clean(text), "", ""].join("\t");
	});
	writeFileSync(bus, HEADER + "\n" + linhas.map((l) => l + "\n").join(""));

	if (existsSync(oldMarks)) {
		for (const f of readdirSync(oldMarks)) {
			if (!f.endsWith(".at")) continue;
			const who = f.slice(0, -3);
			const n = Number(readFileSync(join(oldMarks, f), "utf8")) || 0;
			if (n > 0) setCursor("", who, n);
		}
		// RENOMEIA, NÃO APAGA — mesma razão do arquivo abaixo.
		renameSync(oldMarks, `${oldMarks}.migrado`);
	}
	// NÃO APAGA A ORIGEM: renomeia. Migração que deleta transforma qualquer bug de
	// caminho em perda irreversível, e foi exatamente o que aconteceu em 20/08 — um
	// `MY_HOME` resolvido cedo demais fez esta função rodar contra o `~/src/me` REAL e
	// levar 41 linhas do barramento da frota, que é arquivo gitignored e não tem de
	// onde voltar. O bug de env foi consertado; esta linha é a rede que faltava.
	renameSync(oldBus, `${oldBus}.migrado`);
}

function parseRow(line: string): Msg | null {
	const [seq, channel, from, to, at, text, thread, answers] = line.split("\t");
	if (!seq || !from || !to || !at) return null;
	return {
		seq: Number(seq),
		channel: channel ?? "",
		from,
		to,
		at,
		text: text ?? "",
		thread: thread ? thread : undefined,
		answers: answers ? Number(answers) : undefined,
	};
}

const NEWLINE = 0x0a;

/** Reads `length` bytes starting at `offset`. A Buffer and not a string on
 *  purpose: the only safe place to cut this file is a newline BYTE, and a string
 *  index counts characters — one accent in a message and every offset after it
 *  points into the middle of a row. */
function readBytes(path: string, offset: number, length: number): Buffer {
	const fd = openSync(path, "r");
	try {
		const buf = Buffer.allocUnsafe(length);
		let read = 0;
		while (read < length) {
			const n = readSync(fd, buf, read, length - read, offset + read);
			if (n === 0) break;
			read += n;
		}
		return buf.subarray(0, read);
	} finally {
		closeSync(fd);
	}
}

/** THE LAST BYTES WE PARSED, kept so the offset can be DISPROVED and not merely
 *  trusted. Size alone is not enough, and the migration test is what proved it:
 *  a house whose `.my_chat.tsv` is replaced by a LONGER file (the migration
 *  writing it from the old bus) has a bigger size and an offset pointing into the
 *  middle of a row that is not ours. Re-reading 64 bytes per call costs nothing
 *  and turns "the file is the one I parsed" from an assumption into a check. */
const ANCHOR = 64;

type Parsed = { path: string; bytes: number; anchor: Buffer; msgs: Msg[] };

/** WHAT WAS READ, AND UP TO WHICH BYTE. The file is append-only, so no byte before
 *  this offset can ever change — re-parsing them is the whole cost and it buys
 *  nothing. Measured 21/08, paired runs on the same box within the same minute,
 *  ms per call — full parse vs this one:
 *
 *      607 lines      0.31   0.023        60_700 lines    20.74   0.118
 *    6_070 lines      1.79   0.027       607_000 lines   193.96   0.573
 *
 *  `listen` polls 5×/s and `ask` 3×/s, so the left column is 10% of a core per
 *  listener at 60k lines and 97% at 607k. `_today` reached 607 lines in two weeks
 *  of four agents. */
let parsed: Parsed | null = null;

/** The offset, if it still describes THIS file — `null` when it does not, and the
 *  read starts over from zero. */
function stillTheSameFile(path: string, size: number): Parsed | null {
	if (!parsed || parsed.path !== path || size < parsed.bytes) return null;
	if (parsed.bytes === 0) return parsed;
	const anchor = readBytes(path, parsed.bytes - parsed.anchor.length, parsed.anchor.length);
	return anchor.equals(parsed.anchor) ? parsed : null;
}

/** Todas as mensagens, de todo canal, na ordem em que foram escritas — oldest
 *  first, porque o arquivo é append-only e `seq` cresce com ele. */
export function allMessages(): Msg[] {
	migrar();
	const path = busPath();
	const size = statSync(path).size;
	const state: Parsed = stillTheSameFile(path, size) ?? { path, bytes: 0, anchor: Buffer.alloc(0), msgs: [] };
	parsed = state;
	if (size > state.bytes) {
		const chunk = readBytes(path, state.bytes, size - state.bytes);
		const nl = chunk.lastIndexOf(NEWLINE);
		// A tail with no newline is a row still being written (or one that tore):
		// it stays unparsed AND unconsumed until its newline lands.
		if (nl >= 0) {
			const lines = chunk.subarray(0, nl + 1).toString("utf8").split("\n");
			lines.pop(); // the empty string after the final newline
			if (state.bytes === 0) lines.shift(); // header
			for (const line of lines) {
				const m = parseRow(line);
				if (m) state.msgs.push(m);
			}
			state.bytes += nl + 1;
			state.anchor = readBytes(path, Math.max(0, state.bytes - ANCHOR), Math.min(ANCHOR, state.bytes));
		}
	}
	return state.msgs.slice();
}

/** O maior `seq` já escrito — 0 num barramento vazio, nunca reusado: `seq` é
 *  endereço, e reusar faria duas mensagens atenderem pelo mesmo número. */
function lastSeq(): number {
	const all = allMessages();
	return all.length ? all[all.length - 1]!.seq : 0;
}

const serializeRow = (m: Msg) =>
	[m.seq, m.channel, m.from, m.to, m.at, clean(m.text), m.thread ?? "", m.answers ?? ""].join("\t");

/** READS BACK ITS OWN LINE and raises instead of reporting a message the file
 *  does not hold. Measured 21/08: 4 of the 607 lines in the fleet's channels were
 *  torn, and every one was found hours later by somebody who was not its writer —
 *  a writer that never reads back turns its own corruption into another agent's
 *  bug report, at the worst possible distance from the cause.
 *
 *  IT STARTS ONE BYTE BEFORE THE ROW, because that byte is where the tear shows.
 *  A writer that died mid-row leaves a fragment with no newline, the next append
 *  glues onto it, and the glued line still PARSES — with the columns shifted by
 *  one. Checking only that our text is somewhere in the tail would pass on
 *  exactly that line.
 *
 *  IT DOES NOT CATCH TWO WRITERS PICKING THE SAME `seq`: both rows read back
 *  intact, and the collision happened before either of them wrote. That one is
 *  not a tear and a read-back cannot see it — it needs a lock. */
function verifyWritten(row: string, seq: number, before: number): void {
	const path = busPath();
	const tail = readBytes(path, before - 1, statSync(path).size - (before - 1)).toString("utf8");
	if (!tail.startsWith("\n"))
		throw new Error(`chat.append: torn line at byte ${before} of ${path} — #${seq} was appended onto a row that never finished`);
	if (!tail.slice(1).split("\n").includes(row))
		throw new Error(`chat.append: torn line at byte ${before} of ${path} — #${seq} did not read back as it was written`);
}

/** Acrescenta UMA mensagem e devolve a entidade escrita, com `seq` e `at`
 *  atribuídos aqui — nunca pelo chamador, porque os dois são o que o arquivo
 *  garante e um `say` que os inventasse poderia colidir com outra escrita. */
export function append(input: {
	channel: ChatSystem.ValueObjects.ChannelName;
	from: ChatSystem.ValueObjects.Addressee;
	to: ChatSystem.ValueObjects.Addressee;
	text: string;
	thread?: ChatSystem.ValueObjects.Thread;
	answers?: ChatSystem.ValueObjects.Cursor;
}): Msg {
	migrar();
	const msg: Msg = {
		seq: lastSeq() + 1,
		channel: input.channel,
		from: input.from,
		to: input.to,
		at: now(),
		text: clean(input.text),
		thread: input.thread,
		answers: input.answers,
	};
	const row = serializeRow(msg);
	const before = statSync(busPath()).size;
	appendFileSync(busPath(), row + "\n");
	verifyWritten(row, msg.seq, before);
	registerChannel(input.channel);
	return msg;
}

// =============================================================================
// cursores — um `seq` por (canal, quem), NUNCA avançado como efeito de leitura
// =============================================================================

const cursorPath = (channel: string, who: string) =>
	join(cursorsDir(), `${encodeURIComponent(channel)}__${encodeURIComponent(who)}.at`);

export function getCursor(channel: string, who: string): number {
	const p = cursorPath(channel, who);
	return existsSync(p) ? Number(readFileSync(p, "utf8")) || 0 : 0;
}

/** FOLDS WITH `max`, never writes the absolute it was handed. A batch is
 *  addressed BEFORE its handler runs and acknowledged AFTER, so two overlapping
 *  wakes finish with the slow one writing last while carrying the older `upto` —
 *  an absolute write there rewinds the cursor and re-delivers work already done.
 *  `.bus_acks.jsonl` folded with `max` and was immune to exactly this; nothing
 *  here was, and nothing checked it.
 *
 *  Going backwards on purpose means deleting the cursor file. No verb for it: a
 *  channel is re-read on purpose about once a year, and by hand. */
export function setCursor(channel: string, who: string, upto: number): void {
	if (upto <= getCursor(channel, who)) return;
	mkdirSync(cursorsDir(), { recursive: true });
	writeFileSync(cursorPath(channel, who), String(upto));
}

// =============================================================================
// canais — registro leve, só pra `channels()`/`open()`; `say()` nunca exige um
// canal já aberto, do jeito que o barramento velho nunca exigiu destinatário
// cadastrado. `members` é a ASSINATURA: quem se espera que leia o canal.
// =============================================================================

type ChannelRow = { name: string; members: string; created_at: string };

/** Vírgula é o separador desta coluna: um nome que a contivesse viraria DOIS
 *  membros sem ninguém notar. Vira espaço na ESCRITA, mesma regra do `clean()` do
 *  texto — na leitura o estrago já aconteceu. */
const memberCell = (m: string) => clean(m).replace(/,/g, " ");

const splitMembers = (s: string): string[] => (s ? s.split(",") : []);

/** As LINHAS CRUAS do registro, na ordem em que foram escritas. Um canal pode ter
 *  VÁRIAS — cada join escreve a sua — e quem responde por um canal é `fold()`. */
function readChannels(): ChannelRow[] {
	if (!existsSync(channelsFile())) return [];
	return readFileSync(channelsFile(), "utf8")
		.split("\n")
		.filter(Boolean)
		.map((l) => {
			const [name, members, created_at] = l.split("\t");
			return { name: name ?? "", members: members ?? "", created_at: created_at ?? now() };
		});
}

/** O canal que um conjunto de linhas descreve: a UNIÃO dos membros na ordem em que
 *  apareceram, e o `created_at` da PRIMEIRA linha — a que de fato criou o canal. */
function fold(name: string, rows: ChannelRow[]): Channel {
	const members: string[] = [];
	for (const r of rows) for (const m of splitMembers(r.members)) if (!members.includes(m)) members.push(m);
	return { name, members, created_at: rows[0]?.created_at ?? now() };
}

/** Cria o canal se ninguém tiver criado ainda — chave natural é o NOME — e ENTRA
 *  `members` nele. O canal é find-or-create; a lista de membros NÃO: ela cresce.
 *
 *  ANTES DE 21/08 A SEGUNDA CHAMADA ERA UM NO-OP, e isso perdia membro calado:
 *  `append()` faz find-or-create do canal com lista VAZIA na primeira mensagem, e
 *  daí em diante todo join — as 13 linhas `join` que o importador do `_today`
 *  traduz, um membro de time entrando no canal em `teams up` — sumia sem erro. O
 *  importador só sobrevivia porque registrava ANTES da primeira linha, que é uma
 *  restrição de ORDEM que nenhum chamador deveria precisar conhecer.
 *
 *  SUBSTITUIR SERIA PIOR QUE PERDER: nenhum escritor conhece a lista inteira. Um
 *  membro entrando declara UM nome, o dele, e um replace despejaria os outros
 *  três. Mesma forma do `setCursor` acima — cada escritor só conhece a própria
 *  metade, então o campo só cresce. Sair é editar `.my_chat_channels.tsv` na mão,
 *  e não tem verbo pra isso de propósito.
 *
 *  ACRESCENTA UMA LINHA, nunca reescreve a antiga: dois membros entrando no mesmo
 *  instante escrevem uma linha cada e os dois sobrevivem, onde um
 *  ler-modificar-escrever guardaria só quem escreveu por último. */
export function registerChannel(name: string, members: string[] = []): Channel {
	const rows = readChannels().filter((r) => r.name === name);
	const known = fold(name, rows);
	const novos = members.map(memberCell).filter((m, i, a) => a.indexOf(m) === i && !known.members.includes(m));
	if (rows.length && !novos.length) return known;
	const created_at = rows[0]?.created_at ?? now();
	appendFileSync(channelsFile(), [name, novos.join(","), created_at].join("\t") + "\n");
	return { name, members: [...known.members, ...novos], created_at };
}

export function listChannels(): Channel[] {
	const byName = new Map<string, ChannelRow[]>();
	for (const r of readChannels()) byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
	return [...byName].map(([name, rows]) => fold(name, rows));
}

// ─── say ─────────────────────────────────────────────────────────

export function say(
	channel: ChatSystem.ValueObjects.ChannelName,
	to: ChatSystem.ValueObjects.Addressee,
	text: string,
	thread?: ChatSystem.ValueObjects.Thread,
	answers?: ChatSystem.ValueObjects.Cursor,
): Msg {
	return append({ channel, from: whoAmI(), to, text, thread, answers });
}

const ASK_POLL_MS = 300;

/** Fala e ESPERA — absorve `Chat.ask`. BLOQUEIA de propósito, sem timeout: o
 *  contrato não declara um, porque `ask` é pra quem vai FICAR esperando (um
 *  script, uma sessão parada). Quem quer "pergunta sem bloquear" usa `say()`
 *  puro. */
export async function ask(
	channel: ChatSystem.ValueObjects.ChannelName,
	to: ChatSystem.ValueObjects.Addressee,
	text: string,
	thread?: ChatSystem.ValueObjects.Thread,
): Promise<Msg> {
	const asked = say(channel, to, text, thread);
	const me = whoAmI();
	for (;;) {
		const reply = allMessages().find((m) => m.channel === channel && m.answers === asked.seq && m.to === me);
		if (reply) return reply;
		await Bun.sleep(ASK_POLL_MS);
	}
}

/** `--re` NUMÉRICO vira `answers` — o `seq` que esta mensagem responde.
 *  NÃO-NUMÉRICO nunca vira um `seq` inventado: cai pra `thread`, e só quando
 *  ninguém deu um `--thread` explícito (que sempre ganha). */
function resolveRe(value: string, explicitThread: string | undefined): { thread?: string; answers?: number } {
	const n = Number(value);
	if (value.trim() !== "" && !Number.isNaN(n)) return { answers: n };
	return { thread: explicitThread ?? value };
}

// ─── read ────────────────────────────────────────────────────────

export function read(channel: ChatSystem.ValueObjects.ChannelName, thread?: ChatSystem.ValueObjects.Thread): Msg[] {
	return allMessages().filter((m) => m.channel === channel && (!thread || m.thread === thread));
}

/** O que chegou pra MIM, depois do meu cursor — absorve `View.inbox`. NÃO avança
 *  cursor nenhum: `seen()` abaixo é a única porta pra isso, e `listen.ts` é quem
 *  a chama sozinho, só depois que o handler retorna. */
export function inbox(
	channel: ChatSystem.ValueObjects.ChannelName,
	me: ChatSystem.ValueObjects.Addressee,
	since?: ChatSystem.ValueObjects.Cursor,
): Msg[] {
	const cursor = since ?? getCursor(channel, me);
	return allMessages().filter((m) => m.channel === channel && m.seq > cursor && (m.to === me || m.to === "all"));
}

/** Perguntas abertas de um canal — absorve `View.unanswered`. Uma mensagem
 *  conta como pergunta quando ela mesma não é resposta de ninguém (sem
 *  `answers`) e nenhuma outra mensagem do canal a responde (nenhum `answers`
 *  aponta pro `seq` dela). */
export function unanswered(channel: ChatSystem.ValueObjects.ChannelName): Msg[] {
	const all = allMessages().filter((m) => m.channel === channel);
	const answered = new Set(all.map((m) => m.answers).filter((s): s is number => s !== undefined));
	return all.filter((m) => m.answers === undefined && !answered.has(m.seq));
}

/** Move o cursor de `me`, explicitamente — absorve `Chat.seen`. NUNCA um efeito
 *  colateral de ler: aqui é a porta pra quem move na mão, inclusive via
 *  `--seen` nesta CLI. */
export function seen(
	channel: ChatSystem.ValueObjects.ChannelName,
	me: ChatSystem.ValueObjects.Addressee,
	upto: ChatSystem.ValueObjects.Cursor,
): void {
	setCursor(channel, me, upto);
}

export const show = (m: Msg) => console.log(`#${m.seq}  ${m.at.slice(11, 19)}  \x1b[1m${m.from}\x1b[0m → ${m.to}\n  ${m.text}`);

const at = (argv: string[], flag: string) => {
	const i = argv.indexOf(flag);
	return i > -1 ? argv[i + 1] : undefined;
};

// ─── listen ──────────────────────────────────────────────────────

const POLL_MS = 200;
const DEFAULT_DEBOUNCE = 2000;
const DEFAULT_MAX_WAIT = 15000;

export function listen(
	channel: ChatSystem.ValueObjects.ChannelName,
	me: ChatSystem.ValueObjects.Addressee,
	on: (batch: Batch) => void,
	opts?: { debounce?: ChatSystem.ValueObjects.DebounceTime; max_wait?: ChatSystem.ValueObjects.DebounceTime },
): { stop(): void } {
	const debounceMs = opts?.debounce ?? DEFAULT_DEBOUNCE;
	const maxWaitMs = opts?.max_wait ?? DEFAULT_MAX_WAIT;
	const addressedToMe = (m: Msg) => m.channel === channel && (m.to === me || m.to === "all");

	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let firstPendingAt: number | null = null;
	let lastActivityAt = 0;
	let lastMaxSeqSeen = 0;

	// LÊ O PENDENTE DO DISCO A CADA BATIDA, nunca "o que apareceu desde a última
	// olhada": um lote que já estava esperando quando `listen` começou (o agente
	// caiu e voltou com mensagens no cursor) tem que entrar no primeiro debounce
	// igual a um lote que chegou depois — comparar CONTAGEM total erraria esse
	// caso, porque a contagem já nasceria "vista".
	const tick = async () => {
		if (stopped) return;
		const cursor = getCursor(channel, me);
		const pending = allMessages().filter((m) => m.seq > cursor && addressedToMe(m));
		if (pending.length) {
			const maxSeq = pending[pending.length - 1]!.seq;
			if (maxSeq !== lastMaxSeqSeen) {
				lastMaxSeqSeen = maxSeq;
				lastActivityAt = Date.now();
				if (firstPendingAt === null) firstPendingAt = lastActivityAt;
			}
		} else {
			firstPendingAt = null;
			lastMaxSeqSeen = 0;
		}
		if (firstPendingAt !== null) {
			const t = Date.now();
			const quiet = t - lastActivityAt;
			const waited = t - firstPendingAt;
			if (quiet >= debounceMs || waited >= maxWaitMs) {
				const batch: Batch = { channel, from: cursor, to: pending[pending.length - 1]!.seq, messages: pending };
				firstPendingAt = null;
				lastMaxSeqSeen = 0;
				try {
					await on(batch);
					// SÓ AQUI o cursor avança — handler que retorna é a única prova de
					// que o lote foi tratado.
					setCursor(channel, me, batch.to);
				} catch (err) {
					// Cursor NÃO avançou: a próxima batida ainda vê estas mensagens (mais
					// o que chegou nesse meio-tempo) como pendentes, e reprocessa.
					console.error(`chat.listen: handler falhou, lote #${batch.from}..#${batch.to} NÃO consumido — ${(err as Error).message}`);
				}
			}
		}
		if (!stopped) timer = setTimeout(tick, POLL_MS);
	};
	timer = setTimeout(tick, POLL_MS);
	return {
		stop() {
			stopped = true;
			if (timer) clearTimeout(timer);
		},
	};
}

// ─── check ───────────────────────────────────────────────────────

export type Finding = { path: string; says: string };

export function check(): Finding[] {
	const all = allMessages();
	const seqs = new Set(all.map((m) => m.seq));
	const achados: Finding[] = [];
	for (const m of all) {
		const path = `.my_chat.tsv#${m.seq}`;
		if (!m.from) achados.push({ path, says: "mensagem sem `from`" });
		if (m.answers !== undefined && !seqs.has(m.answers)) {
			achados.push({ path, says: `\`answers\` aponta pro seq #${m.answers}, que não existe` });
		}
	}
	achados.push(...checkPresenca(all));
	return achados;
}

/** As quatro presenças — ver o header. Recebe `all` já lido pra não reparsear
 *  o TSV inteiro uma segunda vez dentro do mesmo `check()`. */
function checkPresenca(all: ReturnType<typeof allMessages>): Finding[] {
	const achados: Finding[] = [];
	const channels = listChannels();

	// CONTAGEM, não `seq` máximo: `seq` é endereço GLOBAL do arquivo inteiro
	// (@store.ts, "seq é endereço, nunca reusado" — não recomeça por canal), e
	// usar o maior `seq` de um canal como se fosse "quantas mensagens tem" conta
	// TAMBÉM as mensagens de todo canal escrito ANTES dele no arquivo. MEDIDO:
	// dois canais interleaved, `pm` com 2 mensagens cujo maior `seq` é 4 (por
	// causa de 2 mensagens de outro canal no meio) reportava "pm tem 4
	// mensage(ns)" — 21/08, achado pelo importador do T5 contra 569 linhas
	// reais, onde o canal `pm` tinha 32 e o achado dizia 569 (o `seq` da ÚLTIMA
	// linha do ARQUIVO). Um teste de canal único nunca pega isto — os dois
	// números coincidem quando só existe um canal.
	const countOf = new Map<string, number>();
	for (const m of all) countOf.set(m.channel, (countOf.get(m.channel) ?? 0) + 1);

	/** Já leu ALGUMA COISA em algum canal que não `except` — é o que distingue
	 *  "nunca tocou o sistema" (NO READER) de "está ativo, só não aqui"
	 *  (SUBSCRIPTION). */
	const leuEmOutroLugar = (who: string, except: string): boolean =>
		channels.some((c2) => c2.name !== except && getCursor(c2.name, who) > 0);

	for (const c of channels) {
		const count = countOf.get(c.name) ?? 0;
		if (count === 0) continue; // canal sem mensagem: nada pra estar atrasado

		const semNome = c.members.filter((m) => !m.trim()).length;
		if (semNome) {
			achados.push({
				path: `.my_chat_channels.tsv#${c.name}`,
				says: `NO NAME: ${semNome} membro(s) do canal sem nome`,
			});
		}

		const membros = c.members.map((m) => m.trim()).filter((m) => m && m !== "all");
		// UMA DIRETA PRA QUEM NÃO É MEMBRO É UMA MENSAGEM QUE NINGUÉM VAI LER:
		// ninguém faz polling de uma sala em que não entrou. MEDIDO 22/08 nas 795
		// linhas: 264 diretas, 43 delas (16%) endereçadas a não-membro — `pm → pm`
		// falando consigo mesmo, `soulperuibe → via-1` que é agente de outro canal,
		// `viacorretor → summary-boy` que não existe em lugar nenhum. Nenhuma
		// estourou e nenhuma apareceu aqui, porque `Addressee` era `string`.
		const forasteiros = new Map<string, number>();
		for (const m of all) {
			if (m.channel !== c.name || broadcast(m)) continue;
			if (membros.includes(m.to)) continue;
			forasteiros.set(m.to, (forasteiros.get(m.to) ?? 0) + 1);
		}
		for (const [quem, n] of forasteiros) {
			achados.push({
				path: `.my_chat.tsv#${c.name}`,
				says: `NOT A MEMBER: ${n} direta(s) pra ${quem}, que não é membro de ${c.name}`,
			});
		}

		for (const quem of membros) {
			if (getCursor(c.name, quem) > 0) continue;
			if (leuEmOutroLugar(quem, c.name)) {
				achados.push({
					path: `.my_chat.tsv#${c.name}`,
					says: `SUBSCRIPTION: ${quem} é membro de ${c.name} mas só leu outro canal`,
				});
			} else {
				achados.push({
					path: `.my_chat.tsv#${c.name}`,
					says: `NO READER: ${quem} é membro de ${c.name} e nunca leu nada, em canal nenhum`,
				});
			}
		}

		// Candidato a leitor: membro declarado OU qualquer `from`/`to` já visto
		// neste canal — um canal sem membro declarado nenhum ainda pode ter
		// alguém lendo por fora, e isso não é "sem assinante".
		const doCanal = all.filter((m) => m.channel === c.name).flatMap((m) => [m.from, m.to]);
		const candidatos = new Set([...membros, ...doCanal.map((s) => s.trim())].filter((s) => s && s !== "all"));
		if ([...candidatos].every((quem) => getCursor(c.name, quem) === 0)) {
			achados.push({
				path: `.my_chat.tsv#${c.name}`,
				says: `NO SUBSCRIBER: ${c.name} tem ${count} mensage(ns) e ninguém leu nenhuma`,
			});
		}
	}
	return achados;
}

// ─── the verb ─────────────────────────────────────────────────────────────────

/** `my chat <subverbo>`. UMA CLASSE POR SUBVERBO, na ordem em que eles importam —
 *  e é essa ordem que o help tem que ter, não a que o `readdirSync` devolve.
 *
 *  O que NÃO está aqui, e por quê: `who` mora em `@my/agents`, porque
 *  presença é pergunta sobre a FROTA e não sobre mensagem — importá-la daria a
 *  este package uma dependência que o contrato recusa desde 20/08 ("chat works
 *  with an agent that does not exist yet"). `import_today` é migração de tiro
 *  único, mora na casca e morre com ela. */
class ChatCore {
	constructor(protected readonly root: Chat) {}
}

/** `my chat say` — escrever, que é o que mais se faz num canal. */
export class ChatSay extends ChatCore {
	/** UMA DIRETA: acorda `who`, e só. O nome é `to` e não `say` porque a forma do
	 *  argumento É o conceito — quem escreve `say.to(...)` já escolheu. */
	to(channel: string, who: string, text: string, thread?: string, answers?: number): Msg {
		return say(channel, who, text, thread, answers);
	}

	/** BROADCAST: acorda todo membro do canal, e cada um custa um turno de modelo.
	 *  67% do barramento é isto (531 de 795, medido 22/08); `to()` existe pra
	 *  quando a pergunta tem dono. */
	all(channel: string, text: string, thread?: string, answers?: number): Broadcast {
		return say(channel, ALL, text, thread, answers) as Broadcast;
	}

	/** Fala e BLOQUEIA até a resposta chegar com `answers` apontando pra pergunta. */
	ask(channel: string, who: string, text: string, thread?: string): Promise<Msg> {
		return ask(channel, who, text, thread);
	}
}

/** `my chat read` — ler o que já foi dito. Nada aqui move cursor sozinho. */
export class ChatRead extends ChatCore {
	/** Tudo do canal, mais velho primeiro, ou um thread só. */
	channel(name: string, thread?: string): Msg[] {
		return read(name, thread);
	}

	/** O que é PRA MIM e ainda não vi. Não avança cursor: `seen()` é a única porta. */
	mine(name: string, me: string, since?: number): Msg[] {
		return inbox(name, me, since);
	}

	/** As perguntas que ninguém respondeu — o único motivo de alguém rolar um canal. */
	unanswered(name: string): Msg[] {
		return unanswered(name);
	}

	/** Move o cursor, explicitamente. Só vai pra frente. */
	seen(name: string, me: string, upto: number): void {
		seen(name, me, upto);
	}

	/** Toda mensagem de todo canal, na ordem do arquivo. */
	everything(): Msg[] {
		return allMessages();
	}
}

/** `my chat listen` — o verbo difícil: é assim que um agente dorme. */
export class ChatListen extends ChatCore {
	/** Entrega o lote quando o canal silencia, e move o cursor SÓ depois que o
	 *  handler retorna. */
	on(
		channel: string,
		me: string,
		handler: (batch: Batch) => void,
		opts?: { debounce?: number; max_wait?: number },
	): { stop(): void } {
		return listen(channel, me, handler, opts);
	}
}

/** `my chat` pelado — as salas que existem, e quem assina cada uma. */
export class ChatChannels extends ChatCore {
	/** Os canais, com os membros já unidos linha a linha. */
	all(): Channel[] {
		return listChannels();
	}

	/** Find-or-create do canal, e ENTRA `members` nele. A lista só cresce. */
	open(name: string, members: string[] = []): Channel {
		return registerChannel(name, members);
	}
}

/** `my chat check` — o que está torto no barramento. Síncrono, sem herdr. */
export class ChatCheck extends ChatCore {
	run(): Finding[] {
		return check();
	}
}

/** O agregado. A ordem destas cinco linhas É a ordem do help. */
export class Chat {
	readonly say = new ChatSay(this);
	readonly read = new ChatRead(this);
	readonly listen = new ChatListen(this);
	readonly channels = new ChatChannels(this);
	readonly check = new ChatCheck(this);
}

export const chat = new Chat();
