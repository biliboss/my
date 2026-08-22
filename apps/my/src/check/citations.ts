//! Todo caminho que este repo cita abre de verdade?
//!
//!   bun run src/check/citations.ts                   # the whole repo
//!   bun run src/check/citations.ts design steps      # only these roots
//!   bun run src/check/citations.ts --list            # every citation, no verdict
//!   bun run src/check/citations.ts --kind mention    # opt into loose mentions
//!   bun run src/check/citations.ts --fix              # plan the rewrites
//!   bun run src/check/citations.ts --fix --write      # apply them
//!   … --fix --write --map src/sandbox/inbox.ts=src/inbox/capture.ts
//!
//!   --json → { scanned:int · kinds:[…] · findings:[{file,line,level,target,…}] }
//!            catraca: citations.error = findings com level=="error" e alvo que não começa com `~`
//!
//! A citation is not one thing, and that distinction IS the feature: a `depends_on`
//! field is a contract, a prose `@path` is an order to go read something, a markdown
//! link is navigation, and a bare path in the middle of a sentence is history. They
//! rot the same way and they cost different amounts, so each kind carries its own
//! severity — and `mention` is opt-in, because `02_areas/design/010` names
//! `.vscode/tasks.json` mid-sentence to tell what happened on 14/08, and history
//! must never fail a commit.
//!
//! Two rules were taught by running this by hand on 14/08, before it was a file:
//! fenced code blocks are skipped (two of the three rotten paths it found were the
//! examples inside `02_areas/design/010` itself), and a target counts as resolvable when it
//! opens on DISK — `~/`-prefixed included — not when it lives inside the repo (the
//! VS Code task that `00_inbox/capture` impacts lives in `~/src/main.code-workspace`).
//!
//! ## `--fix`, and why it needs a map
//!
//! Three strategies, tried in order, and the order comes from what was MEASURED on
//! 14/08 rather than from what sounds clever:
//!
//!   map       `--map old=new`, explicit. Always wins, because the person doing a
//!             rename KNOWS the mapping — and it is the only strategy that survived
//!             today's real case: `src/sandbox/inbox.ts` → `src/inbox/capture.ts`.
//!   basename  the same filename exists exactly once elsewhere → rewrite to it. Fixes
//!             a moved file. Ambiguous (two candidates) is reported, never guessed.
//!   depth     same basename and same parent folder, wrong `../` depth → fix the depth.
//!             This is the self-link class that rotted in `03_resources/templates/skills/CONTEXT.md`.
//!
//! Git rename detection is NOT a strategy, and that is a measurement, not an opinion:
//! `git show --name-status -M20% -C20%` on the promotion commit reports `A` + `D`, not
//! `R`, because the promotion rewrote the file into English and similarity fell below
//! any usable threshold. A fixer that trusted git would have missed the one rot that
//! actually happened today.
//!
//! `--fix` alone PLANS (prints the rewrites and touches nothing); `--write` applies.
//! `mention` is never fixable — history told in a sentence is not a pointer to repair —
//! and no file under an inbox's `archive/` is ever
//! rewritten, for the same reason: those are records of what was true that day.
//!
//! depends_on: META.md#dependency_at_the_top · src/CONTEXT.md · src/shared/argv.ts · src/shared/file.ts
//! impacts:    src/check/all.ts · src/check/reciprocal.ts · src/check/ratchet.ts
//!
//! Not declared as `impacts`, on purpose: nothing else reads this file's output yet.
//! When a second check consumes `--json`, that edge gets written here.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { has, value } from "@biliboss/shared/argv";
import { home, trees } from "../shared/file.ts";

/** The base for every relative path AND for the basename index.
 *
 *  Defaults to this repo, and `--root <dir>` points it elsewhere: another checkout, a
 *  subtree checked in isolation, or a throwaway tree in a test. Without it the tool is
 *  silently repo-centric — scanning a folder outside the repo found zero fix
 *  candidates, because the index had been built from the repo. */
const ROOT = resolve(value("root", home())!);

