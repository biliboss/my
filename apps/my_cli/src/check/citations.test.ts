//! The check of the check: run `citations.ts` against a throwaway tree whose right
//! answers are known, and assert the verdict.
//!
//! End-to-end on purpose, not unit: every bug this check had on 14/08 lived in the
//! seam between the regex and the resolver — a target that matched fine and then
//! resolved against the wrong directory. Testing the pieces apart would have passed
//! while the tool reported 351 findings, of which ~340 were its own fault.
//!
//! depends_on: src/check/citations.ts
//! impacts:    —

import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHECK = join(import.meta.dir, "citations.ts");

/** A tree with one of each kind, and one deliberate break. */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "citations-"));
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "sibling.md"), "# here\n");
  writeFileSync(
    join(dir, "docs", "doc.md"),
    [
      "# doc",
      "",
      "a link to the sibling: [x](sibling.md)",          // resolves relative to the FILE
      "a pointer that rots: @docs/gone.md",              // error
      "a fenced example follows:",
      "```",
      "@docs/also-gone-but-fenced.md",                   // must be skipped
      "```",
      "a placeholder pointer: @docs/<slug>/x.md",        // must be skipped
      "a loose mention of docs/gone.md in prose",        // only with --kind mention
      "",
      // A raiz desta casa é NUMERADA, e o regex exigia letra depois do `@` — então
      // `@03_resources/...` não casava e 175 arquivos apontavam sem verificação
      // nenhuma. Estas duas linhas são o que quebrou, e o controle negativo delas é o
      // bloco abaixo: nada que só PARECE ponteiro pode virar achado.
      "um ponteiro numerado que morreu: @03_resources/sumiu.md",   // error
      "um ponteiro numerado que vive: @03_resources/vivo.md",      // resolve
      "",
      "e-mail nao e ponteiro: alguem@example.com",
      "handle nao e ponteiro: @biliboss abriu a issue",
      "css nao e ponteiro: @media (min-width: 40rem)",
      "decorator nao e ponteiro: @verb(\"a frase\")",
      "escopo npm nao e ponteiro: @anthropic-ai/sdk",
      // O caso que criou a guarda de letra, e que o `plausiblePointer` barra sozinho:
      // numa URL, `catalogo_resumo@1/shot` lia como o ponteiro `1/shot`.
      "url com arroba: /elementos/catalogo_resumo@1/shot",
      "",
    ].join("\n"),
  );
  mkdirSync(join(dir, "03_resources"), { recursive: true });
  writeFileSync(join(dir, "03_resources", "vivo.md"), "# vivo\n");
  return dir;
}

/** Every run points `--root` at the fixture: the basename index and the printed paths
 *  are both relative to it. Without this the tool indexes the real repo and finds no
 *  candidate for anything in /tmp — which is how `--root` came to exist. */
