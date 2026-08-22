"use client";

//! THE SCENE: what this house knows, read through one of the three lenses.
//!
//! (`"use client"` before the header and not after it: `ImageStrip.tsx` and
//! `ImageMeta.tsx` in `agent_conversation` both do it that way, and a directive
//! is not documentation. Every other file in this package opens with `//!`.)
//!
//! ONE QUESTION, and the question is *which lens is this pile being read
//! through* — not "search the house", which is `search()` and belongs to a
//! command, and not "read this page", which is a destination and not a scene.
//!
//! ── IT FETCHES NOTHING, AND IT HOLDS NO STATE ───────────────────────────────
//!
//! `resources` arrives read. `reading` arrives decided. The scene renders and
//! calls back, which is what lets the same component sit behind a URL hash, a
//! keyboard chord or a test with no branch anywhere.
//!
//! ── IT REFUSES TO INFLATE A LENS ────────────────────────────────────────────
//!
//! A lens counts only what was LABELLED into it. Everything the store filed by
//! default has its own tab, in `draft` purple, saying so — see `lens.ts` for the
//! measurement that made this the first thing the screen shows.
//!
//! ── GEOMETRY ────────────────────────────────────────────────────────────────
//!
//! The root sets no width, no margin and no page background: the parent decides
//! where this lives. What is intrinsic — the gap between two rows, the size of a
//! chip — is here, and only that.
//!
//! depends_on: ./lens.ts · ./tokyo.ts

import { TOKYO } from "./tokyo.ts";
import {
	LENS_ASKS,
	type LensName,
	type SceneResource,
	inLens,
	offeredLenses,
	unlabelled,
} from "./lens.ts";

export type ResourcesSceneProps = {
	/** Already read. `@biliboss/scene-resources/adapt` is what shapes them. */
	resources: SceneResource[];
	/** Which tab is open. `null` is the unlabelled pile, which is a real answer
	 *  and the one worth opening on while 133 of 175 live there. */
	reading: LensName | null;
	onRead: (next: LensName | null) => void;
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

export function ResourcesScene({ resources, reading, onRead }: ResourcesSceneProps) {
	const offered = offeredLenses(resources);
	const loose = unlabelled(resources);
	const shown = reading === null ? loose : inLens(resources, reading);

	return (
		<section style={{ color: TOKYO.text, display: "flex", flexDirection: "column", gap: 16 }}>
			<nav style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
				{offered.map((lens) => (
					<Tab
						key={lens}
						label={lens}
						count={inLens(resources, lens).length}
						tint={TOKYO.tool}
						active={reading === lens}
						onClick={() => onRead(lens)}
					/>
				))}
				{loose.length > 0 && (
					<Tab
						label="no lens"
						count={loose.length}
						tint={TOKYO.draft}
						active={reading === null}
						onClick={() => onRead(null)}
					/>
				)}
			</nav>

			<p style={{ margin: 0, color: TOKYO.dim, fontSize: 13, lineHeight: 1.5 }}>
				{reading === null
					? "Filed by default, not by label. The store ends `porPasta(rel) ?? \"hacker\"`, so every page below is wearing a lens nobody chose — counted here instead of inflating one."
					: LENS_ASKS[reading]}
			</p>

			<ol
				style={{
					listStyle: "none",
					margin: 0,
					padding: 0,
					display: "flex",
					flexDirection: "column",
					gap: 1,
					background: TOKYO.line,
					border: `1px solid ${TOKYO.line}`,
					borderRadius: 8,
					overflow: "hidden",
				}}
			>
				{shown.map((r) => (
					<Row key={r.path || r.name} resource={r} />
				))}
			</ol>
		</section>
	);
}

function Tab({
	label,
	count,
	tint,
	active,
	onClick,
}: {
	label: string;
	count: number;
	tint: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			style={{
				display: "inline-flex",
				alignItems: "baseline",
				gap: 8,
				padding: "6px 12px",
				borderRadius: 999,
				cursor: "pointer",
				font: "inherit",
				fontSize: 13,
				background: active ? TOKYO.panel : "transparent",
				color: active ? tint : TOKYO.dim,
				border: `1px solid ${active ? tint : TOKYO.line}`,
			}}
		>
			<span>{label}</span>
			<span style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>{count}</span>
		</button>
	);
}

function Row({ resource }: { resource: SceneResource }) {
	return (
		<li
			style={{
				background: TOKYO.bg,
				padding: "10px 14px",
				display: "flex",
				flexDirection: "column",
				gap: 4,
			}}
		>
			<div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
				<span style={{ fontFamily: MONO, fontSize: 13 }}>{resource.name}</span>
				<span style={{ color: TOKYO.dim, fontSize: 11 }}>{resource.kind}</span>
				{resource.path === "" && (
					<span style={{ color: TOKYO.runs, fontSize: 11 }} title="shipped by this package as code">
						embedded
					</span>
				)}
				{/* A hacker resource with no date is an opinion — `resource.ts` says so,
				    and this is where the sentence becomes visible. */}
				<span
					style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, color: resource.at ? TOKYO.dim : TOKYO.danger }}
				>
					{resource.at || "undated"}
				</span>
			</div>
			<span style={{ color: TOKYO.dim, fontSize: 12, lineHeight: 1.4 }}>{resource.answers}</span>
		</li>
	);
}