/** AS ÁRVORES QUE UMA CITAÇÃO PODE NOMEAR, e a primeira é sempre `ROOT` — não
 *  `home()` — porque `--root` existe pra apontar este check pra uma FIXTURE, e uma
 *  fixture que não é a primeira candidata testa o repositório em vez de si mesma.
 *  Foi o que quebrou dois testes na primeira versão disto (20/08): `03_resources/
 *  vivo.md` existia na fixture e era reportado como ponteiro morto.
 *
 *  O CÓDIGO ENTRA DEPOIS porque `depends_on:` cita fonte e conteúdo na mesma linha,
 *  e desde a mudança pro `biliboss/my` eles moram em checkouts diferentes. */
const ROOTS = [ROOT, ...trees().filter((t) => t !== ROOT)];

/** What kind of citation this is — and what it costs when it rots.
 *
 *  `error` fails the run; `warn` reports and lets it pass. The split is not
 *  cosmetic: a broken contract means someone will break something, while a broken
 *  markdown link means a click goes nowhere. Same defect, different bill. */
const KINDS = {
  // //! impacts: justfile#inbox · src/CONTEXT.md
  field: { level: "error", re: /^\s*(?:\/\/!\s*|#\s*|--\s*)?(?:depends_on|impacts):\s*(.+)$/ },
  // @02_areas/00_workflows/02_system/001_user_prompt/CONTEXT.md — an instruction to go read that file
  // `@steps/...` — and it must LOOK like a repo path: `plausiblePointer` exige extensão
  // conhecida ou primeiro segmento que é entrada real da raiz. Sem essa guarda,
  // `/elementos/catalogo_resumo@1/shot` numa URL lia como o ponteiro `1/shot`.
  //
  // O primeiro caractere aceita DÍGITO desde 19/08, e a ausência dele era a cegueira
  // mais cara deste check: a raiz desta casa é numerada (`00_inbox`, `01_projects`,
  // `02_areas`, `03_resources`, `04_archive`), então `@03_resources/...` NUNCA casava —
  // e são 175 arquivos que apontam assim. O detector de apodrecimento era cego
  // justamente pros caminhos que a casa mais usa. A guarda de letra era redundante:
  // quem barra `1/shot` é o `plausiblePointer`, não ela.
  pointer: { level: "error", re: /@([A-Za-z0-9][A-Za-z0-9_./~-]*[A-Za-z0-9_-])/g },
  // [009](the-target-here)
  link: { level: "warn", re: /\]\(([^)\s#]+)/g },
  // "when inbox.ts was promoted" — a path told as history, never a contract
  mention: { level: "warn", re: /(?:^|[\s(`"'])((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[a-z]{2,4})/g },
} as const;

type Kind = keyof typeof KINDS;
type Finding = { file: string; line: number; kind: Kind; target: string; level: string; resolved: boolean };

// `*.test.ts` is skipped for the same reason fenced blocks are: a test BUILDS broken
// paths on purpose. This check flagged its own fixture on the first `just check` run.
const EXT = /\.(ts|md|yaml|yml)$/;
const IS_TEST = /\.test\.ts$/;
/** Never walked: not source, or history that cites by the hundred. `_step_runs/` is
 *  the loudest — a run quotes the request verbatim, so it cites paths that were true
 *  that day and may not exist now. Reopening that is the job of a different check. */
const SKIP_DIRS = new Set([".git", "node_modules", ".bookmarks", "worktrees"]);

const argv = Bun.argv.slice(2);

const kinds = (value("kind")?.split(",") ?? ["field", "pointer", "link"]) as Kind[];
for (const k of kinds) if (!(k in KINDS)) throw new Error(`unknown --kind ${k}: pick from ${Object.keys(KINDS).join(",")}`);
const only = value("only");
const ignore = value("ignore");
const levelOverride = value("level");
const wantsFix = has("fix");
const wantsWrite = has("write");
/** `--all` keeps the citations that DO resolve in the output. Nothing here needs them,
 *  but `check/reciprocal` needs the whole edge set — and reimplementing this file's
 *  regexes, fence rule and placeholder rule over there would be the second truth that
 *  02_areas/design/009 forbids. */
const wantsAll = has("all");
/** `--map old=new`, repeatable. Explicit beats derived, always. */
const MAP = new Map<string, string>(
  argv.flatMap((a, i) => (a === "--map" && argv[i + 1] ? [argv[i + 1].split("=") as [string, string]] : [])),
);
const strategies = value("strategy", "map,basename,depth")!.split(",");
/** Never rewritten: a record of what was true that day. */
// `_events/` MORREU em 17/08 e saiu daqui junto. O que sobrou congelado é o
// `archive/` de uma inbox — pedido já roteado não se reescreve. A regra de 15/08
// dizia este regex para trás, então 52 registros congelados passaram a ser julgados
// como se alguém pudesse consertá-los. Uma nota de `archive/` guarda o que era
// verdade naquele dia, ponteiro velho incluído — reescrevê-la é inventar história.
//
// Vale pra QUALQUER inbox, não só a da casa: desde 20/08 um projeto tem a mesma
// pasta (@01_projects/inbox-v1/docs/00_system_design_big_picture.md), e um congelamento
// que só conhece a raiz julga o registro de projeto como se fosse doc viva.
const FROZEN = /(?:^|\/)(?:00_)?inbox\/archive\//;
const roots = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));

/** Bun ships `Bun.Glob`, so no dependency for `--only 'steps/**'`. */
const matches = (pattern: string | undefined, path: string) =>
  pattern === undefined || new Bun.Glob(pattern).match(path);

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (EXT.test(e.name) && !IS_TEST.test(e.name)) yield p;
  }
}

/** True when the cited target opens.
 *
 *  Three resolution rules, and each one was earned on the first full run (14/08,
 *  351 findings of which most were this function being wrong):
 *
 *  1. A markdown link resolves against the FILE's directory first — a markdown link to a sibling json
 *     in `03_resources/templates/cockpit/CONTEXT.md` means the sibling, not a repo-root path. Then
 *     the repo root, because prose here cites root-relative by convention.
 *  2. A template placeholder (`<slug>`, `{{run}}`) is not a path. Templates exist to
 *     be filled; failing them would make every template permanently broken.
 *  3. `~/` resolves in $HOME, because real impact lives outside the repo — the VS Code
 *     task that `00_inbox/capture` impacts is in `~/src/main.code-workspace`. */
function resolves(target: string, fromDir: string): boolean {
  const clean = target.replace(/[.,;:)\]]+$/, "");
  if (/^[a-z]+:\/\//.test(clean)) return true;              // URL
  if (/[<>{}]/.test(clean)) return true;                     // template placeholder
  if (!clean.includes("/") && !clean.includes(".")) return true;
  const candidates = clean.startsWith("~/")
    ? [join(homedir(), clean.slice(2))]
    // AS DUAS ÁRVORES: a citação pode nomear conteúdo (`02_areas/…`) ou fonte
    // (`src/tasks/model.ts`), e desde 20/08 elas moram em checkouts diferentes.
    : [join(fromDir, clean), ...ROOTS.map((t) => join(t, clean))];
  for (const abs of candidates) {
    try {
      statSync(abs);
      return true;
    } catch {}
  }
  return false;
}

/** Top-level entries of the repo, read once: a pointer whose first segment is not one
 *  of them (and that has no known extension) is not addressing this repo. */
const TOP = new Set(ROOTS.flatMap((t) => readdirSync(t)));
const plausiblePointer = (t: string) =>
  /\.(ts|md|yaml|yml|json|html|py)$/.test(t) || TOP.has(t.split("/")[0]) || t.startsWith("~/");

function scan(file: string): Finding[] {
  const rel = relative(ROOT, file);
  const out: Finding[] = [];
  let fenced = false;
  const lines = readFileSync(file, "utf8").split("\n");
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    // A doc that teaches the convention quotes fake paths on purpose.
    if (line.trimStart().startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    for (const kind of kinds) {
      const { re, level } = KINDS[kind];
      const targets: string[] =
        kind === "field"
          ? (line.match(re as RegExp)?.[1]?.split("·").map((s) => s.trim()) ?? [])
          : [...line.matchAll(re as RegExp)].map((m) => m[1]);
      for (const t of targets) {
        if (!t || t === "—" || t === "-") continue;
        // `@02_areas/NN-<slug>/x.md`: the regex stops at `<`, so the target arrives
        // truncated and "does not open". What follows the match decides.
        const after = line[line.indexOf(t) + t.length] ?? "";
        if (after === "<" || after === "{") continue;
        const target = t.split("#")[0];
        if (!target.includes("/") && !target.includes(".")) continue;
        if (kind === "pointer" && !plausiblePointer(target)) continue;
        const ok = resolves(target, dirname(join(ROOT, rel)));
        if (ok && !wantsAll) continue;
        // A file under `03_resources/templates/` is a pattern to be copied, not a contract that
        // runs — its example paths are allowed to be fake. Report, never fail.
        // Same for a FROZEN record: it stores what was true that day, including a
        // path the human typed for a file that never existed. Nothing to fix there,
        // and `--fix` already refuses to touch those folders — so failing the commit
        // would leave `HOOKS=0` as the only way out, which is how a hook stops
        // defending anything. Measured on 14/08: closing two runs needed the escape.
        // `info` and not `warn` for the two: a warning nobody CAN act on is what
        // teaches people to scroll the list instead of reading it. Measured on
        // 14/08: of ten warnings, three were `image.png` inside a frozen
        // `00_inbox/archive/` request — the human typed a path for a file that
        // never existed, and that text is his words. It stays. It just stops
        // being counted against a repo that is not wrong.
        // They are still visible with `--list`, which is where you go when you
        // want everything rather than a verdict.
        const lvl =
          levelOverride ?? (rel.startsWith("03_resources/templates/") || FROZEN.test(rel) ? "info" : level);
        out.push({ file: rel, line: n + 1, kind, target, level: lvl, resolved: ok });
      }
    }
  }
  return out;
}

/** Every file in the repo, by basename — built once, only when a fix is asked for. */
const byBasename = (() => {
  const m = new Map<string, string[]>();
  if (!wantsFix) return m;
  for (const f of walk(ROOT)) {
    const rel = relative(ROOT, f);
    const base = rel.split("/").pop()!;
    m.set(base, [...(m.get(base) ?? []), rel]);
  }
  return m;
})();

type Repair = { finding: Finding; to: string; how: string } | { finding: Finding; why: string };

/** Shape a repo-relative candidate the way THIS kind of citation is addressed.
 *
 *  A markdown link resolves against the file's own directory, while a field and a
 *  prose pointer are root-relative by convention (03_resources/references/CONTEXT.md). Handing a
 *  root path to a link is how a "fix" breaks a link that was merely pointing at the
 *  wrong place — caught before the first `--write`, on the acme doc. */
const shape = (kind: Kind, file: string, repoRel: string) =>
  kind === "link" ? relative(dirname(join(ROOT, file)), join(ROOT, repoRel)) : repoRel;

/** What this rotten target should become — or why nothing can be proposed. */
function repair(f: Finding): Repair {
  if (f.kind === "mention") return { finding: f, why: "mention is history, never repaired" };
  if (FROZEN.test(f.file)) return { finding: f, why: "file is a frozen record" };

  if (strategies.includes("map")) {
    const hit = MAP.get(f.target);
    if (hit) return { finding: f, to: shape(f.kind, f.file, hit), how: "map" };
  }
  const base = f.target.split("/").pop()!;
  if (strategies.includes("basename")) {
    const cands = byBasename.get(base) ?? [];
    if (cands.length === 1) return { finding: f, to: shape(f.kind, f.file, cands[0]), how: "basename" };
    if (cands.length > 1) return { finding: f, why: `ambiguous: ${cands.join(", ")}` };
  }
  if (strategies.includes("depth")) {
    // `../../../templates/skills/CONTEXT.md` from a file two levels down: same tail,
    // wrong number of `..`. Rebuild the relative path from the file's own directory.
    const tail = f.target.replace(/^(\.\.\/)+/, "");
    const cands = (byBasename.get(base) ?? []).filter((c) => c.endsWith(tail));
    if (cands.length === 1) {
      const to = relative(dirname(join(ROOT, f.file)), join(ROOT, cands[0]));
      return { finding: f, to, how: "depth" };
    }
  }
  return { finding: f, why: "no candidate — pass --map old=new" };
}

/** Rewrites are applied per FILE, one pass, so two repairs on the same line both land. */
function applyRepairs(rs: Extract<Repair, { to: string }>[]): number {
  const perFile = new Map<string, typeof rs>();
  for (const r of rs) perFile.set(r.finding.file, [...(perFile.get(r.finding.file) ?? []), r]);
  for (const [file, list] of perFile) {
    const abs = join(ROOT, file);
    const lines = readFileSync(abs, "utf8").split("\n");
    for (const r of list) {
      const i = r.finding.line - 1;
      lines[i] = lines[i].split(r.finding.target).join(r.to);
    }
    writeFileSync(abs, lines.join("\n"));
  }
  return perFile.size;
}

// `existsSync` antes do `statSync`: o hook nomeia a lista do STAGE, e o índice
// desta casa é compartilhado entre sessões — uma DELEÇÃO staged por outro ciclo
// entra aqui como caminho que não existe mais. Sem esta guarda o check morre de
// ENOENT e derruba o commit de quem não tem nada a ver com o arquivo apagado.
// Medido 19/08 com `01_projects/ask-user-question-app/CONTEXT.md`.
const files = (roots.length ? roots.map((r) => resolve(ROOT, r)) : [ROOT])
  .filter((r) => existsSync(r))
  .flatMap((r) => (statSync(r).isDirectory() ? [...walk(r)] : [r]));
const scanned = files
  .map((f) => relative(ROOT, f))
  // `IS_TEST` lives in `walk`, which never sees a path named on the command line — and
  // the hook names paths, one per staged file. Without this the hook failed every commit
  // touching a `*.test.ts`: a test fixture cites broken paths ON PURPOSE. Measured on
  // 14/08, on this very file. `SKIP_DIRS` is NOT applied here on purpose: it exists to
  // keep the walk out of history by the hundred, but a frozen file named explicitly
  // still deserves its warn.
  .filter((rel) => !IS_TEST.test(rel))
  .filter((rel) => matches(only, rel) && !(ignore && matches(ignore, rel)));

const findings = scanned.flatMap((rel) => scan(join(ROOT, rel)));

if (wantsFix) {
  const repairs = findings.filter((f) => !f.resolved).map(repair);
  const doable = repairs.filter((r): r is Extract<Repair, { to: string }> => "to" in r);
  for (const r of doable) {
    console.log(`${r.finding.file}:${r.finding.line}: ${r.finding.target} → ${r.to}  (${r.how})`);
  }
  for (const r of repairs.filter((r): r is Extract<Repair, { why: string }> => "why" in r)) {
    console.log(`${r.finding.file}:${r.finding.line}: ${r.finding.target} — ${r.why}`);
  }
  if (wantsWrite && doable.length) {
    const touched = applyRepairs(doable);
    console.log(`${doable.length} rewritten in ${touched} files · run the check again to confirm`);
  } else {
    console.log(
      `${doable.length} fixable · ${repairs.length - doable.length} need a decision` +
        (doable.length ? " · add --write to apply" : ""),
    );
  }
} else if (has("json")) {
  console.log(JSON.stringify({ scanned: scanned.length, kinds, findings }, null, 2));
} else if (has("list")) {
  for (const f of findings) console.log(`${f.file}:${f.line}: ${f.kind} ${f.target}`);
  console.log(`${findings.length} unresolved · ${scanned.length} files · kinds: ${kinds.join(",")}`);
} else {
  // One line per finding, `path:line:` first, so the output pipes into grep and into
  // the editor's problem matcher without a parser.
  // `info` sai da listagem do veredito de propósito: quem roda `just check` quer
  // saber o que ELE pode consertar. O resto continua a um `--list` de distância.
  for (const f of findings.filter((f) => !f.resolved && f.level !== "info")) {
    console.log(`${f.file}:${f.line}: ${f.level} · ${f.kind} does not open: ${f.target}`);
  }
  const errors = findings.filter((f) => !f.resolved && f.level === "error").length;
  const infos = findings.filter((f) => !f.resolved && f.level === "info").length;
  const naoResolvidos = findings.filter((f) => !f.resolved).length;
  console.log(
    `${scanned.length} files · ${naoResolvidos} unresolved ` +
      `(${errors} error, ${naoResolvidos - errors - infos} warn` +
      `${infos ? `, ${infos} info — pasta congelada ou template, nada a consertar` : ""})`,
  );
  if (errors) process.exit(1);
}
