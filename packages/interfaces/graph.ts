//! `graph` — DRAFT. O grafo como DADO, e as fontes que o produzem.
//!
//! ── POR QUE ISTO PRECISA EXISTIR ─────────────────────────────────────────────
//!
//! O viewer é o extractor hoje. `apps/my-graph/lib/extract.ts` lê uma pasta de `.ts`
//! e devolve o grafo — então o único grafo que existe é o que o app consegue calcular,
//! e o tipo dele prova: `interfaces`, `methods`, `exports`, `planned`, `config`. Todo
//! campo é sobre um arquivo TypeScript.
//!
//! Um recurso de empresa não tem `methods`. Uma aresta de label no SurrealDB não tem
//! `implemented`. Enfiar os dois naquele nó seria mentir em cinco campos pra caber, e
//! o desenho ficaria certo na tela enquanto o modelo estaria errado — que é o modo de
//! falha mais caro deste repositório, porque ninguém percebe olhando.
//!
//! **O VIEWER PASSA A DESENHAR, NÃO A EXTRAIR.** Com o grafo virando contrato,
//! qualquer um PRODUZ um: `company` produz o dele do SurrealDB mais as pastas de
//! recurso, o extractor de contratos vira uma fonte entre outras, e o my-graph deixa
//! de ser o teto do que pode ser desenhado.
//!
//! ── A FONTE É PROVENIÊNCIA, NÃO DONO ─────────────────────────────────────────
//!
//! Duas fontes podem descrever o MESMO nó: um recurso existe em `03_resources/` e
//! carrega labels no SurrealDB. Isso é um nó com duas proveniências, nunca dois nós —
//! a regra de chave natural do @CLAUDE.md aplicada aqui: normaliza o id e faz
//! find-or-create ANTES de inserir, nunca cria e deduplica depois.
//!
//! Por isso `from` é uma LISTA. Um nó que só o disco conhece e um que o banco também
//! conhece são fatos diferentes sobre a mesma coisa, e a diferença é desenhável.
//!
//! ── O QUE NÃO MUDA ───────────────────────────────────────────────────────────
//!
//! `kind: "import" | "value"` fica. Sólido é lido do código, tracejado é alegado num
//! comentário e nada verifica — a distinção que custou 22 arestas erradas de 26
//! (20/08) e que vale pra qualquer fonte, não só pra TypeScript: um recurso que CITA
//! outro é `value`, um que o IMPORTA é `import`.
//!
//! `generated_at` fica pelo mesmo motivo de sempre: figura velha tem que ser
//! detectável em vez de discutível.
//!
//! ── A FRONTEIRA COM `tools.graph` ────────────────────────────────────────────
//!
//! Este arquivo é o DADO. `tools.graph` é o PROGRAMA — a URL de uma leitura, se tem
//! alguém servindo, e abrir. Um monta o grafo, o outro fala com o app que o desenha, e
//! juntar os dois seria pôr `fetch` no mesmo tipo que descreve um nó.
//!
//! external:    SurrealDB — as arestas de label
//! implemented: nada
//! planned:     packages/graph/
//! depends_on:  packages/interfaces/shared.ts · packages/interfaces/labels.ts
//! checks:      declarado AQUI, nunca importado. `check()` devolve `Finding[]` e o
//!              runner lê a forma, então um check não custa dependência.

/** O que este sistema achou podre. Declarado aqui em vez de importado: o runner lê a
 *  forma, então ter um check não custa dependência de hub. */
export interface Finding {
	path: string;
	says: string;
}

import type { Shared } from "./shared";

export declare namespace GraphSystem {
	/** DE ONDE UM NÓ VEIO. Aberto: a próxima fonte tem que chegar como ela mesma em vez
	 *  de ser recusada por um enum que ninguém lembrou de atualizar.
	 *
	 *  · `contracts`  a varredura de `.ts` — o extractor que já existe
	 *  · `resources`  markdown numa pasta, sob `MY_HOME`
	 *  · `surreal`    as arestas `labeled` e o que mais o banco relaciona */
	export type Source = "contracts" | "resources" | "surreal" | (string & {});

