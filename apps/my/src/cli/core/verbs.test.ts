//! A colisão que este arquivo existe pra travar: `agents` é pasta no TOPO e
//! dentro de `herdr`, e chavear a frase pelo nome nu fazia a segunda herdar a
//! frase da primeira (medido 22/08).

import { expect, test } from "bun:test";
import { describe as describeNode } from "./router";
import { VERBS, verb } from "./verbs";
import type { Node } from "./scan";

const folder = (name: string, path: string, kids = 3): Node => ({
  name,
  path,
  children: Array.from({ length: kids }, (_, i) => ({ name: `k${i}`, path: `${path}/k${i}`, children: [] })),
});

class Fixture {
  @verb("a frota: despacha trabalho endereçado") agents() {}
  @verb("os agentes vivos NESTA caixa") "herdr/agents"() {}
}
void Fixture;

test("o nome do método ENTRE ASPAS registra o endereço aninhado", () => {
  expect(VERBS.get("herdr/agents")).toBe("os agentes vivos NESTA caixa");
});

test("duas pastas com o mesmo nome não trocam de frase", () => {
  expect(describeNode(folder("agents", "agents"))).toBe("a frota: despacha trabalho endereçado");
  expect(describeNode(folder("agents", "herdr/agents"))).toBe("os agentes vivos NESTA caixa");
});

test("pasta que ninguém descreveu cai na contagem, nunca na frase de outra", () => {
  expect(describeNode(folder("agents", "teams/agents", 5))).toBe("5 subcomandos");
});
