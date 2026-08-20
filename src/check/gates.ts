//! Todo projeto que declara o próprio gate continua passando nele?
//!
//!   bun run src/check/gates.ts <staged files…>   # prove the ones being touched
//!   bun run src/check/gates.ts --list            # who has a gate at all
//!   bun run src/check/gates.ts --json
//!
//!   --json → { gates:[…] · rodados:[…] · falhou:int }
//!            (fora da catraca — nenhuma medida sai deste --json)
//!
//! A project in `01_projects/` may ship code — it is that project's delivery, it
//! lives in its folder, and it dies with it (@CONTEXT.md, "Sem script"). Some of
//! that code is worth proving before a commit, and only the project knows what
//! "still correct" means for it. So the project owns a `src/gate.ts`, and
//! this file is the seam that finds it.
//!
//! BY CONVENTION, NEVER BY NAME. The first version hardcoded one project's path
//! into the repo's pre-commit — a project's name inside a system file that does
//! not die with the project, and a second project with a gate becoming an edit
//! to shared infrastructure. Found by `session-review` on 14/08, one commit
//! after it shipped, and the rename that followed proved the point: the slug
//! changed and the convention did not have to. `01_projects/*/scripts/gate.ts`
//! costs the same and rots less.
//!
//! ARGUMENTS ARE THE SCOPE, and that is the whole performance story. A gate can
//! be expensive — the one that prompted this boots a disposable VS Code and
//! takes ~40s — so running every gate on every `my check all` would be a check
//! people disable. With no file arguments this proves nothing and says so;
//! `citations.ts` already established the pre-commit passing its staged files
//! down, and this reuses that shape.
//!
//! Exit 1 only when a gate itself fails. A project without a gate is not a
//! finding: most projects are markdown, and demanding a gate would be inventing
//! work the map never asked for.
//!
//! ## THIS IS A PRE-COMMIT CHECK. The ratchet does not measure it, on purpose.
//!
//! It used to. `ratchet.ts` spawns every check with `--json` and NO file
//! arguments — and with no arguments this file proves nothing by design, so
//! `rodados` came back empty and `gates.falhou` was 0 BY CONSTRUCTION. A ceiling
//! no commit can ever break is not a ceiling; it is a green line that reads as
//! coverage. Removed from `CATRACA` on 19/08.
//!
//! Making it measurable from the ratchet was the other option, and it was
//! rejected with a number: the gate that exists boots a disposable VS Code plus
//! `npm test`, ~40s. `my check all` costs 1,10s today — one gate would make it
//! 37× slower, and the paragraph above already says what happens to a check that
//! slow. (Measuring it here TODAY prints 0,02s, but only because `node_modules`
//! is absent and the gate skips early. That number measures the environment, not
//! the gate.)
//!
//! So the seam is the pre-commit, which is the only caller that HAS a file list.
//!
//! depends_on: src/check/pre-commit · CONTEXT.md · src/shared/argv.ts
//! impacts: —

import { existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";
import { has } from "../shared/argv.ts";
import { home } from "../shared/file.ts";

const ROOT = home();
const PROJECTS = join(ROOT, "01_projects");

const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));

type Gate = { projeto: string; gate: string; runner: string };

/** Every `01_projects/<slug>/scripts/gate.*` on disk. */
function discover(): Gate[] {
  if (!existsSync(PROJECTS)) return [];

  const gates: Gate[] = [];
  for (const d of readdirSync(PROJECTS, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith("_")) continue;

    // `.ts` first: this house runs bun, and a project shipping a shell gate is
    // the exception rather than the shape to copy.
    for (const [file, runner] of [
      ["gate.ts", "bun"],
      ["gate.sh", "bash"],
    ] as const) {
      const gate = join(PROJECTS, d.name, "scripts", file);
      if (existsSync(gate)) {
        gates.push({ projeto: d.name, gate: relative(ROOT, gate), runner });
        break;
      }
    }
  }
  return gates;
}

const gates = discover();

if (has("list") || (files.length === 0 && !has("json"))) {
  // Saying "nothing staged" out loud matters: a silent exit 0 reads as "every
  // gate passed", which is the lie this whole family exists to prevent.
  console.log(
    gates.length
      ? gates.map((g) => `  ${g.projeto.padEnd(30)} ${g.gate}`).join("\n")
      : "  nenhum projeto tem gate",
  );
  if (!has("list")) console.log(`\n${gates.length} gate(s) · nenhum arquivo passado, nada provado`);
  process.exit(0);
}

/** A gate runs when the commit touches source under its own project. */
function touched(gate: Gate): boolean {
  const prefix = `01_projects/${gate.projeto}/src/`;
  return files.some((f) => f.startsWith(prefix));
}

const rodados = gates.filter(touched);
let falhou = 0;

for (const gate of rodados) {
  console.log(`  ${gate.projeto} · ${gate.gate}`);

  // `inherit`: the gate's own output IS the message. Capturing it would mean
  // re-formatting a failure the project already explained better than we can.
  const out = spawnSync(gate.runner, [join(ROOT, gate.gate)], {
    cwd: ROOT,
    stdio: has("json") ? "pipe" : "inherit",
  });

  if (out.status !== 0) {
    falhou++;
    console.error(`  ${gate.projeto}: o gate do projeto reprovou (saída ${out.status})`);
  }
}

if (has("json")) {
  console.log(JSON.stringify({ gates, rodados: rodados.map((g) => g.projeto), falhou }, null, 2));
} else {
  console.log(
    `\n${gates.length} gate(s) · ${rodados.length} rodado(s) · ${falhou} reprovado(s)`,
  );
  if (rodados.length === 0 && gates.length > 0) {
    console.log("  nenhum `src/` de projeto com gate está staged");
  }
}

process.exit(falhou ? 1 : 0);
