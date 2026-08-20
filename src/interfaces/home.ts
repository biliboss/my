//! `home` — ONDE AS COISAS FICAM. A camada de baixo de todas as outras.
//!
//! THIS ONE IS NOT A DRAFT. `src/home/` responde as três raízes hoje, e
//! `shared/file.ts#home` foi o primeiro chamador (20/08).
//!
//! ── POR QUE ELE EXISTE ───────────────────────────────────────────────────────
//!
//! ERAM TRÊS RAÍZES FINGINDO SER UMA. Enquanto o código morava dentro da casa,
//! `repoRoot()` respondia as três perguntas de uma vez, e vinte arquivos chamavam
//! `repoRoot()` pra achar `01_projects/`. Com o código indo pro `biliboss/my` e o
//! conteúdo ficando no `biliboss/me`, a mesma chamada passa a responder errado —
//! sem erro, apontando pro vazio.
//!
//!     Root     a CASA        o que se lê e escreve — `00_inbox`…`04_archive`, `META.md`
//!     Code     o CHECKOUT    de onde este processo saiu — `src/`, `drizzle/`, `.git/hooks`
//!     Machine  a MÁQUINA     estado que não se versiona — `~/.me/me.db`, worktrees, lineups
//!
//! `_data/` ESTAVA NA RAIZ ERRADA, e é o achado que pagou este arquivo: o roster de
//! agentes e a cerca de workspaces gravavam dentro do CHECKOUT. Enquanto checkout e
//! casa eram a mesma pasta ninguém via; publicado o código, viraria estado de
//! máquina dentro de repositório público. Nada disso é decisão versionável —
//! é `Machine`.
//!
//! O NOME DA VARIÁVEL É PARTE DO CONTRATO, e a casa tinha DOIS prefixos para uma
//! só: `ME_DB`, `ME_ROOT`, `ME_SPANS`, `ME_BY` de um lado, `MY_HOME`, `MY_AGENT`,
//! `MY_RUN` do outro — mais `WS_FILE`, `INBOX_DIR`, `ASKUSER_HOME` sem prefixo
//! nenhum. Vinte e quatro nomes, declarados em lugar nenhum, e a única forma de
//! saber que uma existia era achar o `process.env` que a lia. `MY_` ganha porque é
//! o nome do comando; `ME_*` é enum aberto pra não quebrar quem já exporta.
//!
//! ── O QUE ELE NÃO É ──────────────────────────────────────────────────────────
//!
//! NÃO É UM CONTAINER DE CONFIGURAÇÃO. Ele responde ONDE, e o valor de cada env é
//! lido por quem a usa. Um objeto que carrega toda config vira o lugar onde toda
//! chave nova é adicionada "porque tem um lugar", e aí ele é o `shared` de novo.
//!
//! NÃO SINCRONIZA NADA HOJE. `SYNC_SEAM` no fim diz exatamente onde entraria, e
//! custa zero enquanto não houver uma segunda máquina — o mesmo desenho de costura
//! que `my-graph/ui/Animation.ts#RIVE_SEAM` usa.
//!
//! implemented: src/home/paths.ts · src/home/env.ts · src/home/check.ts
//! depends_on:  src/interfaces/shared.ts
//! impacts:     src/shared/file.ts · src/shared/db.ts · src/herdr/policy.ts ·
//!              src/herdr/agents/roster.ts · src/agents/check.ts · src/teams/model.ts

import type { Shared } from "./shared";

/** O que este sistema achou de podre. Declarado aqui e não importado: o runner lê a
 *  FORMA, então ter um check não custa dependência num hub. */
export interface Finding {
	path: string;
	says: string;
}

export declare namespace HomeSystem {
	export namespace ValueObjects {
		/** Caminho ABSOLUTO, sempre. Um caminho relativo só significa alguma coisa
		 *  junto do cwd de quem resolveu, e o cwd de um agente muda durante a vida do
		 *  pane (medido em `herdr/agents/list.ts`). */
		export type Path = string;

		/** @see shared.ts — declarado uma vez, pra todo mundo. */
		export type Instant = Shared.Instant;

		/** AS TRÊS RAÍZES, e a pergunta que cada uma responde. Um union e não três
		 *  funções soltas: quem pede uma raiz tem que escolher qual, e escolher errado
		 *  é o bug que este arquivo existe pra impedir. */
		export type Which = "root" | "code" | "machine";

		/** AS PASTAS NUMERADAS DA CASA, e o número É a ordem de leitura — é o que faz
		 *  um `ls` da raiz ser o índice do sistema.
		 *
		 *  Aberto (`string & {}`) porque a casa de outra pessoa pode ter outras: o
		 *  desenho é ICM, não esta lista. Uma pasta desconhecida chega como ela mesma
		 *  em vez de ser achatada em `unknown` e perdida. */
		export type Area =
			| "00_inbox"
			| "01_projects"
			| "02_areas"
			| "03_resources"
			| "04_archive"
			| (string & {});

		/** ONDE A MÁQUINA GUARDA O QUE NÃO SE VERSIONA. Um nome por coisa, e não um
		 *  caminho montado à mão em cada chamador — foi assim que `_data/` acabou
		 *  dentro do checkout. */
		export type Store =
			| "db"
			| "worktrees"
			| "teams"
			| "agents"
			| "workspaces"
			| "window"
			| (string & {});

