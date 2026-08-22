//! O NOME do clone: a única lógica de `clone.ts` que não é chamada ao herdr.
//!
//! Errar aqui dá dois panes com o mesmo nome — e o nome é como um humano
//! endereça o clone, então dois `worker-1` é trabalho indo pro pane errado.
//!
//! depends_on: src/agents/clone.ts
//! impacts:    —

import { expect, test } from 'bun:test'
import { agents, AgentsDelegation } from './agents.ts'

test('o sufixo `-N` sai do nome, e quem não tem é o original', () => {
  expect(agents.clone.nomeDoClone('worker')).toEqual({ base: 'worker', n: 0 })
  expect(agents.clone.nomeDoClone('worker-2')).toEqual({ base: 'worker', n: 2 })
  // Hífen no meio não é sufixo: `worker-fila` é nome, não clone número `fila`.
  expect(agents.clone.nomeDoClone('worker-fila')).toEqual({ base: 'worker-fila', n: 0 })
})

test('o próximo N olha os IRMÃOS, não conta na mão', () => {
  expect(agents.clone.proximoN('worker', ['worker'])).toBe(1)
  expect(agents.clone.proximoN('worker', ['worker', 'worker-1', 'worker-2'])).toBe(3)
  // Buraco não é preenchido: o número é endereço, e reusar faria dois panes
  // atenderem pelo mesmo nome em dois momentos.
  expect(agents.clone.proximoN('worker', ['worker-1', 'worker-3'])).toBe(4)
  // Clone de OUTRO agente na mesma aba não empurra a numeração deste.
  expect(agents.clone.proximoN('worker', ['outro-1', 'outro-2'])).toBe(1)
})

test('o nome curto tira o número ANTES de encurtar', () => {
  // `…standalone-1` encurtado primeiro perderia o `-1`, e o segundo clone
  // renasceria `-1` por cima do primeiro.
  const x = agents.clone.nomeDoClone('Setup study_bloom project with bloom standalone-1')
  expect(x.n).toBe(1)
  expect(agents.clone.baseCurta(x.base)).toBe('Setup-study_bloom-projec')
  expect(agents.clone.baseCurta('worker fila')).toBe('worker-fila')
})

test("o ask é UMA linha: o processo, e as duas pontas", () => {
	const pool = new AgentsDelegation(agents);
	const out = pool.ask("03_resources/.../feature_delivery/CONTEXT.md", "output/969_x");

	// UMA linha, e não é estética: o herdr recusa prompt com `\n` — medido 22/08,
	// três linhas curtas foram recusadas e o mesmo texto numa linha subiu.
	expect(out).not.toContain("\n");
	expect(out).toContain("03_resources/.../feature_delivery/CONTEXT.md");
	// Input e output são a MESMA pasta: o pedido e o que ele virou, lado a lado.
	expect(out.split("output/969_x").length - 1).toBe(1);
	// O que ele NÃO carrega é o ponto: nada de pedido colado, nada de contrato.
	expect(out.length).toBeLessThan(400);
});
