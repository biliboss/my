import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MARK, apply, check, existing, plan, thesisOf, workflows } from "./index.ts";

let house = "";
const saved = process.env.MY_HOME;

const workflow = (rel: string, text: string) => {
	const dir = join(house, "03_resources", "00_company", rel);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "CONTEXT.md"), text);
};

const doc = (body: string, extra = "") => `---\ntype: workflow\n${extra}---\n\n${body}\n`;

beforeEach(() => {
	house = mkdtempSync(join(tmpdir(), "company-"));
	mkdirSync(join(house, ".claude", "skills"), { recursive: true });
	process.env.MY_HOME = house;
});

afterEach(() => {
	if (saved === undefined) delete process.env.MY_HOME;
	else process.env.MY_HOME = saved;
	rmSync(house, { recursive: true, force: true });
});

test("only a CONTEXT.md carrying `type: workflow` counts", () => {
	workflow("shared_workflows/research", doc("# research\n\n**Uma tese que é uma frase inteira e termina em ponto.**"));
	mkdirSync(join(house, "03_resources", "00_company", "notes"), { recursive: true });
	writeFileSync(join(house, "03_resources", "00_company", "notes", "CONTEXT.md"), "---\ntype: context\n---\n\n# x\n");
	expect(workflows().map((w) => w.name)).toEqual(["research"]);
});

test("the stream is `shared` for shared_workflows and the top folder otherwise", () => {
	workflow("shared_workflows/research", doc("# research\n\n**Uma tese que é uma frase inteira e termina em ponto.**"));
	workflow("02_deliver_what_sell/01_plan/request_to_issue", doc("# r\n\n**Outra tese que é uma frase inteira e termina em ponto.**"));
	const by = Object.fromEntries(workflows().map((w) => [w.name, w.stream]));
	expect(by.research).toBe("shared");
	expect(by.request_to_issue).toBe("02_deliver_what_sell");
});

test("a bold fragment that is not a sentence is refused", () => {
	expect(thesisOf("texto **. Não é conselho: é o portão** mais texto")).toBeUndefined();
	expect(thesisOf("**→ `TaskStop` no monitor, e ele fica vivo demais tempo**")).toBeUndefined();
	expect(thesisOf("**Uma tese que é uma frase inteira e termina em ponto.**")).toBe(
		"Uma tese que é uma frase inteira e termina em ponto.",
	);
});

test("mermaid and markdown links never reach a description", () => {
	expect(thesisOf("**Coordinator->>Run: lê o passo e devolve o artefato fechado.**")).toBeUndefined();
	expect(thesisOf("**Esta família serve ao projeto [corretor](../x/CONTEXT.md) e mais nada.**")).toBeUndefined();
});

test("`NN_` is stripped and a leading `_` folder produces no skill", () => {
	workflow("02_deliver_what_sell/03_validate", doc("# v\n\n**Uma tese que é uma frase inteira e termina em ponto.**"));
	workflow("02_deliver_what_sell/_contract", doc("# c\n\n**Outra tese que é uma frase inteira e termina em ponto.**"));
	expect(plan().map((p) => p.skill)).toEqual(["my_validate"]);
});

test("apply writes one marked skill per workflow, and is idempotent", () => {
	workflow("shared_workflows/research", doc("# research\n\n**Uma tese que é uma frase inteira e termina em ponto.**"));
	const first = apply();
	expect(first.written).toEqual(["my_research"]);

	const text = readFileSync(join(house, ".claude", "skills", "my_research", "SKILL.md"), "utf8");
	expect(text).toContain(MARK);
	expect(text).toContain("name: my_research");
	expect(text).toContain("shared_workflows/research/CONTEXT.md");

	const second = apply();
	expect(second.written).toEqual([]);
	expect(second.unchanged).toEqual(["my_research"]);
});

test("a hand-written skill with the same name is never overwritten", () => {
	workflow("shared_workflows/research", doc("# research\n\n**Uma tese que é uma frase inteira e termina em ponto.**"));
	const dir = join(house, ".claude", "skills", "my_research");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "SKILL.md"), "---\ntype: skill\nname: my_research\n---\n\nescrito à mão\n");

	const out = apply();
	expect(out.written).toEqual([]);
	expect(out.gaps.some((g) => g.gap.includes("escrito à mão"))).toBe(true);
	expect(readFileSync(join(dir, "SKILL.md"), "utf8")).toContain("escrito à mão");
});

test("a generated skill whose workflow is gone is removed; a hand-written one is not", () => {
	workflow("shared_workflows/research", doc("# research\n\n**Uma tese que é uma frase inteira e termina em ponto.**"));
	apply();
	rmSync(join(house, "03_resources", "00_company", "shared_workflows", "research"), { recursive: true });

	const orphan = join(house, ".claude", "skills", "my_written_by_hand");
	mkdirSync(orphan, { recursive: true });
	writeFileSync(join(orphan, "SKILL.md"), "---\ntype: skill\n---\n\nminha\n");

	const out = apply();
	expect(out.removed).toEqual(["my_research"]);
	expect(readdirSync(join(house, ".claude", "skills"))).toContain("my_written_by_hand");
	expect(existing()).toEqual([]);
});

test("a declared `skill:` beats the derived thesis and carries its triggers", () => {
	workflow(
		"shared_workflows/do_a_drip",
		doc("# drip\n\n**Uma tese que é uma frase inteira e termina em ponto.**", 'skill:\n  description: "Uma gota por vez."\n  triggers:\n    - /drip\n    - "uma ideia por vez"\n'),
	);
	const p = plan()[0]!;
	expect(p.gap).toBeUndefined();
	expect(p.body).toContain("Uma gota por vez. Dispara em: /drip, uma ideia por vez.");
});

test("`skip: true` keeps a workflow out of the skill list", () => {
	workflow("shared_workflows/x", doc("# x\n\n**Uma tese que é uma frase inteira e termina em ponto.**", "skill:\n  skip: true\n"));
	expect(plan()).toEqual([]);
});

test("check is quiet only when every skill is written and complete", () => {
	workflow(
		"shared_workflows/research",
		doc("# research\n\n**Uma tese.**", 'skill:\n  description: "Mede antes de perguntar."\n  triggers:\n    - /research\n'),
	);
	expect(check().length).toBeGreaterThan(0);
	apply();
	expect(check()).toEqual([]);
});
