//! O disco do `chat`: UM arquivo TSV com header, TODO canal junto — `seq` é a
//! ordem real das linhas, e não precisa de relógio nenhum concordando com outro.
//!
//! Lib, não comando: sem `main`, então @src/cli/core/scan.ts não a expõe. Os
//! subverbos (`say.ts`, `read.ts`, `listen.ts`, …) importam daqui.
//!
//! MATA `src/agents/bus.ts`, E O FORMATO MUDA — essa é a decisão central desta
//! migração. O arquivo velho (`.my_agents_chat.tsv`, 4 colunas: `at·from·to·texto`)
//! não tinha `seq`, `channel`, `thread` nem `answers`; o contrato
//! (@packages/interfaces/chat.ts) pede os oito. `migrar()` roda sozinha na primeira
//! leitura — se `.my_chat.tsv` ainda não existe e o arquivo velho existe, ela
//! nasce a partir dele:
//!
//!   seq       o ÍNDICE da linha velha, 1-based — a única coisa que a ordem do
//!             arquivo garante.
//!   channel   VAZIO, e de propósito: o barramento velho não tinha canal, e
//!             inventar um nome (`"fleet"`, `"dm"`) seria mentir sobre um
//!             conceito que nunca existiu. `""` é "antes de canal existir", não
//!             um canal chamado nada — e é por isso que os apelidos finos em
//!             `src/agents/{send,read,chat}.ts` continuam falando em `""`.
//!   from/to/at/text  copiados 1:1 — o velho já tinha os quatro.
//!   thread    VAZIO. Nada no arquivo velho amarrava uma linha a um assunto.
//!   answers   VAZIO. O velho não tinha conceito de resposta — só `to`.
//!
//! O que a migração NÃO recupera, porque não existe no arquivo velho pra
//! recuperar: qual mensagem respondia qual (`answers`), e qual conversa cada
//! linha pertencia (`thread`). Um migrador que inventasse os dois seria pior que
//! o campo vazio.
//!
//! As marcas de leitura por agente (`.my_agents_chat/<quem>.at`, uma CONTAGEM DE
//! LINHA) migram de graça: como a migração dá `seq` na MESMA ordem das linhas
//! velhas, a contagem de linha já lida É o `seq` da última mensagem lida — vira
//! cursor do canal `""` sem conversão nenhuma.
//!
//! THREE RULES OF THE FILE, and each one is a defect somebody else found first:
//!
//!   READ-BACK ON APPEND   `append` re-reads the bytes it just wrote and raises
//!                         on a row that did not come back intact. 4 of 607 lines
//!                         tore in the fleet's channels on 21/08, each one found
//!                         hours later by a reader, never by the writer.
//!   CURSORS FOLD WITH max `setCursor` never writes an absolute — a stale
//!                         acknowledgement would rewind the cursor and re-deliver.
//!   THE PARSE IS A TAIL   `allMessages` keeps the byte it parsed up to. The
//!                         full parse cost 20.7ms at 60k lines and 194ms at 607k,
//!                         and `listen` polls 5×/s — one listener alone was 10%
//!                         of a core at 60k and 97% at 607k. The tail costs the
//!                         bytes that arrived: 0.12ms and 0.57ms, same box, same
//!                         minute.
//!
//! depends_on: packages/interfaces/chat.ts
//! impacts:    src/chat/index.ts · src/chat/say.ts · src/chat/read.ts ·
//!             src/chat/listen.ts · src/chat/check.ts · src/chat/who.ts ·
//!             src/chat/import_today.ts · src/agents/read.ts · src/agents/chat.ts
//!             — whoever IMPORTS this file, by `grep`. `src/agents/send.ts` left the
//!             list on 21/08: it imports `say.ts` now, and no longer the store.

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
import { join } from "node:path";
import type { ChatSystem } from "@biliboss/interfaces/chat.ts";

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
import { root as home } from "../home/paths.ts";
export const busPath = () => join(home(), ".my_chat.tsv");
const cursorsDir = () => join(home(), ".my_chat_cursors");
const channelsFile = () => join(home(), ".my_chat_channels.tsv");

const oldBusPath = () => join(home(), ".my_agents_chat.tsv");
const oldMarksDir = () => join(home(), ".my_agents_chat");

const HEADER = "seq\tchannel\tfrom\tto\tat\ttext\tthread\tanswers";

export type Msg = ChatSystem.Entities.Message;
export type Channel = ChatSystem.Entities.Channel;

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
// cadastrado.
// =============================================================================

type ChannelRow = { name: string; members: string; created_at: string };

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

/** Cria o canal se ninguém tiver criado ainda — chave natural é o NOME, e o
 *  find-or-create acontece aqui, na escrita, nunca depois por deduplicação. */
export function registerChannel(name: string, members: string[] = []): Channel {
	const rows = readChannels();
	const existing = rows.find((r) => r.name === name);
	if (existing) return { name: existing.name, members: existing.members ? existing.members.split(",") : [], created_at: existing.created_at };
	const row: ChannelRow = { name, members: members.join(","), created_at: now() };
	appendFileSync(channelsFile(), [row.name, row.members, row.created_at].join("\t") + "\n");
	return { name, members, created_at: row.created_at };
}

export function listChannels(): Channel[] {
	return readChannels().map((r) => ({ name: r.name, members: r.members ? r.members.split(",") : [], created_at: r.created_at }));
}
