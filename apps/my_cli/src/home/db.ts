#!/usr/bin/env bun
//! O BANCO DA MÁQUINA — SurrealDB standalone, rocksdb, ligado sob demanda.
//!
//!     my home db                   está de pé? em que versão, com que storage
//!     my home db --start           sobe se não estiver
//!     my home db --stop            derruba
//!     my home db --sql "SELECT * FROM pref"
//!
//! MORA EM `home` porque é a mesma pergunta que este sistema já responde: ONDE as
//! coisas ficam. O arquivo é `~/.me/surreal/me.db` — `machine()`, nunca a casa e
//! nunca o checkout. Qual projeto eu estava usando é fato DESTA máquina, e
//! versionar isso é o que fazia duas sessões brigarem pelo mesmo `state.yaml`.
//!
//! ── O QUE FOI MEDIDO, 20/08, e não lido em documentação ──────────────────────
//!
//! `surreal start rocksdb:<caminho> --user root --pass root --bind 127.0.0.1:8000`
//! sobe em ~4s e responde `/health` com 200. Conectar + autenticar + escolher
//! namespace pelo SDK custa **20ms**. Dado escrito pela 3.0.1 foi lido inteiro pela
//! 3.2.3 depois do upgrade — o formato do rocksdb atravessou.
//!
//! `value` É PALAVRA RESERVADA. `SELECT value FROM pref:x` não é erro de record id,
//! é o parser lendo `value` como palavra-chave: sai `Unexpected token, expected
//! FROM`. `SELECT * FROM pref:x` funciona, e o campo em crase também. Custou três
//! diagnósticos errados antes de aparecer.
//!
//! `type::thing` VIROU `type::record`. O nome antigo ainda é aceito pelo parser o
//! bastante pra dar uma mensagem útil (`did you maybe mean type::record`), mas
//! FALHA. Toda referência a record id montado por variável usa o nome novo.
//!
//! TABELA INEXISTENTE É ERRO, não vazio: `DELETE pref` numa tabela que ninguém
//! definiu estoura com `The table 'pref' does not exist`. Não existe o
//! `CREATE TABLE IF NOT EXISTS` implícito do SQLite — daí `schema()` rodar em toda
//! conexão, que é o que substitui a migração do drizzle.
//!
//! O SDK DO NPM É 2.x E ISSO NÃO É ATRASO: `npm view surrealdb dist-tags` diz
//! `latest: 2.0.8`, não existe 3.x publicado, e o 2.0.8 fala com o servidor 3.2.3
//! (medido acima). Numeração de SDK e de servidor não andam juntas nesta base.
//!
//! ── ROOT/ROOT, E POR QUE ISSO NÃO É DESCUIDO ─────────────────────────────────
//!
//! O `--bind` é `127.0.0.1`: só quem já está nesta máquina alcança a porta. E quem
//! está nesta máquina lê `~/.me/surreal/me.db` direto com o próprio `surreal`, sem
//! passar por autenticação nenhuma. Uma senha gerada e guardada ao lado do arquivo
//! que ela protege é cerimônia, não segurança — protegeria contra um atacante que
//! consegue abrir socket local mas não consegue abrir arquivo local, e esse
//! atacante não existe.
//!
//! O DIA EM QUE ISSO MUDA é o dia em que o `--bind` sair do loopback. Aí a senha
//! passa a valer, e o lugar dela é `~/.me/surreal/pass` com modo 600.
//!
//! depends_on: src/home/paths.ts
//! impacts:    src/shared/db.ts · src/vscode/set.ts · src/tasks/model.ts

import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { Surreal } from "surrealdb";
import { has, value } from "../shared/argv.ts";
import { store } from "./paths.ts";

export const NS = "my";
export const DB = "machine";
export const HOST = "127.0.0.1:8000";

/** O arquivo do rocksdb. `store()` e não um caminho montado à mão: é o mesmo lugar
 *  que decide onde `worktrees`, `teams` e o roster moram. */
export const file = (): string => `${store("surreal")}/me.db`;

/** O servidor responde? `/health` e não uma conexão de SDK: a pergunta é sobre o
 *  processo, e abrir websocket pra descobrir que não tem ninguém custa o timeout. */
export async function up(host = HOST): Promise<boolean> {
	try {
		const r = await fetch(`http://${host}/health`, { signal: AbortSignal.timeout(1500) });
		return r.ok;
	} catch {
		return false;
	}
}

