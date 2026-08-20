//! O `--json` de cada check devolve as chaves que o `--help` PROMETE?
//!
//! Existe porque chave errada não estoura — ela CONCORDA. Medido 20/08, três vezes
//! no mesmo dia por quem escrevia prova: `context` lido como `acima_do_teto` (a
//! chave é `achados`), `projects.findings` tratado como número (é array), e
//! `reciprocal` lido como `achados` (as chaves são edges/files/missing/floor). Nos
//! três o `d.get("chave")` devolveu zero e a prova passou a medir NADA — uma delas
//! quase virou task apagada por "trabalho já feito".
//!
//! Documentar no `--help` (o que a task 012 fez) diz qual é o contrato; este
//! arquivo é o que o torna EXIGÍVEL. Renomear uma chave sem mexer aqui reprova, e
//! quem renomeia descobre no mesmo commit — não três semanas depois, num número da
//! catraca que baixou sozinho.
//!
//! O que ele NÃO cobre, de propósito: os tipos DENTRO dos arrays. O achado de cada
//! check é dele, muda com a regra, e travar isso aqui daria a segunda fonte que o
//! próprio check já é.
//!
//! depends_on: src/check/citations.ts · src/check/reciprocal.ts · src/check/ratchet.ts
//! impacts:    src/check/ratchet.ts

import { expect, test } from "bun:test";
import { resolve } from "node:path";

const HERE = import.meta.dir;

/** As chaves de TOPO de cada `--json`, medidas em 20/08 — e a medida que a catraca
 *  lê de cada uma, quando lê. `null` = fora da catraca. */
const CONTRATO: Record<string, { chaves: string[]; catraca: string | null }> = {
	citations: { chaves: ["scanned", "kinds", "findings"], catraca: "findings" },
	okf: { chaves: ["total", "sem", "divergente", "duvida", "symlink"], catraca: "sem" },
	resources: { chaves: ["orfaos", "report"], catraca: "orfaos" },
	maps: { chaves: ["sem_mapa", "findings"], catraca: "sem_mapa" },
	projects: { chaves: ["projects", "findings"], catraca: "findings" },
	untracked: { chaves: ["fontes", "findings"], catraca: "fontes" },
	notes: { chaves: ["padrao", "achados"], catraca: "achados" },
	context: { chaves: ["teto", "achados"], catraca: "achados" },
	reciprocal: { chaves: ["edges", "files", "missing", "floor"], catraca: "missing" },
	pointers: { chaves: ["total", "dead", "findings"], catraca: "dead" },
	rules: { chaves: ["regras", "fora_do_lugar", "findings"], catraca: "fora_do_lugar" },
	references: { chaves: ["referencias", "mencoes", "findings"], catraca: "mencoes" },
	verdicts: { chaves: ["total", "findings"], catraca: null },
	gates: { chaves: ["gates", "rodados", "falhou"], catraca: null },
};

async function json(check: string): Promise<Record<string, unknown>> {
	const p = Bun.spawnSync(["bun", "run", resolve(HERE, `${check}.ts`), "--json"], { cwd: resolve(HERE, "../..") });
	const saida = p.stdout.toString();
	// Exit 1 é ACHADO, não falha — é o estado normal destes checks.
	expect(p.exitCode, `${check} morreu (exit ${p.exitCode}): ${p.stderr.toString().slice(0, 300)}`).toBeLessThan(2);
	return JSON.parse(saida) as Record<string, unknown>;
}

for (const [check, { chaves, catraca }] of Object.entries(CONTRATO)) {
	test(`${check} --json entrega as chaves que o --help promete`, async () => {
		const d = await json(check);
		// SUPERSET e não igualdade: acrescentar chave é retrocompatível, TIRAR não é.
		// Quem consome lê por nome, então o que quebra o consumidor é a ausência.
		expect(Object.keys(d).sort()).toEqual(expect.arrayContaining(chaves));

		// A medida da catraca precisa ser LEGÍVEL como número — é o passo que faltava
		// nas três leituras erradas: a chave existia, mas o consumidor somava outra coisa.
		if (catraca) {
			const v = d[catraca];
			const n = Array.isArray(v) ? v.length : v;
			expect(typeof n, `${check}.${catraca} não vira número (é ${typeof v})`).toBe("number");
		}
	});
}

test("o --help ENSINA o shape — a doc e o código não podem divergir", () => {
	for (const check of Object.keys(CONTRATO)) {
		const p = Bun.spawnSync(["bun", "run", "src/cli/my.ts", "check", check, "--help"], { cwd: resolve(HERE, "../..") });
		const ajuda = `${p.stdout.toString()}${p.stderr.toString()}`;
		expect(ajuda, `my check ${check} --help não mostra o shape do --json`).toContain("--json →");
	}
});
