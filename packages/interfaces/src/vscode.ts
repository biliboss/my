//! `my-vscode` — DRAFT. O WORKSPACE: que pastas o editor abre, em que ordem, com
//! que rótulo. Tipos só.
//!
//! O contrato mora aqui e não em `packages/my-vscode/interfaces.ts` porque contrato
//! desta família mora num lugar só desde 20/08 — é o que o `MY_GRAPH_ROOT` aponta, e
//! é o que faz o grafo desenhar TODOS os sistemas em vez dos que alguém lembrou de
//! listar. O código vai pra `packages/my-vscode/`; a declaração fica com as irmãs.
//!
//! ── UMA INTERFACE, E A PRIMEIRA VERSÃO TINHA TRÊS ────────────────────────────
//!
//! Ela nasceu com `Bar`, `Tree` e `Feed`, dobrando a extensão do Explorer aqui
//! dentro porque as duas coisas dizem "vscode". Estava errado, e o erro é de
//! FRONTEIRA, não de tamanho: a árvore do Explorer roda no extension host, é um
//! `package.json` próprio, compila pra `out/` e nada dela é alcançável por `my …`.
//! O workspace é um ARQUIVO JSON que este CLI escreve e o editor relê sozinho.
//!
//! Elas não se falam. `open()` não redesenha árvore nenhuma, e um clique na árvore
//! não mexe no workspace. O dia em que precisarem é o dia em que a extensão ganha o
//! contrato DELA — não um namespace dentro deste.
//!
//! ── UM ESCRITOR, E O TEMPO VERBAL QUE MATOU O OUTRO ─────────────────────────
//!
//! `regen` MORREU em 18/08. Eram dois verbos com tempos verbais diferentes — `regen`
//! DESENHAVA (lia o disco e reescrevia o `folders` inteiro), `set` DECIDE qual é a
//! escolha — e misturá-los produziu `regen --fixa <path>`: um efeito colateral na
//! boca do verbo que roda sozinho. Sobrou UM escritor do array `folders`.
//!
//! O QUE MORREU JUNTO foi o workspace DERIVADO: blocos que liam o disco e se
//! reescreviam a cada rodada. Duas sessões trocando o foco no mesmo minuto brigavam
//! pelo mesmo `state.yaml`. O que ficou é escolha EXPLÍCITA, guardada.
//!
//! ── POR QUE `Mode` E NÃO `set(lista)` ───────────────────────────────────────
//!
//! Reconstruir a lista inteira no chamador faz duas chamadas concorrentes se
//! sobrescreverem — e nesta casa há cinco agentes mexendo junto. `top`, `at` e
//! `drop` são o que as pessoas pedem POR NOME, e cada um é uma intenção que o
//! escritor consegue aplicar sobre o que estiver lá no instante da escrita.
//!
//! ── O QUE ESTE ARQUIVO SE RECUSA A DECLARAR ─────────────────────────────────
//!
//! Nada de `reveal()`, `focus()` ou `openFile()`. Isso é comandar o editor, e o
//! editor só é comandável de dentro dele — pela extensão, que é outro contrato.
//! Prometer aqui faria o implementador descobrir na hora que não dá.
//!
//! NADA DISTO ESTÁ IMPLEMENTADO, e a linha `implemented:` fica FORA de propósito: o
//! grafo lê a PRESENÇA dela pra decidir se o nó é vazado, e escrever
//! `implemented: nada` fazia a palavra "nada" contar como arquivo — o nó saía cheio
//! dizendo que existe código atrás de um contrato que ninguém escreveu. Medido em
//! 20/08, no minuto seguinte a escrever este arquivo.
//!
//! O que roda HOJE é `src/vscode/set.ts`, e ele não obedece a este desenho ainda.
//!
//! external:    o `.code-workspace` do VS Code
//! planned:     packages/my-vscode/

/** O que este sistema achou podre. Declarado aqui em vez de importado: o runner lê
 *  a FORMA, então ter um check não custa dependência de hub. */
export interface Finding {
	path: string;
	says: string;
}

export declare namespace VscodeSystem {
	export namespace ValueObjects {
		/** Relativo a `~/src` — `my/packages/interfaces`. Relativo e não absoluto
		 *  porque o `.code-workspace` é versionado e o `~` de cada máquina é outro. */
		export type FolderPath = string;

		/** 1-based, DENSO, e é o número que se DIGITA. Numeração esparsa compra
		 *  inserção barata e custa o número na tela ser o número que se usa. */
		export type Position = number;

		/** O que o editor mostra. AUSENTE é o caso normal e quer dizer "use o nome da
		 *  pasta" — rótulo gravado congela o que o disco mantém fresco. */
		export type Label = string;

		/** 0..N por pasta, e é o que SUBSTITUI "layout salvo": um layout é uma tag,
		 *  então não existe lista congelada ao lado da query pra divergir dela. */
		export type Tag = string;

		/** COMO a lista muda. Ver o cabeçalho: intenção por nome, não lista
		 *  reconstruída pelo chamador. */
		export type Mode = "replace" | "top" | "bottom" | "at" | "drop" | "label";

		/** QUAL workspace. Ausente = `~/src/main.code-workspace`, o principal — e é o
		 *  único que existe hoje. O parâmetro está aqui porque um segundo arquivo é
		 *  barato de abrir e caro de descobrir que não dá. */
		export type WorkspaceFile = string;
	}

	export namespace Entities {
		/** Uma pasta do workspace. */
		export interface Folder {
			path: ValueObjects.FolderPath;
			label?: ValueObjects.Label;
			position: ValueObjects.Position;
			tags: ValueObjects.Tag[];
			hidden: boolean;
		}
	}
}

/** O WORKSPACE. Um escritor do array `folders`, e ele é este.
 *
 *  SÍNCRONO, e isso é medido: é um `readFileSync` de um JSON de ~20 itens. O que
 *  atravessa processo nesta casa é async por necessidade; um arquivo local não. */
export interface Workspace {
	/** As pastas como estão. */
	list(file?: VscodeSystem.ValueObjects.WorkspaceFile): VscodeSystem.Entities.Folder[];

	/** MUDA a lista, pelo modo. Devolve o que ficou — quem chama quer conferir a
	 *  saída, e reler depois abre a janela entre escrever e ler. */
	set(
		folders: VscodeSystem.ValueObjects.FolderPath[],
		mode: VscodeSystem.ValueObjects.Mode,
		at?: VscodeSystem.ValueObjects.FolderPath,
	): VscodeSystem.Entities.Folder[];

	/** O QUE SAIRIA, sem escrever. Existe porque o workspace é a tela em que a pessoa
	 *  trabalha: errar nele custa o contexto visual de todo mundo, inclusive dos
	 *  agentes que estão com uma aba aberta agora. */
	preview(
		folders: VscodeSystem.ValueObjects.FolderPath[],
		mode: VscodeSystem.ValueObjects.Mode,
		at?: VscodeSystem.ValueObjects.FolderPath,
	): VscodeSystem.Entities.Folder[];

	/** DESFAZ a última escrita. Uma LEITURA do penúltimo estado gravado, nunca uma
	 *  máquina de aplicar diff ao contrário: a lista tem ~20 itens, e o snapshot é
	 *  menor que o motor que o reverteria. */
	undo(): VscodeSystem.Entities.Folder[];

	/** Pasta citada que não existe em disco, posição repetida, e rótulo gravado igual
	 *  ao nome da pasta — o terceiro é ruído que ninguém removeria sem alguém apontar. */
	check(): Finding[];
}
