//! "Resolve por prefixo, e AMBÍGUO É ERRO" — a regra, num lugar só.
//!
//! Estava escrita cinco vezes (task, sprint, run em dois arquivos, e o
//! `resolveRun` do meta), com duas linhas byte a byte idênticas. O custo já foi
//! cobrado uma vez: o comentário de `meta.ts` conta que o `find` devolvia o
//! primeiro do `readdir` — ordem de disco, não escolha de ninguém — e que a
//! correção teve que ser aplicada DUAS vezes, aqui e no `workflows/tree.ts`,
//! porque a regra morava em dois lugares.
//!
//! O que NÃO muda de dono: a mensagem de "não achei nada". Cada consumidor sabe
//! o que oferecer a quem errou (`my sprints new`, `my runs` pra listar), e essa
//! frase é dele. O que unifica é o CASAMENTO e a AMBIGUIDADE.
//!
//! depends_on: —
//! impacts:    src/tasks/model.ts · src/sprints/model.ts · src/sprints/run.ts
//! impacts:    src/runs.ts · src/meta.ts

/** `7` → `007`. Só número puro: `007_slug` volta `null`, porque ele já é o nome
 *  inteiro e casa por igualdade, não por número. */
export const nnn = (alvo: string): string | null =>
	/^\d+$/.test(alvo) ? String(Number(alvo)).padStart(3, "0") : null;

/** A renumeração de 17/08: o esquema velho contava pra CIMA desde 001 e o novo
 *  conta pra BAIXO desde 999, então `NNN → 1000 - NNN`.
 *
 *  Tem nome porque é um ESPELHO, e espelho solto vira chave por acidente — o
 *  `CLAUDE.md` da raiz proíbe isso por nome. Estava escrito à mão em três
 *  lugares do `meta.ts`. */
export const espelho1000 = (n: string | number): string =>
	String(1000 - Number(n)).padStart(3, "0");

export type Achado<T> = { hit: T } | { erro: string };

/** As peneiras, DA MAIS ESPECÍFICA PRA MAIS FROUXA. A primeira que pega alguma
 *  coisa decide — e é isso que impede ambiguidade inventada: quem digitou o nome
 *  exato não é punido porque outro item o tem como prefixo.
 *
 *  Cada rótulo é testado INTEIRO e pelo último segmento. Rótulo de run e de
 *  sprint é um nome só (`999_via`), mas o de task é o caminho dentro do projeto
 *  (`sprints/999_x/tasks/001_y`) — e é ele que precisa aparecer na lista de
 *  candidatos, senão o erro não diz o que digitar. Sem testar o segmento, `my
 *  tasks start 1` não casaria nada: `001_` não é prefixo do caminho. */
function peneiras(rotulos: string[], alvo: string): number[][] {
	const n = nnn(alvo);
	const base = (r: string) => r.split("/").pop()!;
	const idx = (f: (r: string) => boolean) => rotulos.map((r, i) => (f(r) || f(base(r)) ? i : -1)).filter((i) => i >= 0);
	return [
		idx((r) => r === alvo),
		n ? idx((r) => r === n || r.startsWith(`${n}_`)) : [],
		idx((r) => r.startsWith(alvo)),
		idx((r) => r.includes(alvo)),
	];
}

/** O item que `alvo` nomeia, ou o erro que LISTA OS CANDIDATOS.
 *
 *  Listar é o ponto: é a lista que faz quem errou descobrir na hora, em vez de
 *  gastar turnos procurando.
 *
 *  - `oQue` entra depois da contagem (`casa 3 runs: …`) — substantivo, não frase.
 *  - `dica` é o rabicho do fim ("passe o caminho", "use o nome inteiro").
 *
 *  0 candidatos NÃO é erro daqui — volta `undefined` pra que o chamador diga a
 *  frase dele, que costuma carregar o comando de criar o que falta. */
export function resolvePorPrefixo<T>(
	itens: T[],
	alvo: string,
	rotulo: (t: T) => string,
	opts: { oQue?: string; dica?: (hits: T[]) => string } = {},
): Achado<T> | undefined {
	const rotulos = itens.map(rotulo);
	const hits = peneiras(rotulos, alvo).find((p) => p.length > 0);
	if (!hits) return undefined;
	if (hits.length === 1) return { hit: itens[hits[0]!]! };
	const candidatos = hits.map((i) => rotulos[i]!);
	const quantos = `${hits.length}${opts.oQue ? ` ${opts.oQue}` : ""}`;
	const rabicho = opts.dica ? opts.dica(hits.map((i) => itens[i]!)) : "";
	return { erro: `"${alvo}" casa ${quantos}: ${candidatos.join(", ")}${rabicho}` };
}