/** SOBE O SERVIDOR e espera ele responder.
 *
 *  DESANEXADO de propósito: ele sobrevive ao comando que o subiu, senão todo verbo
 *  pagaria os 4 segundos de partida. É a mesma escolha do herdr — processo de
 *  infraestrutura não morre com quem o chamou primeiro. */
export async function start(timeoutMs = 15_000): Promise<{ ok: true; already: boolean } | { erro: string }> {
	if (await up()) return { ok: true, already: true };

	const path = file();
	mkdirSync(dirname(path), { recursive: true });
	Bun.spawn(["surreal", "start", `rocksdb:${path}`, "--user", "root", "--pass", "root", "--bind", HOST], {
		stdout: "ignore",
		stderr: "ignore",
		stdin: "ignore",
	}).unref();

	const até = Date.now() + timeoutMs;
	while (Date.now() < até) {
		if (await up()) return { ok: true, already: false };
		await Bun.sleep(200);
	}
	return { erro: `subiu \`surreal start\` mas ninguém respondeu em ${HOST} depois de ${timeoutMs}ms` };
}

/** AS TABELAS. Roda em toda conexão porque é barato e porque SurrealDB NÃO tem o
 *  `CREATE TABLE IF NOT EXISTS` implícito do SQLite — tabela que ninguém definiu
 *  faz `SELECT` estourar em vez de devolver vazio.
 *
 *  `SCHEMALESS` de propósito: o que garante a forma aqui é o TypeScript de quem
 *  escreve, e uma segunda declaração de forma dentro do banco é a que fica velha.
 *  Índice é outra coisa — ele muda o plano de leitura, e por isso é declarado. */
const SCHEMA = [
	"DEFINE TABLE IF NOT EXISTS pref SCHEMALESS",
	"DEFINE TABLE IF NOT EXISTS folder SCHEMALESS",
	"DEFINE INDEX IF NOT EXISTS folder_position ON folder FIELDS position",
	"DEFINE TABLE IF NOT EXISTS folder_tag SCHEMALESS",
	"DEFINE INDEX IF NOT EXISTS folder_tag_tag ON folder_tag FIELDS tag",
	"DEFINE TABLE IF NOT EXISTS sidebar_history SCHEMALESS",
];

let cliente: Promise<Surreal> | undefined;

/** O BANCO, ABERTO UMA VEZ POR PROCESSO. Devolve a MESMA promessa em toda chamada:
 *  dois `await db()` concorrentes no mesmo processo abriam duas conexões e a
 *  segunda ficava pendurada até o fim do comando. */
export function db(): Promise<Surreal> {
	cliente ??= (async () => {
		const pronto = await start();
		if ("erro" in pronto) throw new Error(pronto.erro);
		const s = new Surreal();
		await s.connect(`ws://${HOST}/rpc`);
		await s.signin({ username: "root", password: "root" });
		await s.use({ namespace: NS, database: DB });
		for (const q of SCHEMA) await s.query(q);
		return s;
	})();
	return cliente;
}

/** Fecha o que este processo abriu. O SERVIDOR FICA DE PÉ — ele é de todo mundo, e
 *  derrubá-lo no fim de um `my tasks list` faria o próximo pagar a partida. */
export async function close(): Promise<void> {
	if (!cliente) return;
	const s = await cliente;
	cliente = undefined;
	await s.close();
}

export async function main(argv: string[] = Bun.argv.slice(2)): Promise<number> {
	if (has("stop")) {
		const p = Bun.spawnSync(["pkill", "-f", `surreal start rocksdb:${file()}`]);
		console.log(p.exitCode === 0 ? "derrubado" : "não estava de pé");
		return 0;
	}

	if (has("start")) {
		const out = await start();
		if ("erro" in out) return console.error(`✗ ${out.erro}`), 1;
		console.log(out.already ? `já estava de pé em ${HOST}` : `subiu em ${HOST}`);
		return 0;
	}

	const sql = value("sql");
	if (sql) {
		const s = await db();
		console.log(JSON.stringify(await s.query(sql), null, 2));
		await close();
		return 0;
	}

	const vivo = await up();
	const v = Bun.spawnSync(["surreal", "version"]);
	console.log(`servidor  ${vivo ? `de pé em ${HOST}` : "PARADO — `my home db --start`"}`);
	console.log(`binário   ${new TextDecoder().decode(v.stdout).trim() || "surreal não está no PATH"}`);
	console.log(`storage   rocksdb:${file()}${existsSync(file()) ? "" : "  ← ainda não existe"}`);
	console.log(`namespace ${NS} · database ${DB}`);
	return vivo ? 0 : 1;
}

if (import.meta.main) main().then((c) => process.exit(c));
