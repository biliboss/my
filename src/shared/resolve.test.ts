//! A regra que os cinco consumidores passaram a compartilhar: se ela quebrar
//! aqui, quebra em task, sprint, run e meta ao mesmo tempo.
//!
//! O teste que importa é o da AMBIGUIDADE: era o bug de 17/08, em que o `find`
//! devolvia o primeiro do `readdir` e o agente trabalhava meia hora no run
//! errado. Um resolvedor que escolhe sozinho passa em todo teste de "achou".
//!
//! depends_on: src/shared/resolve.ts
//! impacts:    —

import { expect, test } from "bun:test";
import { espelho1000, nnn, resolvePorPrefixo } from "./resolve.ts";

const acha = (rotulos: string[], alvo: string, opts?: { oQue?: string; dica?: (h: string[]) => string }) =>
	resolvePorPrefixo(rotulos, alvo, (r) => r, opts);

test("número vira NNN, e nome inteiro não", () => {
	expect(nnn("7")).toBe("007");
	expect(nnn("007")).toBe("007");
	expect(nnn("999")).toBe("999");
	// Já é o nome: casa por igualdade, não por número.
	expect(nnn("007_slug")).toBeNull();
	expect(nnn("via")).toBeNull();
});

test("AMBÍGUO É ERRO, e o erro LISTA os candidatos", () => {
	// O bug de 17/08: `996` casava três runs e o `find` devolvia o do readdir.
	const r = acha(["996_a", "996_b", "996_c"], "996");
	expect(r).toEqual({ erro: '"996" casa 3: 996_a, 996_b, 996_c' });
});

test("a dica entra no fim do erro, e recebe os candidatos", () => {
	const r = acha(["001_x", "001_y"], "1", { dica: (h) => ` — passe o caminho, ex. \`${h[0]}\`` });
	expect(r).toEqual({ erro: '"1" casa 2: 001_x, 001_y — passe o caminho, ex. `001_x`' });
});

test("`oQue` entra depois da CONTAGEM, não depois da lista", () => {
	// O `meta.ts` promete `casa 3 runs: …`, e o teste dele afere esse formato.
	// Enfiar o substantivo no fim ("…, 997_z runs") passa no olho e falha no regex.
	const r = acha(["997_a", "997_b"], "997", { oQue: "runs", dica: () => " — use o nome inteiro" });
	expect(r).toEqual({ erro: '"997" casa 2 runs: 997_a, 997_b — use o nome inteiro' });
	expect((r as { erro: string }).erro).toMatch(/casa \d+ runs.*use o nome inteiro/);
});

test("nada casa devolve `undefined` — a frase é do chamador", () => {
	// Não é `{erro}`: quem chama sabe oferecer `my sprints new`, e essa frase
	// carrega o comando de criar o que falta.
	expect(acha(["001_x"], "zzz")).toBeUndefined();
	expect(acha([], "1")).toBeUndefined();
});

test("EXATO ganha de prefixo — ambiguidade inventada é o pior erro", () => {
	// Quem digitou o nome inteiro não pode ser punido porque outro item o tem
	// como prefixo. Sem a cascata, isto seria `casa 2`.
	expect(acha(["999_via", "999_via_extra"], "999_via")).toEqual({ hit: "999_via" });
	// E o prefixo que NÃO é exato continua ambíguo, que é o certo.
	expect(acha(["999_via", "999_via_extra"], "999_v")).toHaveProperty("erro");
});

test("NNN ganha de substring", () => {
	// `003` não pode casar `100_003_coisa` por substring enquanto existe a 003.
	expect(acha(["003_certa", "100_003_coisa"], "003")).toEqual({ hit: "003_certa" });
	expect(acha(["003_certa", "100_003_coisa"], "3")).toEqual({ hit: "003_certa" });
});

test("substring é a última peneira, e só quando nada acima pegou", () => {
	expect(acha(["999_viacorretor"], "corretor")).toEqual({ hit: "999_viacorretor" });
	expect(acha(["999_viacorretor", "998_corretora"], "corretor")).toHaveProperty("erro");
});

test("rótulo com caminho casa pelo último segmento E pelo caminho inteiro", () => {
	// O rótulo de task é `sprints/999_x/tasks/001_y`. Sem testar o segmento,
	// `001_` não é prefixo do caminho e `my tasks start 1` não acharia nada.
	const tasks = ["sprints/999_x/tasks/001_y", "sprints/999_x/tasks/002_z"];
	expect(resolvePorPrefixo(tasks, "1", (r) => r)).toEqual({ hit: "sprints/999_x/tasks/001_y" });
	expect(resolvePorPrefixo(tasks, "001_y", (r) => r)).toEqual({ hit: "sprints/999_x/tasks/001_y" });
	// E o caminho inteiro continua casando — é como se pede uma sprint específica.
	expect(resolvePorPrefixo(tasks, "999_x", (r) => r)).toHaveProperty("erro");
	// O erro lista o CAMINHO, que é o que quem errou precisa digitar.
	const r = resolvePorPrefixo(tasks, "999_x", (x) => x) as { erro: string };
	expect(r.erro).toContain("sprints/999_x/tasks/001_y");
});

test("espelho 1000 − n, com o zero à esquerda de volta", () => {
	// Era três expressões soltas no meta.ts. `004` → `996`, e o padStart importa:
	// sem ele, `1000-999` sai "1" e o caminho não resolve.
	expect(espelho1000("004")).toBe("996");
	expect(espelho1000(4)).toBe("996");
	expect(espelho1000("999")).toBe("001");
	expect(espelho1000("001")).toBe("999");
});
