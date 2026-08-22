//! The check of the splitter: a hand-built META with a `# ` INSIDE a fence, so
//! the fence-awareness is asserted instead of assumed. That was the only bug
//! this file could plausibly have.

import { expect, test } from "bun:test";
import { discardBlock, headingAt, parse, readRun, resolveRun, slugify, terms } from "./meta";

const MD = [
  "# META",
  "the header table",
  "",
  "# 1. Interview",
  "ask until 80%",
  "```bash",
  "# this is a shell comment, not a heading",
  "```",
  "still interview",
  "",
  "# 2. Generate Sprints",
  "slice it — #proof_per_task",
  "",
  "# Resources",
  "",
  "## path_question",
  "offer the route",
  "",
  "## proof_per_task",
  "the command that proves it",
].join("\n");

test("header is everything before the first process", () => {
  expect(parse(MD).header).toBe("# META\nthe header table");
});

test("a `# ` inside a fence does not start a section", () => {
  const { sections } = parse(MD);
  expect(sections.map((s) => s.slug)).toEqual(["interview", "generate-sprints"]);
  expect(sections[0].body).toContain("still interview");
});

test("slug drops the ordinal and KEEPS the verb", () => {
  expect(slugify("1. Interview")).toBe("interview");
  expect(slugify("2. Generate Sprints")).toBe("generate-sprints");
  expect(slugify("3. Do Sprints")).toBe("do-sprints");
});

// The regression this file exists for: stripping the verb made these collide,
// and `just meta sprints` ran Generate when you meant Do.
test("Generate and Do never share a slug", () => {
  expect(slugify("2. Generate Sprints")).not.toBe(slugify("3. Do Sprints"));
});

test("# Resources is not a process — it becomes the resource list", () => {
  const { sections, resources } = parse(MD);
  expect(sections.map((s) => s.slug)).toEqual(["interview", "generate-sprints"]);
  expect(resources.map((r) => r.slug)).toEqual(["path_question", "proof_per_task"]);
});

// The slug of a resource is its heading VERBATIM. A task cites `#proof_per_task`
// and the lookup must land on that exact block — any transform in between is a
// second naming scheme waiting to drift.
test("resource slug is the heading itself, underscore_case intact", () => {
  const { resources } = parse(MD);
  expect(resources[1].body).toContain("the command that proves it");
  expect(resources.map((r) => r.slug)).not.toContain("proof-per-task");
});

// ── o lado dos runs ─────────────────────────────────────────────────────────
// O que estes provam: que `003`, `3` e `003_run` chegam no mesmo lugar, e que um
// run do formato VELHO (tudo em output.yaml) devolve sprints igual ao formato
// novo. A segunda e a que importa: migrar os runs antigos pra caber na regra
// nova seria reescrever historia, entao o leitor e que aceita as duas formas.
// A numeração conta pra BAIXO desde 999 (17/08): o run mais novo tem o menor
// número, e é ele que aparece no topo de um `ls`. O `997` de hoje é o `003` de
// ontem — 1000 menos o antigo — e os commits antigos ainda dizem `003`, que é o
// preço medido e aceito da renumeração.
test("resolveRun: nome inteiro resolve, e número AMBÍGUO é erro", () => {
  // O nome inteiro é sempre exato, e é o único que não depende de quantos runs
  // compartilham o número.
  expect(resolveRun("997_metrics_morre")).toBe("997_metrics_morre");
  expect(resolveRun("001")).toBeUndefined();

  // `997` casa runs de famílias diferentes — cada workflow numera pra baixo desde
  // 999 por conta própria. Devolver o primeiro do `readdir` é sorteio, e sorteio
  // silencioso é o que faz alguém pedir um e trabalhar no outro.
  //
  // A QUANTIDADE NÃO ENTRA na asserção: ela era `casa 2 runs` e o disco chegou a
  // três, então o teste passou a falhar por CRESCER — que é o comportamento certo
  // do código e o errado do teste. O que se afere é a recusa e o conselho.
  expect(() => resolveRun("997")).toThrow(/casa \d+ runs.*use o nome inteiro/);
});

test("le sprints do formato novo (sprints.yaml) e do velho (output.yaml)", () => {
  const novo = readRun("997_metrics_morre");
  expect(novo.sprints.length).toBeGreaterThan(0);
  expect(novo.sprints[0].tasks[0].proof).toBe(true);

  const velho = readRun("999_context_como_mapa");
  expect(velho.sprints.length).toBeGreaterThan(0);
  expect(velho.sprints[0].tasks.length).toBeGreaterThan(0);
});

// `terms()` reads the real log on disk, so the check that matters is the one it
// cannot get wrong by accident: a term with at least one HIT is never an orphan,
// and a resource whose PREFIX someone searched counts as fetched — that second
// rule exists because `find()` resolves by prefix, so `just resources worktree`
// really did reach `worktree_and_staging` and the log must not claim otherwise.
test("terms: hit nunca vira orfao, e prefixo conta como buscado", () => {
  const { resources, design } = parse(MD);
  const t = terms(resources, design);
  const orfaos = new Set(t.orfaos.map((o) => o.term));
  for (const o of t.orfaos) expect(o.buscas).toBeGreaterThan(0);
  // nenhum termo pode estar nas duas listas ao mesmo tempo
  for (const slug of t.nunca_buscado) expect(orfaos.has(slug)).toBe(false);
});

// O CONTROLE NEGATIVO deste é o que importa, e é o bug que matou duas versões
// do parser: a palavra `descartados:` aparece no COMENTÁRIO do cabeçalho do
// próprio arquivo, então um `indexOf` acha ela lá em cima e devolve o arquivo
// quase inteiro — engolindo `sem_dono:`, que usa a mesma chave `- termo:`. O
// efeito era o verbo ler como "já julgado" o órfão que ele mesmo tinha acabado
// de escrever, e a lista zerar sozinha na segunda rodada, sem erro nenhum.
test("discardBlock ignora a chave citada no cabeçalho", () => {
  const yaml = [
    "# `descartados:` é a única parte à mão deste arquivo.",
    "sem_dono:",
    "  - termo: push",
    "    buscas: 2",
    "",
    "descartados:",
    "  - termo: deploy",
  ].join("\n");
  const bloco = discardBlock(yaml);
  expect(bloco).toContain("- termo: deploy");
  expect(bloco).not.toContain("- termo: push"); // o negativo: o órfão fica FORA
  expect(discardBlock("sem_dono:\n  - termo: push")).toBe(""); // sem bloco, nada
});

// `headingAt` decide o ENDEREÇO de cada linha, e a regra muda com o bloco: numa
// prateleira (`# Resources`/`# Design`) o `##` é o slug; num PROCESSO o `##` é
// `Tasks`/`Output`, que não abre nada — ali o endereço tem que ser o processo.
// O controle negativo é justamente esse: uma linha dentro de `## Tasks` NÃO pode
// ser endereçada como `Tasks`, senão a busca devolve ponteiro que não resolve.
test("headingAt: prateleira devolve o slug, processo devolve o processo", () => {
  const md = [
    "# META",          // 1
    "cabeçalho",       // 2
    "# 3. Do Sprints", // 3
    "## Tasks",        // 4
    "corre em worktree", // 5  ← dentro de um processo
    "# Resources",     // 6
    "## proof_per_task", // 7
    "toda task tem prova", // 8  ← dentro da prateleira
  ].join("\n");
  const dono = headingAt(md);
  expect(dono[4]).toBe("do-sprints");       // NÃO "Tasks"
  expect(dono[7]).toBe("proof_per_task");
  expect(dono[1]).toBe("meta");
});