	/** O id CANÔNICO, e é ele que faz duas fontes virarem um nó. Normalizado na
	 *  produção, nunca depois: `find-or-create` por este valor ANTES de inserir. */
	export type NodeId = string;

	/** O QUE O NÓ É, e o que decide como o painel o lê. Aberto pelo mesmo motivo de
	 *  `Source` — um `kind` novo é conhecimento novo, não entrada inválida. */
	export type Kind = "contract" | "resource" | "process" | "label" | (string & {});

	/** UMA FONTE DISSE ISTO SOBRE ESTE NÓ. Guardado por fonte em vez de achatado, porque
	 *  "o disco conhece, o banco não" é a pergunta que faz a proveniência valer a pena —
	 *  achatada, ela vira um booleano que não diz quem discordou. */
	export interface Provenance {
		source: Source;
		/** Onde a fonte guarda isto: um caminho, um record id do Surreal, uma URL. */
		at: string;
		/** O que ESTA fonte sabe e as outras não. O viewer renderiza por `kind`; o
		 *  modelo nunca ramifica nisto. */
		detail?: Record<string, unknown>;
	}

	export interface Node {
		id: NodeId;
		label: string;
		kind: Kind;
		/** TODAS as fontes que conhecem este nó, nunca só a primeira. Uma só já é o caso
		 *  comum; duas é o caso interessante. */
		from: Provenance[];
		/** Os labels do `labels.ts`, resolvidos. Nomes nus, porque é o que se digita. */
		labels?: string[];
	}

	/** SÓLIDO É LIDO, TRACEJADO É ALEGADO. Vale pra qualquer fonte: um recurso que CITA
	 *  outro é `value`, um que o IMPORTA é `import`. */
	export interface Edge {
		source: NodeId;
		target: NodeId;
		kind: "import" | "value";
		/** Quem afirmou a aresta. Duas fontes afirmando a mesma é UMA aresta com duas
		 *  proveniências — a mesma regra dos nós. */
		from: Provenance[];
	}

	export interface Graph {
		nodes: Node[];
		edges: Edge[];
		/** Quais fontes participaram desta montagem. Sem isto, um grafo pela metade
		 *  porque o Surreal estava no chão é indistinguível de um grafo pequeno. */
		sources: Source[];
		/** Carimbado, pra figura velha ser detectável em vez de discutível. */
		generated_at: Shared.Instant;
		/** Dois nós que se importam não têm camada de baixo. Reportado, nunca desenhado
		 *  pra fora. */
		cycles: string[];
	}

	/** UMA FONTE QUE NÃO RESPONDEU. Não é exceção: banco no chão e pasta inexistente são
	 *  respostas ordinárias, e o grafo sai sem ela — com `sources` dizendo qual faltou. */
	export interface Missing {
		source: Source;
		error: string;
	}

	/** UM BLOCO DO PAINEL. O produtor escreve; o viewer renderiza sem saber de que
	 *  `kind` veio. É o que deixa um recurso de empresa e um contrato `.ts` usarem o
	 *  mesmo painel sem que o painel ganhe um `if` por tipo — que é como um viewer
	 *  genérico morre. */
	export interface Section {
		/** `caminho planejado`, `exporta`, `labels`, `citado por`. */
		title: string;
		items: Item[];
	}

	/** UMA LINHA. `code` é dica de RENDER e nada mais — o modelo nunca ramifica nela.
	 *  `to` transforma a linha em navegação, e é o que faz o painel ser um grafo em vez
	 *  de uma ficha. */
	export interface Item {
		text: string;
		code?: boolean;
		to?: NodeId;
	}

	/** TUDO QUE ALIMENTA A VIEW DE DETALHE, e o contrato é esse: se o painel mostra,
	 *  saiu daqui. Painel que busca sozinho é o segundo extractor — a coisa que este
	 *  arquivo inteiro existe pra impedir.
	 *
	 *  `sections` vem do PRODUTOR, porque só ele sabe o que o nó dele tem a dizer.
	 *  `imports`/`cites`/`importedBy` vêm das ARESTAS, derivados aqui — pedir isso a
	 *  cada produtor seria a mesma travessia escrita N vezes, divergindo na primeira. */
	export interface Detail {
		node: Node;
		sections: Section[];
		imports: Node[];
		cites: Node[];
		importedBy: Node[];
	}

