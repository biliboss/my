#!/usr/bin/env bun
//! `inbox/capture` — kills the friction of "I just had an idea": the request becomes
//! a FOLDER of its own in `backlog/`, and nothing else happens.
//!
//!     bun run src/inbox/capture.ts "the request text"
//!     my inbox capture "fix up the cockpit"
//!     my inbox capture "the openai route" --to 01_projects/via-nextjs/inbox
//!     ... < body.md                    (the body comes from stdin, when piped)
//!
//! Without this the request becomes a chat message, and a message dies with the
//! session — which is exactly what @00_inbox/CONTEXT.md exists to prevent.
//!
//! IT LANDS IN `backlog/` AND WAKES NOBODY, which is the decision that changed on
//! 20/08. Capture used to steer the agent's pane on the spot, and that made every
//! request equally urgent: 13 of 20 sat parked for 3 days looking exactly like the
//! ones nobody had read. Deciding to work on something is a separate act, and it has
//! its own verb — `my inbox pull` is what wakes an agent.
//!
//! ONE FOLDER PER ITEM, `backlog/<name>/`, with the request in its
//! `CONTEXT.md` and the pasted screenshot beside it. The folder is what makes the
//! state honest: it MOVES, so `ls backlog` is the answer to "what is waiting" and
//! cannot drift from a status field nobody updated.
//!
//! depends_on: src/inbox/layout.ts · src/inbox/system_inbox.ts · src/shared/file.ts · 00_inbox/CONTEXT.md
//! impacts:    justfile#inbox · ~/src/main.code-workspace#tasks · src/CONTEXT.md
//!
//! Both directions are DECLARED, not derived — see 02_areas/design/010. The `import` above
//! is already the truth for code deps; what a parser cannot see is that `just
//! inbox` calls this and that a VS Code task calls that.

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readStdin, slug } from "../shared/file.ts";
import { FOLDER, inboxAt, locate, nextNumber } from "./layout.ts";
import type { Inbox } from "./system_inbox.ts";

const argv = process.argv.slice(2);
const toAt = argv.findIndex((a) => a === "--to");
const to = toAt === -1 ? undefined : argv[toAt + 1];
const words = toAt === -1 ? argv : [...argv.slice(0, toAt), ...argv.slice(toAt + 2)];

if (toAt !== -1 && !to) {
  console.error("usage: --to <inbox folder>   (e.g. 01_projects/via-nextjs/inbox)");
  process.exit(1);
}

// `INBOX_DIR` exists so tests and smoke runs write to /tmp instead of polluting the
// real inbox. `--to` wins over it: an explicit destination is never overridden by an
// environment.
let inbox: { dir: string };
try {
  inbox = inboxAt(to ?? process.env.INBOX_DIR);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

const argText = words.join(" ").trim();
const piped = await readStdin();
const body = (piped.trim() ? piped : argText).trim();

if (!body) {
  console.error('usage: capture.ts "<the request>" [--to <inbox>]   (or pipe the body on stdin)');
  process.exit(1);
}

// The title is cut at a WORD, never mid-word. Measured on the first real capture
// after the rewrite: "…coding, design, qa" landed as "…coding, desi", which reads as
// a typo in the request rather than as a cut — and the request is the one thing here
// that has to look untouched.
const full = (argText || body.split("\n")[0]).replace(/\s+/g, " ").trim();
const title = full.length <= 72 ? full : full.slice(0, full.lastIndexOf(" ", 72)).replace(/[,;:.]$/, "") + "…";

// The NAME is the identity, and it says what the request is: `specialized_skills`,
// no date in front. The date lives in the frontmatter below, because a name is read
// by a human in a sidebar and 17 characters of timestamp before the first word is
// noise where the word is the whole point.
//
// `underscore_case` and not the house's usual hyphen: this folder name is a KEY,
// read next to `backlog/` and `archive/`, and the underscore is what the house
// already uses for a key (`01_projects`, `002_workspaces`, `in_progress`).
//
// The `NNN` in front counts UP from `001` and restores, in three characters, the one
// thing the timestamp was buying: arrival order in a plain `ls`. Up and not down
// because an inbox is a QUEUE — the top of the list is what has waited longest.
//
// Dedup happens HERE, at creation, and against all three states — an answered
// request still owns its name. A second `specialized_skills` becomes
// `specialized_skills_2`; it never becomes a second folder with the same name.
const backlog = join(inbox.dir, FOLDER.backlog);
mkdirSync(backlog, { recursive: true });
const base = `${nextNumber(inbox.dir)}_${slug(title).replace(/-/g, "_") || "request"}`;
let name = base;
for (let i = 2; locate(inbox.dir, name); i++) name = `${base}_${i}`;

const dir = join(backlog, name);
mkdirSync(dir);

// A clipboard screenshot becomes a file INSIDE the item's folder: whoever pastes an
// image is saying "this is what I mean", /tmp disappears on reboot, and a sibling
// inside the folder survives the item moving `backlog → ready → archive` with the
// relative link intact.
//
// No pngpaste (not installed) and pbpaste is text-only: the only native way to read
// an image off the macOS clipboard is the AppleScript below. The `try` IS the test —
// a clipboard with no image throws on `the clipboard as «class PNGf»`, and then we
// return empty instead of writing a zero-byte file.
const imagePath = join(dir, "print.png");
const shot = await Bun.$`osascript -e ${`
  try
    set d to the clipboard as «class PNGf»
  on error
    return ""
  end try
  set f to open for access POSIX file ${JSON.stringify(imagePath)} with write permission
  set eof f to 0
  write d to f
  close access f
  return "ok"
`}`.quiet().nothrow();

const hasImage = shot.stdout.toString().trim() === "ok";

// The request in the house's own words: the parameter shape of `Inbox.capture`,
// taken straight off the aggregate's interface. It buys nothing at runtime, and that
// is the point — it is the one place the vocabulary and the code have to agree, so a
// field renamed in `system_inbox.ts` fails HERE instead of becoming a second truth.
// `Parameters<…>` and not a hand-copied type: a copy is what drifts.
const capture: Parameters<Inbox["capture"]>[0] = {
  title,
  body,
  ...(hasImage ? { attachment: "print.png" } : {}),
};

const file = join(dir, "CONTEXT.md");
writeFileSync(
  file,
  `---
type: request
created: ${new Date().toISOString()}
---

# ${capture.title}

${capture.body}
`,
);
if (capture.attachment) appendFileSync(file, `\n![](${capture.attachment})\n`);

// pbcopy without a shell: the path may contain spaces, and interpolating into a
// shell string is how you earn a bug that only shows up on the day of the spaced
// filename.
await Bun.$`pbcopy < ${new Response(file)}`.quiet();

console.log(file);
if (hasImage) console.log(`${imagePath}  (clipboard screenshot)`);
console.log(`(no backlog · pra trabalhar nele: my inbox pull ${name})`);
