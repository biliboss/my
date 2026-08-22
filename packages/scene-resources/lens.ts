//! WHICH OF THE THREE LENSES CAN TELL THE TRUTH ABOUT THIS PILE, counted before
//! anything is drawn.
//!
//! The shape is borrowed from `_today/apps/agent_conversation/app/LensRegistry.ts`
//! — "a lens that would render empty is ABSENT, not greyed" — but NOT the file:
//! that one is about a single attention claim and knows `graph · timeline · table
//! · diff · surface · raw`. The idea travels, the code does not.
//!
//! ── THE FAILURE HERE IS THE MIRROR IMAGE OF THAT ONE ────────────────────────
//!
//! `LensRegistry` guards against a lens with no evidence. This file guards
//! against a lens with FABRICATED evidence, which is the failure mode this
//! particular store actually has.
//!
//! `my-resources/store.ts` ends `porPasta(rel) ?? "hacker"`: a page that matches
//! no seed folder is filed as hacker. Measured 21/08 against the real index:
//!
//!     175 resources · the store says hacker 160 · hipster 12 · hustler 3
//!     of those 160, 27 carry a label — 26 sit under a hacker seed folder and
//!     one is a `.ts` this package ships, which declares its own lens.
//!     The other 133 were labelled by nobody.
//!
//! So a tab reading "hacker · 160" is the same lie as an empty chart, told the
//! other way round: it claims 160 pages were labelled `hacker` when 134 of them
//! were never labelled at all. Evidence here counts ONLY the labelled ones, and
//! the unlabelled pile is rendered as itself — see `unlabelled`.
//!
//! Nothing in this file reaches for data. `adapt.ts` is what turns an index into
//! `SceneResource[]`, and the base is what calls it.

/** Closed, and closed for the reason `interfaces/company.ts` gives about `Trio`:
 *  a fourth member is a different theory, not a new value. */
export const LENS_NAMES = ["hustler", "hacker", "hipster"] as const;
export type LensName = (typeof LENS_NAMES)[number];

/** What each lens is FOR, in the words of `interfaces/resources.ts`. Copied as a
 *  sentence rather than imported as a doc comment for the reason that file gives
 *  about `LENSES`: a paragraph is a fact nothing can read. */
export const LENS_ASKS: Record<LensName, string> = {
	hustler: "what is this worth, and to whom",
	hacker: "how it is built, and why it broke",
	hipster: "what is worth building, and how it should feel",
};

/** One resource, as a scene needs it. Declared HERE, never imported from
 *  `my-resources`: a scene that imports the reader has imported `node:fs`, and a
 *  scene that can read the disk will eventually read the disk. Structural on
 *  purpose — the same trick `Finding` uses in the contracts. */
export type SceneResource = {
	name: string;
	kind: string;
	/** One line: what this resource answers. */
	answers: string;
	/** When it was MEASURED. Empty is a real answer and a loud one. */
	at: string;
	/** Absolute path, or `""` for a resource this package ships as code. */
	path: string;
	lens: LensName;
	/** `true` when `lens` was DECLARED — by the resource itself, or by a seed
	 *  folder. `false` when it is the `?? "hacker"` default wearing a label. */
	labelled: boolean;
};

export const inLens = (rs: SceneResource[], lens: LensName): SceneResource[] =>
	rs.filter((r) => r.lens === lens && r.labelled);

/** Everything filed by default rather than by label. Its own pile, never folded
 *  into a lens: 133 of 175 on 21/08, and hiding that inside `hacker` is how the
 *  house would go on believing it has a technical library. */
export const unlabelled = (rs: SceneResource[]): SceneResource[] => rs.filter((r) => !r.labelled);

/** The strip, in declaration order, minus the lenses that would lie.
 *
 *  `LensRegistry` wraps this in an `evidence` object carrying a note about why a
 *  lens is absent. There is nothing to explain here: what a lens does not claim
 *  is drawn as `unlabelled`, on screen, next to it. Unlike that file there is
 *  also no `raw` exception — the receipt this scene owes IS the unlabelled pile,
 *  and that one is not a lens. */
export const offeredLenses = (rs: SceneResource[]): LensName[] =>
	LENS_NAMES.filter((l) => inLens(rs, l).length > 0);
