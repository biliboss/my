//! Tokyo Night, as VALUES, so a scene can be dropped into a page that has never
//! heard of this house's tokens and still come out the right colour.
//!
//! WHY A LOCAL COPY AND NOT `my-ui/tokens.css`: on 21/08 that file declares
//! SynthWave '84 and says so in its own header. Note 002 (H4) is what swaps it
//! for Tokyo Night, and H4 has not run. Importing a variable that resolves to
//! the wrong palette is worse than a copy, because it fails silently and looks
//! deliberate.
//!
//! WHY NOT SHARED WITH THE OTHER SCENES: `scene-*` packages may not import each
//! other — note 002, Hacker/"As três bases". So this file has siblings, on
//! purpose, and all of them die on the same day: when H4 lands, every one of
//! them becomes `var(--…)` and the duplication is deleted in one commit.
//!
//! source: ~/src/my/apps/my-graph/ui/Themes.tsx — the `tokyo-night` entry, the
//!         only place in the family where this palette survived 20/08.

export const TOKYO = {
	/** The page behind everything. */
	bg: "#1a1b26",
	/** A card, a panel — one step deeper than the page. */
	panel: "#16161e",
	/** Every border and rule. */
	line: "#292e42",
	/** Body text. */
	text: "#c0caf5",
	/** Secondary text: counts, paths, the things read second. */
	dim: "#565f89",
	/** Something that RUNS — the affirmative colour. */
	runs: "#9ece6a",
	/** A draft: declared, nothing behind it yet. */
	draft: "#bb9af7",
	/** A tool, a foreign thing this house wraps. */
	tool: "#7dcfff",
	/** Something wrong, and the only colour allowed to say so. */
	danger: "#f7768e",
} as const;
