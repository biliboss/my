//! The check of the check: `NOT_PROSE` has to exempt a build folder wherever it sits in
//! the path, and it has to keep its hands off a folder whose name merely STARTS with an
//! exempt word.
//!
//! It is a regex test and not an end-to-end one on purpose: `mapas()` reads
//! `git ls-files` at the repo ROOT, so a fixture would have to be a whole throwaway repo
//! to assert one anchor. The anchor is the thing that broke.
//!
//! Negative fixture is `outline/` — with the previous `$` anchoring the regex matched
//! only paths ENDING in `build`/`out`/…, which is why `webapp/build/server/chunks/` was
//! reported as unexplained prose: 24 of 119 findings on 19/08 were build artifacts.
//!
//! depends_on: src/check/maps.ts
//! impacts:    —

import { expect, test } from "bun:test";
import { NOT_PROSE } from "./maps.ts";

/** `mapas()` tests `${dir}/`, so every case here carries the trailing slash it would. */
const exempt = (dir: string) => NOT_PROSE.test(`${dir}/`);

test("exempts a build folder at any depth, not only at the end of the path", () => {
  expect(exempt("01_projects/agent_evals/webapp/build")).toBe(true);
  expect(exempt("01_projects/agent_evals/webapp/build/server/chunks")).toBe(true);
  expect(exempt("01_projects/agent_evals/webapp/.svelte-kit/generated/client/nodes")).toBe(true);
  expect(exempt("build")).toBe(true);
  expect(exempt(".github/workflows")).toBe(true);
});

test("leaves prose alone, including folders whose name merely starts with an exempt word", () => {
  expect(exempt("01_projects/cockpit/inbox")).toBe(false);
  expect(exempt("03_resources/rules/design")).toBe(false);
  // `out` must not swallow `outline`, nor `ci` swallow `citations` — the segment has to end.
  expect(exempt("01_projects/x/outline")).toBe(false);
  expect(exempt("01_projects/x/citations")).toBe(false);
  expect(exempt("01_projects/x/assetsmanager")).toBe(false);
});
