//! THE BASE'S HALF OF THE CONTRACT: an index, turned into what the scene draws.
//!
//! It exists as a separate entry (`@my/scene-resources/adapt`) because it
//! is the only file here that is allowed to know how `my-resources` shapes a
//! resource, and because the scene must never be the thing that calls it. The
//! base reads — `await index()` — and hands the result down as props.
//!
//! ── WHAT IT ACTUALLY DECIDES: `labelled` ────────────────────────────────────
//!
//! `store.ts` writes `lens` two different ways and the result is the same field:
//!
//!   embedded `.ts`   the value declares its own `lens`, and `resource()` leaves
//!                    `path` as `""` because nothing on disk holds it
//!   house markdown   `porPasta(rel) ?? "hacker"` — a seed folder, or the default
//!
//! So `path === ""` is not a formatting detail here, it is the evidence that a
//! lens was DECLARED rather than defaulted. The second half is `LENSES[*].reads`,
//! which the contract itself demotes to a SEED — this file reads it as exactly
//! that: proof somebody put the page in that folder on purpose.
//!
//! Measured 21/08 over the real index: 175 in, 42 labelled, 133 defaulted.
//!
//! No `node:` import, no i/o, nothing async — this runs wherever the base runs.
//!
//! depends_on: ./lens.ts · @my/interfaces/resources.ts

import { LENSES } from "@my/interfaces/resources.ts";
import { LENS_NAMES, type LensName, type SceneResource } from "./lens.ts";

/** The shape this adapter needs, and no more. Structural, so `my-resources` is
 *  never imported — it satisfies this by accident of being itself. */
export type IndexedResource = {
	name: string;
	kind: string;
	path: string;
	answers?: string;
	at?: string;
	lens?: string;
};

/** Did somebody FILE this page under a lens, or did it land under one? */
const seeded = (name: string): boolean =>
	Object.values(LENSES).some((cfg) =>
		(cfg.reads as readonly string[]).some((p) => name === p || name.startsWith(`${p}/`)),
	);

const isLens = (v: unknown): v is LensName => LENS_NAMES.includes(v as LensName);

export function adapt(rs: IndexedResource[]): SceneResource[] {
	return rs.map((r) => ({
		name: r.name,
		kind: r.kind,
		// The one-liner, or the name. Never a slice of the body: a truncated
		// paragraph reads like a summary and is not one.
		answers: r.answers?.trim() || r.name,
		at: r.at?.trim() ?? "",
		path: r.path,
		lens: isLens(r.lens) ? r.lens : "hacker",
		labelled: r.path === "" || seeded(r.name),
	}));
}
