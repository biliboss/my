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
| **Tokens** | one palette — **SynthWave '84** (Robb Owen) — plus a 4px spacing scale, a fluid type scale, radii and z-layers, all as CSS custom properties |
| **Density** | `.density-compact` / `.density-comfortable` on `<html>` rescales everything that uses the scale — one knob, à la Radix |
| **No theme switch** | there is one palette and no `data-theme`. Aura and Tokyo Night existed until 20/08 and were removed with the button that picked them: an option nobody flips is code nobody tests |
| **Typography** | `Display` `Title` `Subtitle` `Lead` `Body` `Fine` `Mono` `Code` `Kbd` — each one a decided *(size, line-height, tracking)* triple |
| **Primitives** | `Button` `Chip` `ChipRow` `Compare` `Caveat` `ExternalLink` `Arrow` `Page` `Shell` `Section` `Kicker` `SplitHeading` |
| **Landing pieces** | `LpNav` `LpHero` `LpTicker` `LpFooter` `LpCarousel` `LpFamilyShowcase` `LpFoldNav` |
| **`LpParallax`** | the parallax fold: sticky panel, one step per scroll stretch, `j`/`k` stops |
| **Family** | `FAMILY` as data, `<Mark/>`, `familyLinks()` |
| **Logos** | `MyGraphMark` — the balance |
| **I18n** | `I18nProvider` `useT` `LocaleSwitch`, no dependency, keys are the source text |
| **Graph** | `@biliboss/my-ui/graph` — `GraphCanvas`, cytoscape as an **optional** peer |

## Two naming rules

**One file per component, PascalCase, named after what it exports.** `LpHero`
lives in `LpHero.tsx`. A grep for a component name finds the file, not thirty
call sites.

**The `Lp` prefix marks a LANDING-PAGE piece** — a whole fold, with an opinion
about what goes inside it. No prefix means primitive: it works on any screen,
including inside an app. `Button` has no prefix; `LpHero` does.

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