const run = async (args: string[]) => {
  const dir = args.find((a) => a.startsWith("/"));
  const p = Bun.spawn(["bun", "run", CHECK, ...args, ...(dir ? ["--root", dir] : [])], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(p.stdout).text();
  return { out, code: await p.exited };
};

test("a rotten pointer fails, and the sibling link does not", async () => {
  const dir = fixture();
  const { out, code } = await run([dir]);
  expect(out).toContain("does not open: docs/gone.md");
  expect(out).not.toContain("sibling.md");
  expect(code).toBe(1); // pointer is an error, so the run fails
});

test("um ponteiro que começa com DÍGITO é verificado como qualquer outro", async () => {
  const { out, code } = await run([fixture()]);
  expect(out).toContain("does not open: 03_resources/sumiu.md");
  // O vivo não pode aparecer: se aparecesse, o conserto teria trocado cegueira por ruído.
  expect(out).not.toContain("03_resources/vivo.md");
  expect(code).toBe(1);
});

// CONTROLE NEGATIVO, e é ele que segura o conserto: aceitar dígito depois do `@` abre a
// porta pra tudo que usa arroba e não é caminho. Nenhum destes pode virar achado.
test("e-mail, handle, @media, decorator, escopo npm e arroba de URL não são ponteiros", async () => {
  const { out } = await run([fixture()]);
  for (const falso of ["example.com", "biliboss", "media", "verb", "anthropic-ai", "1/shot"]) {
    expect(out).not.toContain(falso);
  }
});

test("fenced examples and placeholders are skipped", async () => {
  const { out } = await run([fixture()]);
  expect(out).not.toContain("also-gone-but-fenced");
  expect(out).not.toContain("<slug>");
});

test("a loose mention is invisible until asked for", async () => {
  const dir = fixture();
  const quiet = await run([dir]);
  const asked = await run([dir, "--kind", "mention"]);
  // The same missing path: silent by default, reported (as a warning) on demand.
  expect(quiet.out.match(/mention/g)).toBeNull();
  expect(asked.out).toContain("mention does not open: docs/gone.md");
  expect(asked.code).toBe(0);
});

test("--list reports without a verdict", async () => {
  const { out, code } = await run([fixture(), "--list"]);
  expect(out).toContain("pointer docs/gone.md");
  expect(out).toContain("unresolved");
  expect(code).toBe(0);
});

test("--fix plans, --write applies, and a link is shaped for its own folder", async () => {
  const dir = fixture();
  // The link target moves one level down; the repair must come back relative to the
  // FILE, not to the repo root — handing a root path to a link breaks it.
  mkdirSync(join(dir, "docs", "deep"), { recursive: true });
  writeFileSync(join(dir, "docs", "deep", "moved.md"), "# moved\n");
  writeFileSync(join(dir, "docs", "links.md"), "see [x](moved.md)\n");

  const planned = await run([dir, "--fix"]);
  expect(planned.out).toContain("moved.md → deep/moved.md");
  // planning must not touch disk
  expect(readFileSync(join(dir, "docs", "links.md"), "utf8")).toContain("(moved.md)");

  await run([dir, "--fix", "--write"]);
  expect(readFileSync(join(dir, "docs", "links.md"), "utf8")).toContain("(deep/moved.md)");
});

test("--map wins, and it is the only strategy that survives a rewrite-rename", async () => {
  const dir = fixture();
  writeFileSync(join(dir, "docs", "field.md"), "---\nimpacts: docs/old.ts\n---\n");
  writeFileSync(join(dir, "docs", "new.ts"), "// nothing alike\n");
  const { out } = await run([dir, "--fix", "--map", "docs/old.ts=docs/new.ts"]);
  expect(out).toContain("docs/old.ts → docs/new.ts  (map)");
});

test("a frozen record is never rewritten — e o --fix DIZ por que não mexeu", async () => {
  const dir = fixture();
  mkdirSync(join(dir, "00_inbox", "archive"), { recursive: true });
  writeFileSync(join(dir, "00_inbox", "archive", "pedido.md"), "impacts: docs/gone.md\n");
  const { out } = await run([dir, "--fix"]);
  // Até 17/08 o congelado era `_events/`, que estava em SKIP_DIRS: o walk não
  // entrava e o arquivo simplesmente não aparecia. Com a pasta morta, o congelado
  // que sobrou (`00_inbox/archive`) É visitado — e aparecer DIZENDO
  // "frozen record" vale mais que não aparecer: silêncio se lê como "não achei".
  expect(out).toContain("frozen record");
  // O que não pode é entrar na conta do que o --fix reescreve.
  expect(out).toContain("0 fixable");
});

test("o archive de uma inbox de PROJETO congela igual — e a inbox viva não", async () => {
  const dir = fixture();
  const inbox = join(dir, "01_projects", "p", "inbox");
  mkdirSync(join(inbox, "archive"), { recursive: true });
  writeFileSync(join(inbox, "archive", "pedido.md"), "impacts: docs/gone.md\n");
  const frozen = await run([join(inbox, "archive", "pedido.md"), "--root", dir]);
  expect(frozen.out).toContain("1 info");
  expect(frozen.code).toBe(0);

  // Controle negativo: o CONTEXT.md da mesma inbox é doc VIVA, e ponteiro quebrado
  // lá continua erro — senão congelar a nota congelaria a pasta inteira em silêncio.
  writeFileSync(join(inbox, "CONTEXT.md"), "impacts: docs/gone.md\n");
  const live = await run([join(inbox, "CONTEXT.md"), "--root", dir]);
  expect(live.out).toContain("error · field does not open: docs/gone.md");
  expect(live.code).toBe(1);
});

test("a frozen record is INFO, out of the verdict — and the file next door still fails", async () => {
  const dir = fixture();
  mkdirSync(join(dir, "00_inbox", "archive"), { recursive: true });
  // The exact shape that needed `HOOKS=0` on 14/08: a run's verbatim `pedido:` citing a
  // path the human invented, in a folder that never gets rewritten. Passed explicitly,
  // the way the hook passes staged files — a pedido já roteado não se reescreve.
  writeFileSync(join(dir, "00_inbox", "archive", "pedido.md"), "pedido: >-\n  faz um @docs/gone.md\n");
  // `--root` first, explicitly: the helper would otherwise root at the FILE path.
  const frozen = await run([join(dir, "00_inbox", "archive", "pedido.md"), "--root", dir]);
  // It does NOT appear in the verdict list: nobody can fix it, and a warning nobody
  // can act on is what teaches people to scroll past the whole list.
  expect(frozen.out).not.toContain("pointer does not open: docs/gone.md");
  expect(frozen.out).toContain("1 info");
  expect(frozen.code).toBe(0); // and it never blocks the commit

  // Still findable — `--list` is where you go for everything instead of a verdict.
  const listed = await run([join(dir, "00_inbox", "archive", "pedido.md"), "--root", dir, "--list"]);
  expect(listed.out).toContain("docs/gone.md");

  // Negative control: the same broken pointer outside a frozen folder is still an error.
  const loose = await run([join(dir, "docs", "doc.md"), "--root", dir]);
  expect(loose.out).toContain("error · pointer does not open: docs/gone.md");
  expect(loose.code).toBe(1);
});

test("an unknown --kind fails loudly instead of scanning nothing", async () => {
  const p = Bun.spawn(["bun", "run", CHECK, "--kind", "nope"], { stdout: "pipe", stderr: "pipe" });
  expect(await p.exited).not.toBe(0);
});
