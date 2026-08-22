//! Toda aresta declarada tem a outra metade?
//!
//!   bun run src/check/reciprocal.ts            # both directions
//!   bun run src/check/reciprocal.ts --level error
//!   bun run src/check/reciprocal.ts --json
//!   bun run src/check/reciprocal.ts --fix              # plan the writes
//!   bun run src/check/reciprocal.ts --fix --write --only 'steps/**'
//!
//!   --json → { edges:int · files:int · missing:[{file,line,expected}] · floor:int }
//!            catraca: reciprocal.sem_volta = missing.LENGTH — não existe chave `achados`
//!
//! If A says `impacts: B`, then B should say `depends_on: A` — and the other way
//! round. An edge declared on one side only is a half-truth: whoever opens B has no
//! way to know A depends on it, which is the exact hole that cost three greps when
//! `src/sandbox/inbox.ts` was promoted on 14/08.
//!
//! `--json` HAS NO SIZE CEILING, and this line exists so nobody hunts one twice.
//! This check is the largest `--json` in the house (65408 bytes on 20/08, 128 short
//! of 65536), and 64 KB is the pipe buffer — close enough to look like a cliff. It
//! is not: MEASURED at commit `fb45c54`, before the floor landed, this same command
//! emitted **78588 bytes of valid JSON** (187 missing edges), and
//! `citations --kind field --all --json` emits **90352 valid bytes** today. Output
//! reported as "exactly 65536 and truncated" was cut by whatever CAPTURED it, not
//! here.
//!
//! It does not parse anything itself. `citations --kind field --all --json` already
//! owns the field regex, the fenced-block rule and the placeholder rule; re-deriving
//! them here would be the second source that 02_areas/design/009 forbids. This check owns one
//! thing only: the graph question.
//!
//! Born as `warn`, on purpose. Only 6 files declare edges today, so most reverses do
//! not exist yet — and the pre-commit hook fails on `error` alone, so this can ship
//! without blocking anyone. It becomes `error` when the retrofit finishes, and that
//! promotion is a one-word change here.
//!
//! ## O PISO NÃO É ZERO, e o número diz isso em voz alta
//!
//! Seis das arestas sem volta apontam pra FORA do repo — `~/src/main.code-workspace`,
//! duas SKILLs em `~/.claude/skills/`, um checkout vizinho. O alvo não é versionado
//! aqui, então não tem como declarar `depends_on:` de volta, nem hoje nem nunca, e
//! nenhum `--fix` alcança.
//!
//! Elas continuam CONTANDO — a aresta é real e a meia-verdade também. O que mudou é
//! que o check imprime o piso junto com o total, em vez de deixar quem lê perseguir
//! um zero que não existe. Medido 19/08: 6 de 162.
//!
//! O porquê disso importar está escrito em outro check: o `okf.sem` ficou vermelho
//! por dias medindo `type` DIVERGENTE como `type` AUSENTE, e a lição foi que número
//! que não pode fechar treina todo mundo a ignorar o número.
//!
//! ## O que este check AINDA não faz, e é decisão de gente
//!
//! Ele **sai 0** no nível `warn` — mede e não cobra. Ou a metade de volta importa, e
//! ele deveria reprovar, ou não importa, e a medição é ruído que a catraca carrega.
//! Isentar as 6 (fazendo o piso virar 0 de verdade) é a proposta que está no
//! `output.md` da task 003; mudar o que um check MEDE não é decisão de worker.
//!
//! ## `--fix`: writes the missing half
//!
//! Closing 49 half-edges by hand is 49 edits, so the fix writes the field on the other
//! side. Four shapes, and the file decides which:
//!
//!   .md with frontmatter    append the field inside the existing `---` block
//!   .md without one         create a minimal `---` block at the very top
//!   .md, field already there append ` · target` to that line
//!   .ts                     add a `//!` line at the end of the header block
//!   anything else           SKIPPED — see `writeEdge`, and the bash script it broke
//!
//! `--fix` plans and touches nothing; `--write` applies; `--only <glob>` slices it by
//! folder, which matters because a full pass edits files that belong to other live
//! sessions. Idempotent by construction: an edge already declared is never a finding,
//! so re-running writes nothing.
//!
//! What it never touches: `_step_runs/`, `notificacoes/`, an inbox's `archive/` — records
//! of what was true that day — and no file outside the repo.
//!
//! depends_on: src/check/citations.ts · META.md#dependency_at_the_top · src/shared/argv.ts
//! impacts:    src/check/all.ts

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { has, value } from "@my/shared/argv";
import { trees } from "../shared/file.ts";

const HERE = import.meta.dir;

