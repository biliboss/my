//! An inbox on DISK: where each state lives, and how to find one item.
//!
//! The three places of `InboxSystem.ValueObjects.StateFolder`, made real. Everything that
//! touches an inbox goes through here — `capture` writes into `backlog/`, `pull`
//! moves to the root, `process` and `drop` move into `archive/` — so the layout is
//! written once and the four verbs cannot disagree about it.
//!
//! WHY THE STATE IS A FOLDER AND NOT A FIELD: a folder cannot disagree with itself.
//! A `state:` in frontmatter is a second truth that drifts the first time a move
//! fails halfway, and `ls backlog` stops being the answer to "what is waiting".
//!
//! depends_on: src/inbox/system_inbox.ts · src/shared/file.ts
//! impacts:    src/inbox/capture.ts · src/inbox/pull.ts · src/inbox/process.ts · src/inbox/drop.ts

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { InboxSystem } from "./system_inbox.ts";
import { home } from "../shared/file.ts";

const ROOT = home();

/** The layout, typed against the model: the day a name changes there, this fails to
 *  compile instead of quietly writing into a folder nobody reads. `ready` is the
 *  empty string because it IS the inbox root — the working set sits in the open,
 *  beside the inbox's own `CONTEXT.md`. */
export const FOLDER: InboxSystem.ValueObjects.StateFolder = {
  backlog: "backlog",
  ready: "",
  archive: "archive",
};

/** The order a lookup walks: `ready` first because an item being worked on is the one
 *  most likely to be named out loud. */
const STATES = ["ready", "backlog", "archive"] as const;

export type Located = {
  /** The folder name — `underscore_case`, and the identity. */
  name: InboxSystem.ValueObjects.ItemName;
  state: InboxSystem.ValueObjects.ItemState;
  /** The item's own folder — `<inbox>/[<state>/]<name>`. */
  dir: string;
  /** `<dir>/CONTEXT.md`. */
  file: string;
  title: string;
  /** Frontmatter `created:` first, folder `birthtime` second. The written one wins:
   *  a copy or a migration resets `birthtime` and would make an old request read as
   *  new — measured on this repo's own migration, 20/08. */
  created_at: InboxSystem.ValueObjects.Instant;
  /** Already answered — the request is a frozen record from here on. */
  answered?: "processed" | "dropped";
};

/** The `created:` written into the item, or the folder's birth. Reading the
 *  frontmatter costs one open per item, which is what a name without a timestamp
 *  costs — and it buys a date that survives being copied. */
export function createdAt(dir: string, text: string): string {
  const written = text.match(/^created:\s*(\S+)/m)?.[1];
  if (written) return written;
  const st = statSync(dir);
  return new Date(st.birthtimeMs || st.mtimeMs).toISOString();
}

/** `--to <inbox>` resolved, or the house inbox. Refuses a folder with no
 *  `CONTEXT.md`: an inbox is a folder someone DECLARED, and a typo'd `--to` must not
 *  scatter items into a folder that is not one. */
export function inboxAt(to?: string): { dir: string; contextFile: string } {
  const dir = to ? (isAbsolute(to) ? to : join(ROOT, to)) : join(ROOT, "00_inbox");
  const contextFile = join(dir, "CONTEXT.md");
  if (!existsSync(contextFile)) throw new Error(`não é uma inbox: ${contextFile} não existe`);
  return { dir, contextFile };
}

const stateDir = (inbox: string, state: InboxSystem.ValueObjects.ItemState) =>
  FOLDER[state] ? join(inbox, FOLDER[state]) : inbox;

/** Is this folder an item? Anything that holds a `CONTEXT.md` and is not one of the
 *  state folders. Names carry no timestamp any more, so there is no pattern to match
 *  — the `CONTEXT.md` IS the declaration that a folder is a request. */
const isItem = (dir: string, name: string) =>
  !Object.values(FOLDER).includes(name as never) && existsSync(join(dir, name, "CONTEXT.md"));

/** Every item in one state, oldest first — by `created_at`, which costs one read per
 *  item now that the name no longer carries the date. */
export function items(inbox: string, state: InboxSystem.ValueObjects.ItemState): Located[] {
  const dir = stateDir(inbox, state);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => statSync(join(dir, n)).isDirectory() && isItem(dir, n))
    .map((name) => read(join(dir, name), name, state))
    // By NAME, and the `NNN` leads it: arrival order, free, no frontmatter read. The
    // `created:` is still the truth about WHEN — the number is the truth about ORDER.
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One item folder, read. Split out because `locate` and `items` need the same four
 *  answers and a second copy is how the two start disagreeing about `answered`. */
function read(dir: string, name: string, state: InboxSystem.ValueObjects.ItemState): Located {
  const file = join(dir, "CONTEXT.md");
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  return {
    name,
    state,
    dir,
    file,
    title: text.match(/^#\s+(.*)$/m)?.[1]?.trim() ?? name,
    created_at: createdAt(dir, text),
    answered: /`#processed`/.test(text) ? "processed" : /`#dropped`/.test(text) ? "dropped" : undefined,
  };
}

/** The item with that name, wherever it sits. The name IS the folder, so the common
 *  case is a three-`existsSync` lookup and never a scan.
 *
 *  A bare number works too — `my inbox pull 007` — because the number is the part a
 *  human reads off the screen and retypes, and making them spell the whole slug to
 *  address a thing they can SEE is the kind of friction that ends in copy-paste. */
export function locate(inbox: string, name: string): Located | undefined {
  const byNumber = /^\d{1,3}$/.test(name) ? name.padStart(3, "0") : undefined;

  for (const state of STATES) {
    const dir = stateDir(inbox, state);
    if (byNumber) {
      const hit = existsSync(dir) ? readdirSync(dir).find((n) => n.startsWith(`${byNumber}_`)) : undefined;
      if (hit && existsSync(join(dir, hit, "CONTEXT.md"))) return read(join(dir, hit), hit, state);
      continue;
    }
    if (existsSync(join(dir, name, "CONTEXT.md"))) return read(join(dir, name), name, state);
  }
  return undefined;
}

/** The next free `NNN`, counted from the highest across ALL THREE states. Never
 *  reuses a number an archived item already owns: two records sharing an address in
 *  one inbox is exactly the kind of collision the name exists to prevent. */
export function nextNumber(inbox: string): string {
  const used = STATES.flatMap((s) => items(inbox, s))
    .map((i) => Number(i.name.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return String(next).padStart(3, "0");
}

/** Move the whole folder to another state. The item keeps its name — the move IS the
 *  state change, and `renameSync` is atomic on one filesystem, so there is no instant
 *  where the item is in two places or in none. */
export function moveTo(item: Located, inbox: string, state: InboxSystem.ValueObjects.ItemState): string {
  const dir = stateDir(inbox, state);
  // The state folder is created on demand: an inbox that never archived anything has
  // no `archive/`, and demanding one up front would make every new inbox a two-step
  // setup that someone eventually skips.
  mkdirSync(dir, { recursive: true });
  const target = join(dir, item.name);
  if (existsSync(target)) throw new Error(`já existe ${target} — registro congelado, não se sobrescreve`);
  renameSync(item.dir, target);
  return target;
}
