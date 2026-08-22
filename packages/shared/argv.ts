//! Reading a flag off the command line — the two forms every script here needs.
//!
//! This existed eight times before it existed once. The one-line `has` predicate
//! over `process.argv.includes("--" + name)` was copied verbatim into seven checks
//! and `src/system/metrics.ts`, and the flag-with-a-value form (`indexOf("--root")`
//! then `argv[i + 1]`) was copied into four of them. Nothing was wrong with any
//! copy — that is the point. A helper nobody notices is a helper nobody keeps in
//! sync, and the day one of them learns `=`-style flags the other seven stay
//! behind.
//!
//! And it kept happening after this file existed, which is the part worth writing
//! down: `src/herdr/` was never migrated and grew THIRTEEN more inline copies —
//! two closures byte-identical to each other, and an IIFE in `panes/split.ts`
//! written only because a second inline reader would not fit in the same object
//! literal. Migrating the callers is not the optional half of extracting a helper;
//! a helper with a live copy next door is two helpers.
//!
//! TWO FUNCTIONS, NOT A PARSER, and deliberately so: no subcommands, no
//! validation, no required-flag errors, no `-x` short forms. Nobody asked, and a
//! parser here would be a second CLI framework living under the first one. When a
//! script needs more than this it should say so out loud, in its own file.
//!
//! The `argv` parameter is not decoration: `metrics.ts` dispatches subcommands and
//! hands each one its OWN slice of the tail (`askuser --hook` sees only
//! `["--hook"]`), and `okf.ts` takes argv as a function argument so its test can
//! call `main([...])` without touching the real process. Both would break if this
//! module could only ever see `Bun.argv`.
//!
//! depends_on: —
//! impacts:    src/check/citations.ts · src/check/context.ts · src/check/gates.ts · src/check/notes.ts · src/check/okf.ts · src/check/reciprocal.ts · src/system/metrics.ts · src/herdr/agents/cli.ts · src/herdr/agents/start.ts · src/herdr/panes/read.ts · src/herdr/panes/send.ts · src/herdr/panes/split.ts · src/herdr/tabs/create.ts · src/herdr/workspaces/close.ts · src/herdr/workspaces/create.ts · src/herdr/workspaces/list.ts

/** The process tail, minus the runtime and the script path. Read once, at import:
 *  argv does not change while a script runs. */
const TAIL = Bun.argv.slice(2);

/** Is `--<name>` present? `has("json")` for `--json`. Pass `argv` to read a slice
 *  other than the process tail. */
export const has = (name: string, argv: string[] = TAIL): boolean => argv.includes(`--${name}`);

/** The word AFTER `--<name>`, or `fallback` when the flag is absent.
 *
 *  Returns `undefined` — not `""` — for a trailing `--root` with nothing after it,
 *  because `argv[i + 1]` is `undefined` there. Callers that must have a value say
 *  so with `value("root", DEFAULT)`; the ones that treat absence as a mode already
 *  test for `undefined`. */
export const value = (name: string, fallback?: string, argv: string[] = TAIL): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