/** UM CAMINHO CITADO, ABSOLUTO — tentando a CASA e depois o CÓDIGO.
 *
 *  Era `resolve(HERE, "../..", file)`, o que só funcionava enquanto conteúdo e fonte
 *  dividiam checkout. Separados, metade das citações de todo header (`depends_on:
 *  src/tasks/model.ts · 02_areas/…/CONTEXT.md` cita as duas numa linha) resolvia pro
 *  vazio, e este check morria com ENOENT na primeira — medido 20/08.
 *
 *  A ÚLTIMA ÁRVORE É O FALLBACK quando nenhuma tem o arquivo: quem chama precisa de
 *  um caminho pra reportar, e "não existe" é resposta melhor com endereço do que sem. */
const abs = (file: string): string => {
  const tried = trees().map((t) => resolve(t, file));
  return tried.find((p) => existsSync(p)) ?? tried[tried.length - 1]!;
};
const level = value("level", "warn");
const wantsFix = has("fix");
const wantsWrite = has("write");
const only = value("only");
/** Records of what was true that day: never rewritten.
 *
 *  `(?:^|\/)` and not `^`: the old regex read `^inbox/processado/` and the folder
 *  is `00_inbox/processado/`, so the inbox half of this exemption never matched a
 *  single file. Since 20/08 the folder is `archive/` and a project has one too
 *  (@01_projects/inbox-v1/docs/00_system_design_big_picture.md), so the anchor has to
 *  allow a prefix on both sides. */
const FROZEN = /(?:^|\/)(?:_step_runs|notificacoes|(?:00_)?inbox\/archive)\//;

type Edge = { file: string; line: number; kind: string; target: string; resolved: boolean };

const citations = await Bun.$`bun run ${resolve(HERE, "citations.ts")} --kind field --all --json`
  .quiet()
  .json();
const edges: Edge[] = (citations.findings as Edge[]).filter((e) => e.resolved);

const cache = new Map<string, string[]>();
async function lineAt(file: string, line: number): Promise<string> {
  if (!cache.has(file)) cache.set(file, (await Bun.file(abs(file)).text()).split("\n"));
  return cache.get(file)![line - 1] ?? "";
}

/** `file → what it declares`, per direction. The line number rides along so a finding
 *  can point at the exact line that is missing its other half. */
const declares = { depends_on: new Map<string, Set<string>>(), impacts: new Map<string, Set<string>>() };
const lineOf = new Map<string, number>();

for (const e of edges) {
  // `citations` reports the kind as `field`, not which field — so the direction is read
  // back from the line itself. Cheap, and it keeps the two checks from sharing a schema
  // that would then need versioning.
  const dir = /(^|\s)impacts:/.test(await lineAt(e.file, e.line)) ? "impacts" : "depends_on";
  const m = declares[dir];
  m.set(e.file, (m.get(e.file) ?? new Set()).add(e.target));
  lineOf.set(`${e.file}|${dir}|${e.target}`, e.line);
}

type Missing = {
  file: string;
  line: number;
  edge: string;
  expected: string;
  /** Where the fix has to write: the file that lacks the reverse, the field it lacks,
   *  and the value to put in it. */
  fix: { into: string; field: "depends_on" | "impacts"; target: string };
};
const missing: Missing[] = [];

/**
 * O PISO: as arestas que apontam pra FORA do repo, e por isso nunca vão ter a
 * metade de volta.
 *
 * `~/src/main.code-workspace` não é versionado aqui e não tem como declarar
 * `depends_on:` de volta — nem ele, nem uma SKILL em `~/.claude/skills/`, nem um
 * checkout vizinho. Elas são achado LEGÍTIMO (a aresta existe e é real), mas o
 * alvo está fora do alcance de qualquer `--fix`.
 *
 * Existe porque `sem_volta` é medida da catraca, e um teto inalcançável treina
 * todo mundo a ignorar o número — foi exatamente o que aconteceu com o `okf.sem`,
 * que ficou vermelho por dias medindo `type` DIVERGENTE como `type` AUSENTE.
 * Medido 19/08: 6 de 162.
 *
 * `~` é o teste, e é o certo: o campo é lista de PATH, e caminho de fora desta
 * casa é escrito com `~`. Um alvo relativo que não existe é outra coisa — é
 * citação podre, e quem acusa isso é o `my check citations`.
 */
const piso = (ms: Missing[]) => ms.filter((m) => m.fix.into.startsWith("~"));

