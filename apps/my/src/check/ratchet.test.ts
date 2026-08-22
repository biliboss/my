//! O parser da saída do `bun test` — as três regras que a catraca usa pra dizer
//! "teste quebrado", e que já erraram uma vez cada.
//!
//! Testa `falhasDaSaida` e não `testesQueFalham`: a segunda faz `spawnSync` da
//! suíte inteira, e um teste que roda a suíte de dentro da suíte é recursão, não
//! prova. A parte que erra é a leitura, e ela é pura.
//!
//! depends_on: src/check/ratchet.ts

import { expect, test } from "bun:test";
import { falhasDaSaida } from "./ratchet.ts";

const SUMARIO = "Ran 166 tests across 29 files. [13.10s]";

test("nomeia cada `(fail)`, sem contar duas vezes o mesmo nome", () => {
	const saida = ["(fail) a barra sai na ordem de `position` [7.00ms]", "(fail) resolveRun: nome inteiro resolve [1.20ms]", " 165 pass", " 2 fail", SUMARIO].join("\n");
	expect(falhasDaSaida(saida, 1)).toEqual(["a barra sai na ordem de `position`", "resolveRun: nome inteiro resolve"]);
});

test("SEM o sumário é runner morto no meio — joga, nunca devolve zero falha", () => {
	// É o coração desta task: `bun test src/` (sem `./`) casava um `.test.mjs` com
	// `process.exit()` que matava o runner, e a catraca lia a saída truncada como
	// "nenhuma falha" — 47 rodadas de verde falso. Zero falha só vale COM sumário.
	const truncada = ["src/vscode/set.test.ts:", "(pass) alguma coisa [1.00ms]"].join("\n");
	expect(() => falhasDaSaida(truncada, 0)).toThrow(/Ran N tests/);
});

test("exit != 0 que o parser não sabe explicar vira falha nomeada", () => {
	// O runner é a autoridade; o regex só dá nome. Saiu 1 e nada casou = formato
	// novo ou crash fora de teste, e ler isso como zero é confiar no parser contra
	// o runner.
	const limpa = [" 166 pass", " 0 fail", SUMARIO].join("\n");
	expect(falhasDaSaida(limpa, 1)).toEqual(["bun test saiu 1 sem nomear falha — a saída mudou de formato?"]);
	expect(falhasDaSaida(limpa, 0)).toEqual([]);
});

test("módulo que nem carrega entra pelo NOME do arquivo", () => {
	const saida = ["src/system/metrics.test.ts:", "# Unhandled error between tests", " 0 pass", SUMARIO].join("\n");
	expect(falhasDaSaida(saida, 1)).toEqual(["módulo não carrega: src/system/metrics.test.ts"]);
});
