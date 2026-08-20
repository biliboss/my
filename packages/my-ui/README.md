# @biliboss/my-ui

The design system the **my** family shares — [my](https://github.com/biliboss/my) ·
[my-graph](https://github.com/biliboss/my-graph) ·
[my-company](https://github.com/biliboss/my-company) ·
[my-kanban](https://github.com/biliboss/my-kanban).

Not a landing page. Just the package the landing pages are made of.

## Why it exists, measured

Before this repo, across the four landings:

| | |
|---|---|
| `foldnav.tsx` | **byte-identical in all four** (same md5) |
| `styles.css` | **170 lines common to all four** — 65% to 86% of each file |
| the parallax fold | written twice, and the same bug had to be fixed twice |
| the family table | 4 repos to touch to add a fifth product |

## Install

```bash
bun add github:biliboss/my-ui#semver:^0.1.0
```

Then, once, at the app entry point:

```ts
import "@biliboss/my-ui/tokens.css";
```

## What's in it

| | |
|---|---|
| **Tokens** | three themes — **SynthWave '84 (default)**, Aura, Tokyo Night — plus a 4px spacing scale, a fluid type scale, radii and z-layers, all as CSS custom properties |
| **Density** | `.density-compact` / `.density-comfortable` on `<html>` rescales everything that uses the scale — one knob, à la Radix |
| **Typography** | `Display` `Title` `Subtitle` `Lead` `Body` `Fine` `Mono` `Code` `Kbd` — each one a decided *(size, line-height, tracking)* triple |
| **Primitives** | `Button` `Chip` `ChipRow` `Compare` `Caveat` `ExternalLink` `Arrow` |
| **Layout** | `Page` `Shell` `Section` `Kicker` `SplitHeading` |
| **Chrome** | `Nav` `Hero` `Ticker` `Footer` `ThemeSwitch` |
| **Story** | the parallax fold: sticky panel, one step per scroll stretch, `j`/`k` stops |
| **FoldNav** | keyboard fold navigation — `j` down, `k` up |
| **Family** | `FAMILY` as data, `<Family/>`, `<Mark/>`, `familyLinks()` |
| **Logos** | `MyGraphMark` — the balance |
| **I18n** | `I18nProvider` `useT` `LocaleSwitch`, no dependency, keys are the source text |
| **Graph** | `@biliboss/my-ui/graph` — `GraphCanvas`, cytoscape as an **optional** peer |

## The one rule about what does *not* go in here

If only one product uses it, it belongs to that product. `cytoscape` is used by
one landing, so it lives behind a separate entry point and an optional peer
dependency — the other three never resolve it. A kanban card belongs to
my-kanban, built *from* these primitives.

## The logo language

Every mark is drawn from the same alphabet: **node and edge**. The mark does not
illustrate the product — it draws its thesis with graph primitives.

`MyGraphMark` is a **balance**: a solid edge on one side, a dashed one on the
other, holding pans of different weight. That is the whole distinction my-graph
makes — solid is `import`, read from the code; dashed is `//! depends_on:`,
declared and unverified. A diagram that treats the two as equal is lying.

## Versioning

Semver, from `v0.1.0`. Consumers track `#semver:^0.1.0`, so a patch or minor
arrives on the next `bun install` and a breaking change never does.

## License

MIT — see [`LICENSE`](LICENSE).
