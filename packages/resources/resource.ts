//! O RECURSO COMO VALOR — a página vira código, e a identidade vira o conteúdo.
//!
//! Ressuscitado de `1531af7`, onde ele morreu por motivo certo e desenho errado: era
//! `packages/my-hacker`, uma LENTE virada pacote com loja própria, e
//! `resources.ts` recusa isso — três leituras de uma loja, nunca três lojas. O
//! `Resource` não era o problema; o pacote por lente era.
//!
//! O ID É O SHA-1 DO CORPO, e é isso que faz dele ValueObject de verdade: um recurso
//! não tem existência separada do que diz. Dois com o mesmo texto SÃO o mesmo recurso
//! ainda que em dois arquivos, e mudar uma vírgula cria um novo em vez de "editar" um
//! que continua com o mesmo nome.
//!
//! O QUE ISSO COMPRA, e é o que este pacote existe pra medir: citar por HASH é citar
//! o texto que se leu, não "o arquivo com esse nome hoje". Uma citação para de
//! apodrecer sem ninguém perceber.
//!
//! SHA-1 E NÃO SHA-256: isto é ENDEREÇO, não assinatura. A propriedade que importa é
//! "mesmo texto, mesmo id", e colisão adversarial não faz sentido num corpus que a
//! própria casa escreve. Sete hexas bastam pra citar — mesma régua do git.
//!
//! depends_on: @my/interfaces/resources.ts

import { createHash } from "node:crypto";
import type { ResourceSystem } from "@my/interfaces/resources.ts";

/** Um recurso EM CÓDIGO. `path` continua no contrato porque um markdown da casa tem
 *  um; um `.ts` deste pacote põe o próprio caminho ali, e o `id` é quem identifica. */
export type Resource = ResourceSystem.Entities.Resource & {
	/** SHA-1 de `body`, hex. Derivado, NUNCA escrito à mão. */
	readonly id: string;
	/** Uma linha: o que este recurso responde. É o que aparece numa lista. */
	readonly answers: string;
	/** Quando foi MEDIDO. Um recurso da lente hacker sem data é uma opinião. */
	readonly at: string;
	/** Qual lente carrega. É o que substitui a lista de pastas — a lente é o rótulo
	 *  (@my/interfaces/labels.ts), não o diretório onde o arquivo caiu. */
	readonly lens: "hustler" | "hacker" | "hipster";
};

type Entrada = Omit<Resource, "id" | "path" | "aliases" | "mentions"> & {
	path?: string;
	aliases?: string[];
	mentions?: string[];
};

/** MONTA e carimba. O `id` não é parâmetro de propósito: um id vindo de fora é um id
 *  que pode discordar do conteúdo, e aí a propriedade inteira cai. */
export const resource = (r: Entrada): Resource => ({
	...r,
	// DEPOIS do spread, nunca antes: com os defaults em cima, um `aliases` vindo do
	// chamador era sobrescrito por `[]` e sumia em silêncio. O `tsc` acusou
	// (TS2783) porque a chave aparecia duas vezes — sem `strict`, isto passava.
	path: r.path ?? "",
	aliases: r.aliases ?? [],
	mentions: r.mentions ?? [],
	id: createHash("sha1").update(r.body).digest("hex"),
});

/** Os sete primeiros hexas, pra citar em prosa — `#a3f9c21`. */
export const short = (r: { id: string }): string => `#${r.id.slice(0, 7)}`;