		/** UMA VARIÁVEL DE AMBIENTE DESTA CASA, declarada. O contrato não é o valor —
		 *  é que ela EXISTE, o que ela decide, e o que acontece sem ela. */
		export interface Var {
			name: EnvName;
			decides: string;
			/** O que vale quando ela não vem. Ausente = não tem default, e o verbo
			 *  recusa em vez de adivinhar. */
			fallback?: string;
			/** Verdadeiro quando trocar isto aponta ESCRITA pra outro lugar. É o que
			 *  separa "muda o que eu leio" de "apaga o que era pra ficar" — e a segunda
			 *  já custou 41 linhas fora do git (20/08). */
			writes: boolean;
		}

		/** `MY_` É O PREFIXO, porque é o nome do comando. `ME_*` está aqui por ser o
		 *  que já existe exportado em máquina — enum aberto pro dia em que sumir, e
		 *  não uma segunda família abençoada. */
		export type EnvName =
			| "MY_HOME"
			| "MY_CODE"
			| "MY_MACHINE"
			| "MY_AGENT"
			| "MY_RUN"
			| "MY_DEV_PORT"
			| (string & {});
	}

	export namespace Entities {
		/** A casa RESOLVIDA, uma vez, com a evidência de como cada raiz foi decidida.
		 *  `why` existe porque "por que ele escreveu ali" é a pergunta de toda
		 *  investigação de caminho errado, e reconstruí-la depois é impossível. */
		export interface Resolved {
			root: ValueObjects.Path;
			code: ValueObjects.Path;
			machine: ValueObjects.Path;
			/** Por raiz: `env:MY_HOME` · `default` · `anchor:.git`. */
			why: Record<ValueObjects.Which, string>;
			at: ValueObjects.Instant;
		}
	}
}

/** ONDE AS COISAS FICAM. Nada aqui escreve; `ensure` é a única exceção e ela diz.
 *
 *  TODO MÉTODO É FUNÇÃO, NUNCA CONSTANTE DE MÓDULO, e isto não é estilo. `import` é
 *  içado acima de qualquer `process.env.MY_HOME = …` no arquivo que importa, então
 *  uma constante calculada na carga congela o valor de ANTES da atribuição. Medido
 *  em 20/08 da pior forma: uma migração rodou contra o `~/src/me` de verdade e
 *  apagou um `.tsv` de 41 linhas, fora do git, irrecuperável. */
export interface Home {
	/** A casa: o que os verbos leem e escrevem. `MY_HOME`, senão `~/src/me`. */
	root(): HomeSystem.ValueObjects.Path;

	/** O checkout de onde ESTE processo saiu, achado por ÂNCORA (`.git`) e nunca por
	 *  contar `../` — dez arquivos carregavam a contagem e um estava errado. */
	code(): HomeSystem.ValueObjects.Path;

	/** `~/.me`. O que é verdade desta máquina e de nenhuma outra. Versionar isto foi
	 *  o que fazia duas sessões brigarem pelo mesmo `state.yaml` (morto em 18/08). */
	machine(): HomeSystem.ValueObjects.Path;

	/** Uma pasta da casa, absoluta. Existir não é checado: `my inbox` numa casa nova
	 *  cria a dele, e um getter que recusa o inexistente impede o primeiro uso. */
	area(name: HomeSystem.ValueObjects.Area): HomeSystem.ValueObjects.Path;

	/** Um store da máquina, absoluto — `db` → `~/.me/me.db`. */
	store(name: HomeSystem.ValueObjects.Store): HomeSystem.ValueObjects.Path;

	/** O ÚNICO QUE ESCREVE, e escreve só `mkdir -p`. Devolve o caminho pra encadear:
	 *  `writeFileSync(join(ensure("teams"), f))` é uma linha em vez de duas. */
	ensure(name: HomeSystem.ValueObjects.Store): HomeSystem.ValueObjects.Path;

	/** As três raízes com o PORQUÊ de cada uma — o que `my home` imprime, e a
	 *  primeira coisa a olhar quando um verbo escreveu no lugar errado. */
	resolve(): HomeSystem.Entities.Resolved;

	/** Toda variável que esta casa lê, declarada. É a resposta pra "que env existe?",
	 *  que hoje só se responde com `grep process.env`. */
	vars(): HomeSystem.ValueObjects.Var[];

	/** Casa sem `CLAUDE.md`, store de máquina dentro do checkout, `MY_HOME` apontando
	 *  pro inexistente. */
	check(): Finding[];
}

// ─── SYNC_SEAM ──────────────────────────────────────────────────────────────
//
// O QUE FALTA E POR QUE NÃO ESTÁ AQUI: sincronizar exige uma SEGUNDA máquina, e
// existe uma. Escrever o protocolo agora seria desenhar contra um caso imaginário,
// e a primeira coisa que a segunda máquina real ensina é que o desenho estava
// errado.
//
// QUANDO EXISTIR, o lugar é este arquivo e a forma é esta:
//
//   remotes(): { name: string; kind: "git" | "fs" | "s3"; at: Path }[]
//   push(area: Area): Promise<...>   pull(area: Area): Promise<...>
//
// E DUAS REGRAS PARA QUEM ESCREVER, pra não refazer o que já se sabe:
//
//   1. `machine()` NUNCA SINCRONIZA. É a definição dele: id de pane, cerca de
//      workspace, worktree — tudo aponta pra coisa que só existe aqui. Um `~/.me`
//      sincronizado é a briga de `state.yaml` de volta, com duas máquinas em vez
//      de duas sessões.
//   2. A UNIDADE É A ÁREA, nunca a casa inteira. `01_projects` e `03_resources`
//      têm donos e ritmos diferentes; sincronizar tudo junto faz o conflito de um
//      travar o outro.

export const SYNC_SEAM = "Home.remotes/push/pull — veja a nota acima; precisa de uma segunda máquina antes";