for (const [file, targets] of declares.impacts) {
  for (const t of targets) {
    if (declares.depends_on.get(t)?.has(file)) continue;
    missing.push({
      file,
      line: lineOf.get(`${file}|impacts|${t}`) ?? 0,
      edge: `${file} impacts ${t}`,
      expected: `${t} should declare depends_on: ${file}`,
      fix: { into: t, field: "depends_on", target: file },
    });
  }
}
for (const [file, targets] of declares.depends_on) {
  for (const t of targets) {
    if (declares.impacts.get(t)?.has(file)) continue;
    missing.push({
      file,
      line: lineOf.get(`${file}|depends_on|${t}`) ?? 0,
      edge: `${file} depends_on ${t}`,
      expected: `${t} should declare impacts: ${file}`,
      fix: { into: t, field: "impacts", target: file },
    });
  }
}

/** Put `target` into `field` of `file`, choosing the shape the file allows. Returns the
 *  reason it was skipped, or null when it wrote. */
async function writeEdge(file: string, field: string, target: string): Promise<string | null> {
  if (FROZEN.test(file)) return "frozen record";
  const path = abs(file);
  const f = Bun.file(path);
  if (!(await f.exists())) return "does not exist";
  const text = await f.text();
  const lines = text.split("\n");

  // Already there — nothing to do. Keeps `--write` idempotent even if the graph is stale.
  if (lines.some((l) => new RegExp(`^\\s*(?://!\\s*)?${field}:.*${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(l)))
    return null;

  const fieldLine = lines.findIndex((l) => new RegExp(`^\\s*(?://!\\s*)?${field}:`).test(l));
  if (fieldLine >= 0) {
    lines[fieldLine] = lines[fieldLine].replace(/\s*$/, "") + ` · ${target}`;
  } else if (file.endsWith(".ts")) {
    // The header block is the run of `//!` lines at the top; the field goes at its end.
    let last = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("//!")) last = i;
      else if (last >= 0) break;
    }
    if (last < 0) return "no //! header to write into";
    lines.splice(last + 1, 0, `//! ${field}: ${target}`);
  } else if (lines[0] === "---") {
    const close = lines.indexOf("---", 1);
    if (close < 0) return "unterminated frontmatter";
    lines.splice(close, 0, `${field}: ${target}`);
  } else if (file.endsWith(".md")) {
    lines.unshift("---", `${field}: ${target}`, "---", "");
  } else {
    // Measured 20/08: this branch used to be the `else`, so it prepended a `---` block to
    // ANY file without one — and `src/check/pre-commit` is an extensionless bash script.
    // The block landed ABOVE the shebang, the symlinked git hook became `---: command not
    // found`, and every commit in the repo failed until it was restored by hand. A shape
    // this check does not know is a skip, never a guess: only markdown gets frontmatter.
    return "no shape for this file type — frontmatter is markdown only";
  }
  await Bun.write(path, lines.join("\n"));
  return null;
}

const declared = declares.impacts.size + declares.depends_on.size;
if (wantsFix) {
  const alvo = only ? missing.filter((m) => new Bun.Glob(only).match(m.fix.into)) : missing;
  let wrote = 0;
  const skipped: string[] = [];
  for (const m of alvo) {
    console.log(`${m.fix.into}: ${m.fix.field}: += ${m.fix.target}   (from ${m.file}:${m.line})`);
    if (!wantsWrite) continue;
    const why = await writeEdge(m.fix.into, m.fix.field, m.fix.target);
    if (why) skipped.push(`${m.fix.into} — ${why}`);
    else wrote++;
  }
  for (const s of new Set(skipped)) console.log(`skipped: ${s}`);
  console.log(
    wantsWrite
      ? `${wrote} edges written · run the check again to confirm`
      : `${alvo.length} edges to write${only ? ` (of ${missing.length}, filtered by --only)` : ""} · add --write to apply`,
  );
} else if (has("json")) {
  console.log(JSON.stringify({ edges: edges.length, files: declared, missing, floor: piso(missing).length }, null, 2));
} else {
  for (const m of missing) console.log(`${m.file}:${m.line}: ${level} · ${m.expected}`);
  const chao = piso(missing);
  console.log(`${edges.length} declared edges · ${missing.length} without the reverse`);
  // O PISO, impresso junto com o número — não num relatório à parte. Um teto que
  // não dá pra alcançar só treina quem lê a ignorá-lo, e o leitor precisa saber
  // disso na mesma linha em que vê o total.
  if (chao.length) {
    console.log(`floor: ${chao.length} of those point OUTSIDE the repo and can never have a reverse half:`);
    for (const m of chao) console.log(`  ${m.file}:${m.line} → ${m.fix.into}`);
  }
  if (level === "error" && missing.length) process.exit(1);
}
