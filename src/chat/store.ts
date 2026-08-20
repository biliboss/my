//! O disco do `chat`: UM arquivo TSV com header, TODO canal junto — `seq` é a
//! ordem real das linhas, e não precisa de relógio nenhum concordando com outro.
//!
//! Lib, não comando: sem `main`, então @src/cli/core/scan.ts não a expõe. Os
//! subverbos (`say.ts`, `read.ts`, `listen.ts`, …) importam daqui.
//!
//! MATA `src/agents/bus.ts`, E O FORMATO MUDA — essa é a decisão central desta
//! migração. O arquivo velho (`.my_agents_chat.tsv`, 4 colunas: `at·from·to·texto`)
//! não tinha `seq`, `channel`, `thread` nem `answers`; o contrato
//! (@packages/interfaces/src/chat.ts) pede os oito. `migrar()` roda sozinha na primeira
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
//! depends_on: src/interfaces/chat.ts
//! impacts:    src/chat/say.ts · src/chat/ask.ts · src/chat/read.ts · src/chat/inbox.ts ·
//!             src/chat/unanswered.ts · src/chat/channels.ts · src/chat/open.ts ·
//!             src/chat/listen.ts · src/chat/seen.ts · src/chat/check.ts ·
//!             src/agents/send.ts · src/agents/read.ts · src/agents/chat.ts

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
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

/** Todas as mensagens, de todo canal, na ordem em que foram escritas — oldest
 *  first, porque o arquivo é append-only e `seq` cresce com ele. */
export function allMessages(): Msg[] {
	migrar();
	return readFileSync(busPath(), "utf8")
		.split("\n")
		.slice(1) // header
		.filter(Boolean)
		.map(parseRow)
		.filter((m): m is Msg => m !== null);
}

/** O maior `seq` já escrito — 0 num barramento vazio, nunca reusado: `seq` é
 *  endereço, e reusar faria duas mensagens atenderem pelo mesmo número. */
function lastSeq(): number {
	const all = allMessages();
	return all.length ? all[all.length - 1]!.seq : 0;
}

function writeRow(m: Msg): void {
	const row = [m.seq, m.channel, m.from, m.to, m.at, clean(m.text), m.thread ?? "", m.answers ?? ""].join("\t");
	appendFileSync(busPath(), row + "\n");
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
	writeRow(msg);
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

export function setCursor(channel: string, who: string, upto: number): void {
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