	/** A CAPA: o que se lê antes de clicar em nada. Contagens, ciclos, e QUAIS FONTES
	 *  responderam — sem a última, um grafo pela metade porque o banco caiu é
	 *  indistinguível de um grafo pequeno. */
	export interface Overview {
		nodes: number;
		edges: number;
		byKind: Record<Kind, number>;
		sources: Source[];
		missing: Missing[];
		cycles: string[];
		generated_at: Shared.Instant;
	}

	/** QUEM PRODUZ UM GRAFO — e é a razão deste arquivo não conhecer ninguém.
	 *
	 *  NÃO EXISTE `GraphFromContracts` NEM `GraphFromCompanyResources` AQUI. Se
	 *  existissem, `graph` teria que importar `company` pra montar o grafo da empresa, e
	 *  a próxima fonte pediria mais um import — até o modelo do grafo depender de todo
	 *  sistema que alguém quer desenhar, que é a dependência exatamente ao contrário.
	 *
	 *  Então o fluxo se inverte: `company` implementa isto e ENTREGA um grafo. `graph`
	 *  oferece a primitiva e o `merge`, e não sabe que empresa existe. Fonte nova é uma
	 *  implementação a mais, nunca uma edição aqui. */
	export interface Producer {
		/** O nome que vai na proveniência de tudo que este produtor emitir. */
		source: Source;
		/** O que ele conhece. Falha de fora é EVENTO — o produtor devolve `Missing` em
		 *  vez de jogar, porque um banco no chão não pode derrubar o desenho inteiro. */
		produce(): Promise<GraphSystem.Graph | GraphSystem.Missing>;

		/** As seções do painel PARA UM NÓ DELE. Separado de `produce()` de propósito: a
		 *  capa carrega centenas de nós e o detalhe é de um só — montar toda seção de
		 *  todo nó pra desenhar um círculo é o trabalho que ninguém pediu. */
		sections(id: GraphSystem.NodeId): Promise<GraphSystem.Section[]>;
	}
}

/** `my graph <verbo>`. As primitivas: juntar e conferir. Quem BUSCA é um `Producer`,
 *  quem DESENHA é `tools.graph`, e nenhum dos dois mora aqui. */
export interface Graph {
	/** Todo `target` de aresta existe como nó, todo id é único, e toda fonte declarada
	 *  em `sources` aparece em alguma proveniência. Aresta pro vazio é o apodrecimento
	 *  que este desenho existe pra achar. */
	check(graph: GraphSystem.Graph): Finding[];

	/** JUNTA POR ID CANÔNICO, e é o verbo inteiro. Nó repetido soma proveniência em vez
	 *  de duplicar; aresta repetida idem. É a regra de chave natural do @CLAUDE.md — a
	 *  dedup acontece na JUNÇÃO, nunca numa limpeza depois. */
	merge(graphs: GraphSystem.Graph[]): GraphSystem.Graph;

	/** Roda os produtores dados e junta o que voltou. Recebe os produtores POR
	 *  ARGUMENTO — é o que mantém este arquivo sem saber quem são. */
	collect(producers: GraphSystem.Producer[]): Promise<{
		graph: GraphSystem.Graph;
		missing: GraphSystem.Missing[];
	}>;

	/** A CAPA. Derivada do grafo, nunca contada pelo produtor — duas fontes contando o
	 *  mesmo nó somariam dois. */
	overview(graph: GraphSystem.Graph, missing?: GraphSystem.Missing[]): GraphSystem.Overview;

	/** TUDO QUE O PAINEL MOSTRA DE UM NÓ, numa chamada. As seções vêm do produtor que
	 *  reivindica aquele nó; a vizinhança sai das arestas daqui. */
	detail(
		graph: GraphSystem.Graph,
		id: GraphSystem.NodeId,
		producers: GraphSystem.Producer[],
	): Promise<GraphSystem.Detail | undefined>;
}
