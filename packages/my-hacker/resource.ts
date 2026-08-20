//! `Resource` COMO VALOR — a página vira código, e a identidade vira o conteúdo.
//!
//! EXPERIMENTO, aberto em 20/08. Esta casa já tem `Resource` como ENTIDADE
//! (@biliboss/interfaces/resources.ts): um markdown em `03_resources/`, achado por
//! varredura, com `path` na identidade. Este arquivo testa a outra forma, e a
//! diferença não é o formato — é a IDENTIDADE.
//!
//! O ID É O SHA-1 DO CONTEXTO, e é isso que faz dele um ValueObject de verdade: um
//! recurso não tem existência separada do que ele diz. Dois recursos com o mesmo
//! texto SÃO o mesmo recurso, ainda que estejam em dois arquivos; e mudar uma vírgula
//! cria um recurso novo em vez de "editar" um que continua com o mesmo nome. Uma
//! entidade tem identidade que sobrevive à mudança de todos os campos — um recurso
//! não deveria ter, e o `path` estava fazendo o papel de identidade por acidente.
//!
//! O QUE ISSO COMPRA, e é o que o experimento vai medir:
//!
//!   · citar por HASH é citar o texto exato que se leu, não "o arquivo com esse nome
//!     hoje". A citação para de apodrecer sem ninguém perceber.
//!   · o `name` vira ROTULO e não chave — dois recursos podem se chamar `surrealdb`
//!     e serem revisões diferentes, e a versão que um agente leu é reconstruível.
//!   · TypeScript checa o que o front matter não checava.
//!
//! O QUE ELE CUSTA: markdown se lê no GitHub e se edita sem build. Um recurso em `.ts`
//! não. Se o experimento morrer, é por isso.
//!
//! SHA-1 E NÃO SHA-256, e não é descuido: isto não é assinatura, é ENDEREÇO. A
//! propriedade que importa é "mesmo texto, mesmo id", e colisão adversarial não faz
//! sentido num corpus que a própria casa escreve. Sete hexas bastam pra citar — é a
//! mesma régua do `git`, pelo mesmo motivo.

import { createHash } from "node:crypto";

/** Um recurso, pelo valor. Sem `path`: onde ele está no disco é acidente de
 *  organização, e pôr isso na identidade foi o que amarrou a citação ao arquivo. */
export interface Resource {
	/** SHA-1 de `context`, hex. Derivado, NUNCA escrito à mão. */
	readonly id: string;
	/** Como se chama isto na conversa. Rótulo, não chave. */
	readonly name: string;
	/** A LENTE que carrega este recurso — `hacker` lê CLI, script, editor, harness. */
	readonly lens: "hacker" | "hustler" | "hipster";
	/** Uma linha: o que este recurso responde. É o que aparece numa lista. */
	readonly answers: string;
	/** O CONTEXT STRING — o texto inteiro, do jeito que entra num prompt. */
	readonly context: string;
	/** Quando isto foi MEDIDO. Um recurso da lente hacker sem data é uma opinião. */
	readonly at: string;
}

/** MONTA e carimba. O `id` não é parâmetro de propósito: um id passado de fora é um
 *  id que pode discordar do conteúdo, e aí a propriedade inteira cai. */
export const resource = (r: Omit<Resource, "id">): Resource => ({
	...r,
	id: createHash("sha1").update(r.context).digest("hex"),
});

/** Os sete primeiros hexas, pra citar em prosa — `#a3f9c21`. */
export const short = (r: Resource): string => `#${r.id.slice(0, 7)}`;
