#!/usr/bin/env bun
//! Move um card de coluna. RECUSA quando a coluna de destino está no limite.
//!
//!     my kanban move 999_001_slug in_progress          o board local (pastas)
//!
//! NO BOARD DO GITHUB — Projects v2, endereço `<board>#<issue>`:
//!
//!     my kanban move soulperuibe#57 "In Progress"      1 leitura + 1 escrita
//!     my kanban move gh:24#57 "Human Review"           idem, sem link nenhum
//!     my kanban move gh:24#57 Todo --human             abre o portão do Gabriel
//!
//! ## `Human Review` — a coluna de onde só o Gabriel tira carta
//!
//! É a única regra deste CLI que não é sobre dados: sair de `Human Review` é decisão
//! de gente. Sem `--human`, o comando RECUSA e diz por quê. Com `--human`, ele abre
//! uma pergunta de verdade numa tela de verdade (`askuser`) e espera — e só segue com
//! a escolha explícita. `pulou` (2) e `expirou` (3) NÃO são sim: seguir neles seria
//! tomar a decisão no lugar de quem não respondeu.
//!
//! Um agente não satisfaz isso passando flag: `--human` só ABRE a pergunta, quem
//! responde é a pessoa em frente ao popup. Entrar em `Human Review` é livre — é o que
//! um agente faz quando terminou, e encarecer isso só empurraria trabalho pra fora da
//! coluna.
//!
//! E `→ Done` vindo de qualquer coluna que não seja `Human Review` é recusado: nada
//! chega em Done sem passar por lá.
//!
//! depends_on: src/kanban/model.ts · src/kanban/remote.ts · ~/src/askuser/scripts/cli/askuser.ts
//! impacts:    —

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { HUMAN_REVIEW, guardMove, itemByIssue, move, parseCardAddress, refOf, refToString } from "./model.ts";
import { readBoard, setStatus } from "./remote.ts";

/** O MESMO caminho que `src/askuser/ask.ts` resolve. Repetido aqui — e só aqui —
 *  porque aquele wrapper herda o stdout pro JSON sair intacto pra quem estiver
 *  parseando, e este chamador precisa LER a escolha, não só o código de saída. */
const ASKUSER = join(process.env.ASKUSER_HOME ?? join(homedir(), "src", "askuser"), "scripts", "cli", "askuser.ts");

/** Abre a pergunta e devolve `true` só quando a pessoa escolheu `sim`.
 *
 *  As quatro saídas do `askuser` são tratadas como ele manda: `0` escolheu, `2` PULOU,
 *  `3` EXPIROU, `1` não consegui perguntar. Três delas são `false`, e a diferença entre
 *  "disse não" e "ninguém respondeu" sai impressa, porque são coisas diferentes.
 *
 *  `-t 10` e não os 30 padrão: quem espera aqui é um agente segurando um pane. Meia
 *  hora de silêncio é indistinguível de travado — o mesmo problema que o `askuser`
 *  existe pra resolver. */
function humanSaysYes(question: string, sim: string, nao: string): boolean {
	if (!existsSync(ASKUSER)) {
		console.error(`o portão humano não pode ser aberto: askuser não está em ${ASKUSER}\n  git clone https://github.com/biliboss/askuser ~/src/askuser  (ou ASKUSER_HOME=<caminho>)`);
		return false;
	}
	const env = { ...process.env };
	env.ASKUSER_AGENT ??= process.env.MY_AGENT ?? "";
	env.ASKUSER_RUN ??= process.env.MY_RUN ?? "";
	env.ASKUSER_PANE ??= process.env.HERDR_PANE_ID ?? "";
	const r = Bun.spawnSync(["bun", ASKUSER, question, "-H", "Review", "-o", sim, "-o", nao, "-t", "10", "--json"], {
		env,
		stdout: "pipe",
		stderr: "inherit",
	});
	if (r.exitCode === 2) return console.error("a pergunta foi PULADA — ninguém decidiu, e o card fica onde está"), false;
	if (r.exitCode === 3) return console.error("a pergunta EXPIROU — ninguém decidiu, e o card fica onde está"), false;
	if (r.exitCode !== 0) return console.error("não consegui perguntar — o card fica onde está"), false;
	try {
		const j = JSON.parse(r.stdout.toString()) as { respostas?: Record<string, { escolhas?: string[] }> };
		const escolhas = Object.values(j.respostas ?? {}).flatMap((x) => x.escolhas ?? []);
		return escolhas.includes(sim.split("|")[0]!.trim());
	} catch {
		return console.error("resposta do askuser ilegível — o card fica onde está"), false;
	}
}

/** **CUSTA 2 PONTOS**: 1 pra ler o board (é dele que saem o id do item, o id do campo
 *  Status e o id da opção de destino, nenhum deles cacheado em arquivo) e 1 pra
 *  `updateProjectV2ItemFieldValue`. Nunca num laço. */
function remoteMove(address: string, to: string, argv: string[]): number {
	const alvo = parseCardAddress(address)!;
	const ref = refOf(alvo.board, { remote: true });
	if (!ref) return console.error(`\`${alvo.board}\` não declara projeto do GitHub nenhum — my kanban add gh:<n> ${alvo.board}, ou use gh:<n>#${alvo.issue}`), 1;

	const b = readBoard(ref);
	const item = itemByIssue(b, alvo.issue);
	if (!item)
		return console.error(`#${alvo.issue} não está em ${refToString(ref)} — my kanban add <owner/repo>#${alvo.issue} ${alvo.board}`), 1;

	const veredito = guardMove(item.status, to);
	if ("refuse" in veredito) return console.error(veredito.refuse), 1;
	if ("gate" in veredito) {
		if (!argv.includes("--human"))
			return console.error(`${veredito.gate}\n  quando for ele decidindo: my kanban move ${address} "${to}" --human`), 1;
		const ok = humanSaysYes(
			`Tirar #${alvo.issue} de ${HUMAN_REVIEW} pra ${to}?\n\n${item.title}\n${item.url ?? ""}`,
			`move|#${alvo.issue} vai pra ${to}`,
			`fica|continua em ${HUMAN_REVIEW}`,
		);
		if (!ok) return 1;
	}

	const col = setStatus(b, item.id, to);
	console.log(`${refToString(ref)}#${alvo.issue}  ${item.status ?? "(sem coluna)"} → ${col.name}`);
	return 0;
}

export function main(argv: string[]): number {
	const [task, to] = argv.filter((a) => !a.startsWith("--"));
	if (!task || !to) return console.error("uso: my kanban move <task> <coluna>  |  my kanban move <board>#<issue> <coluna> [--human]"), 1;
	try {
		// O `#` é o que separa os dois boards: um card remoto se endereça pelo NÚMERO
		// da issue, e uma task local nunca tem `#` no rótulo (`999_001_slug`).
		if (parseCardAddress(task)) return remoteMove(task, to, argv);
		const c = move(task, to);
		console.log(`${c.board}#${c.task}  → ${c.column}/`);
		return 0;
	} catch (e) {
		return console.error((e as Error).message), 1;
	}
}

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
