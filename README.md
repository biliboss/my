# my

**The AI doesn't need another framework. It needs to know where it is.**

[![Publish GitHub Pages](https://github.com/biliboss/my/actions/workflows/pages.yml/badge.svg)](https://github.com/biliboss/my/actions/workflows/pages.yml)

![my — the system the AI can read](public/og.png)

A local-first personal operating system and CLI — folders, contracts and
readable files as the architecture. You see every step. The AI receives only
the context it needs.
**[Read the thesis →](https://biliboss.github.io/my/)**

## The family

| repo | job |
|---|---|
| **my** | the system: local-first, plain text as interface, the human is the gate |
| [my-graph](https://github.com/biliboss/my-graph) | the X-ray: draws who depends on whom, read from the code |
| [my-company](https://github.com/biliboss/my-company) | the theory: the three processes every company depends on |
| [my-kanban](https://github.com/biliboss/my-kanban) | the board: one set of cards, every question |

## The runtime lives here now

`my` is a CLI. **The directory tree IS the command surface** — a folder is a verb,
a file is a subverb, and nothing declares a command anywhere: `src/cli/my.ts`
scans `src/` at startup and builds the parser from what it finds. Moving a file
changes the CLI, which is the point — it is what stops a command from existing
with no code behind it.

```bash
bun install
bun run src/cli/my.ts            # the legend
bun run src/cli/my.ts home paths # the three roots, and how each was decided
```

Put it on your PATH as a three-line shim that runs the SOURCE, never a compiled
binary — `bun build --compile` freezes the scan into whatever `src/` looked like
at build time:

```bash
printf '#!/usr/bin/env bash\nexec bun run "%s/src/cli/my.ts" "$@"\n' "$PWD" > ~/.local/bin/my
chmod +x ~/.local/bin/my
```

### Three roots, and none of them is "the repo"

The single most load-bearing idea here, and the one that made this repository
possible:

| | is | default | env |
|---|---|---|---|
| **root** | the HOUSE — what the verbs read and write | `~/src/me` | `MY_HOME` |
| **code** | the CHECKOUT this process came from | `.git` anchor | `MY_CODE` |
| **machine** | what is true of THIS machine only | `~/.me` | `MY_MACHINE` |

They used to be one answer, because the code lived inside the house. Twenty files
called `repoRoot()` to find `01_projects/`. Split them and the same call returns
the wrong path **with no error** — so the split had to happen before the move,
not after. `my home check` is what keeps it honest, and `my home env` declares
every one of the 27 variables this house reads.

Your house is not this repository. Point `MY_HOME` at your own tree:

```bash
MY_HOME=~/my-house my projects check
```

## The public page

`landing/` — the thesis, published to https://biliboss.github.io/my/ by GitHub
Actions on every push to `main`. It sat at the repository root until the runtime
arrived and both wanted `src/`; the page is what moved, because this repository
is the system.

```bash
cd landing && bun install && bun run dev
```

- Study reference: [`landing/references/icm-study.md`](landing/references/icm-study.md)
- Source ledger: [`landing/src/data/icm-links.json`](landing/src/data/icm-links.json)

## Evidence boundary

The page cites *Interpretable Context Methodology: Folder Structure as Agent Architecture* as related research. It does not claim endorsement, controlled proof, or that every described capability has already migrated into this repository.
