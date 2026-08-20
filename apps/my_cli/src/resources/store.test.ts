//! O que quebraria calado: o KIND que sai do caminho, o alias, o span por nome lido, e
//! a contagem do `--grep`.
//!
//! O `--grep` conta OCORRÊNCIAS, e é aí que ele erra em silêncio: um `grep -c` conta
//! LINHAS, e a diferença só aparece quando o termo repete na mesma linha — que é
//! justamente o caso de um recurso que fala do assunto. Um teste com uma ocorrência por
//! linha passaria com as duas implementações e não provaria nada.

import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compila, grep } from "./index.ts";
import { index, memoryStore, resolve, type Resource } from "./store.ts";

function casa(arquivos: Record<string, string>): Resource[] {
	const raiz = mkdtempSync(join(tmpdir(), "res-"));
	for (const [rel, texto] of Object.entries(arquivos)) {
		const caminho = join(raiz, rel);
		mkdirSync(join(caminho, ".."), { recursive: true });
		writeFileSync(caminho, texto);
	}
	return index(raiz);
}

test("o KIND sai do caminho: dentro de references/ é reference, o resto é a pasta", () => {
	const rs = casa({
		"03_resources/references/clis/a.md": "a",
		"03_resources/notes/b.md": "b",
		"03_resources/mukutu/mkt_funnel/c.md": "c",
		"01_projects/x/references/d.md": "d",
	});
	expect(Object.fromEntries(rs.map((r) => [r.name, r.kind]))).toEqual({
		a: "references",
		b: "notes",
		c: "mukutu",
		d: "references",
	});
});

test("CONTEXT.md é o mapa — salvo quando é a única página da subárvore", () => {
	const rs = casa({
		"03_resources/references/x/CONTEXT.md": "mapa",
		"03_resources/references/x/a.md": "a",
		"03_resources/references/contracts/CONTEXT.md": "a promessa",
	});
	// O de `x/` some (tem irmão pra mapear); o de `contracts/` entra pelo nome da pasta.
	expect(rs.map((r) => r.name).sort()).toEqual(["a", "contracts"]);
});

test("um processo é a PASTA, e o CONTEXT.md dela é o corpo", () => {
	const rs = casa({ "02_areas/00_workflows/02_system/004_do_a_drip/CONTEXT.md": "as fases" });
	expect(rs).toHaveLength(1);
	expect(rs[0]!).toMatchObject({ name: "004_do_a_drip", kind: "processes", body: "as fases" });
});

test("alias resolve pra MESMA página, e o nome do arquivo ganha de alias alheio", () => {
	const rs = casa({
		"03_resources/references/a/askuser.md": "---\naliases: interview, human_gate\n---\n",
		"03_resources/references/a/human_gate.md": "outra",
	});
	expect(resolve("interview", rs).name).toBe("askuser");
	expect(resolve("human_gate", rs).name).toBe("human_gate");
});

test("nome repetido não sorteia: derruba com os DOIS caminhos", () => {
	const rs = casa({ "03_resources/rules/x.md": "a", "03_resources/templates/x.md": "b" });
	expect(() => resolve("x", rs)).toThrow(/rules\/x\.md e .*templates\/x\.md/s);
});

test("check: menção pro vazio é achado; dentro de fence é exemplo", () => {
	const rs = casa({
		"03_resources/references/a/vivo.md": "veja `my references morto`\n",
		"03_resources/references/a/exemplo.md": "```bash\nmy references tambem_morto\n```\n",
	});
	const nomes = new Set(rs.flatMap((r) => [r.name, ...r.aliases]));
	const dangling = rs.flatMap((r) => r.mentions.filter((m) => !nomes.has(m)));
	expect(dangling).toEqual(["morto"]);
});

test("read abre UM SPAN POR NOME, e o span É o nome do recurso", () => {
	const s = memoryStore();
	const [a, b] = [index()[0]!, index()[1]!];
	s.read([a.name, b.name]);
	expect(s.spans().map((sp) => sp.verb).sort()).toEqual([a.name, b.name].sort());
});

test("unread cai quando alguém lê — é o que faz dele medição", () => {
	const s = memoryStore();
	const alvo = index()[0]!.name;
	const desde = new Date(Date.now() - 864e5).toISOString();
	expect(s.unread(desde).map((u) => u.what)).toContain(alvo);
	s.read([alvo]);
	expect(s.unread(desde).map((u) => u.what)).not.toContain(alvo);
});

test("grep conta OCORRÊNCIAS, não linhas — três na mesma linha valem três", () => {
	const rs = casa({ "03_resources/a/x.md": "askuser askuser askuser\noutra coisa\n" });
	const [achado] = grep(compila("askuser", false) as RegExp, rs);
	expect(achado!.ocorrencias).toBe(3);
	// Uma linha só, e é o que separa isto de um `grep -c`.
	expect(achado!.linhas).toEqual([1]);
});

test("grep ignora caixa por padrão, e -s obedece", () => {
	const rs = casa({ "03_resources/a/x.md": "AskUser askuser ASKUSER\n" });
	expect(grep(compila("askuser", false) as RegExp, rs)[0]!.ocorrencias).toBe(3);
	expect(grep(compila("askuser", true) as RegExp, rs)[0]!.ocorrencias).toBe(1);
});

test("grep é regex de verdade, não substring", () => {
	const rs = casa({ "03_resources/a/x.md": "rocksdb e rocks db e rocksDB\n" });
	expect(grep(compila("rocks ?db", false) as RegExp, rs)[0]!.ocorrencias).toBe(3);
	expect(compila("[askuser", false)).toMatch(/regex inválida/);
});
