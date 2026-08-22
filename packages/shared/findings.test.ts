//! The check of the emitter: the four formats, and the two properties that would
//! break something real if they regressed.
//!
//! `human` is asserted to be called VERBATIM and only without a format flag — the
//! ratchet (@src/check/ratchet.ts) and `ci/report.md` parse that text, so an emitter
//! that reformatted it would break the one thing that would have caught it.
//!
//! depends_on: src/shared/findings.ts
//! impacts:    —

import { expect, test } from "bun:test";
import { emit } from "./findings.ts";

type F = { file: string; message: string };
const ACHADOS: F[] = [
  { file: "a.md", message: "sem TYPE:" },
  { file: "b.md", message: "TYPE: x mas está em y/" },
];

/** Runs `emit` with stdout captured, so the assertions are on what a pipe would see. */
function run(argv: string[], findings: F[] = ACHADOS) {
  const lines: string[] = [];
  const real = console.log;
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  let humanCalls = 0;
  try {
    const code = emit(argv, {
      json: { regras: 46, fora_do_lugar: findings.length },
      findings,
      cols: (f) => [f.file, f.message],
      human: () => {
        humanCalls++;
        console.log(`${findings.length} regras fora do lugar`);
      },
    });
    return { code, lines, humanCalls };
  } finally {
    console.log = real;
  }
}

test("human is the default, is called verbatim, and NEVER runs under a format flag", () => {
  const humano = run([]);
  expect(humano.humanCalls).toBe(1);
  expect(humano.lines).toEqual(["2 regras fora do lugar"]);

  for (const flag of ["--json", "--jsonl", "--tsv"]) expect(run([flag]).humanCalls).toBe(0);
});

test("--json carries the totals AND the findings, in one object", () => {
  const { lines } = run(["--json"]);
  expect(lines).toHaveLength(1);
  expect(JSON.parse(lines[0]!)).toEqual({ regras: 46, fora_do_lugar: 2, findings: ACHADOS });
});

test("--jsonl and --tsv emit one line per finding, and TSV has no header", () => {
  expect(run(["--jsonl"]).lines.map((l) => JSON.parse(l))).toEqual(ACHADOS);

  const tsv = run(["--tsv"]).lines;
  expect(tsv).toEqual(["a.md\tsem TYPE:", "b.md\tTYPE: x mas está em y/"]);
  // A header would be a line every consumer has to skip, and whoever skips it wrong
  // counts the text as data.
  expect(tsv[0]).not.toContain("file");
});

test("a tab or newline inside a column never becomes a second column or row", () => {
  const { lines } = run(["--tsv"], [{ file: "a\tb.md", message: "quebra\naqui" }]);
  expect(lines).toEqual(["a b.md\tquebra aqui"]);
  expect(lines[0]!.split("\t")).toHaveLength(2);
});

test("exit code is the gate: 1 with findings, 0 without, in every format", () => {
  for (const flag of [[], ["--json"], ["--jsonl"], ["--tsv"]]) {
    expect(run(flag).code).toBe(1);
    expect(run(flag, []).code).toBe(0);
  }
});
