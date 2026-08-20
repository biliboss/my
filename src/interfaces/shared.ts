//! `shared` — mechanisms every system may use and no domain owns.
//!
//! A type belongs here only when it stays correct after every domain noun disappears.
//! Time, outcomes, telemetry and grammar qualify; boards, claims and work never do.
//!
//! THIS ONE IS NOT A DRAFT. Grammar validators and boundary telemetry run in
//! `src/shared/`; persistence remains an injected adapter, never domain code.
//!
//! implemented: src/shared/grammar.ts · src/shared/telemetry.ts · src/shared/house.ts
//! depends_on:  src/shared/

export declare namespace Shared {
	export type Instant = string;
	export type Millis = number;
	export type Outcome = "ok" | "refused" | "failed" | "cancelled" | "aborted";

	/** One terminal diagnostic observation, never a domain fact. */
	export interface Span {
		readonly id: string;
		readonly verb: string;
		readonly at: Instant;
		readonly took: Millis;
		readonly outcome: Outcome;
		readonly by: string;
		readonly parent?: string;
		readonly says?: string;
	}
	/** One declared telemetry subject, including subjects never used. */
	export interface UsageDeclaration {
		readonly what: string;
		readonly first_seen: Instant;
	}
	export interface Use extends UsageDeclaration {
		readonly calls: number;
		readonly last?: Instant;
		readonly by: readonly string[];
		readonly refusals: number;
	}
	/** One number this house watches about itself, stamped. */
	export interface Measure {
		readonly name: string;
		readonly value: number;
		readonly at: Instant;
	}

	export interface Series {
		readonly days: readonly string[];
		readonly counts: readonly number[];
	}
	export namespace ValueObjects {
		export namespace GrammarStyle {
			export type Words<Max extends number> = string & {
				readonly "grammar.words": { readonly max: Max };
			};
			export type Paragraphs<Count extends number> = string & {
				readonly "grammar.paragraphs": { readonly count: Count };
			};
			export type SingleParagraph = Paragraphs<1>;
			export type InSections<BodyStyle extends string = string> = string & {
				readonly "grammar.sections": BodyStyle;
			};
		}
	}
}

/** Observes the application seam; implementations preserve sync/async return and rethrow failures. */
export interface Logging {
	around<Result>(
		verb: string,
		by: string,
		run: () => Result,
		options?: {
			readonly parent?: string;
			readonly outcome?: (result: Awaited<Result>) => Shared.Outcome;
		},
	): Result;
	spans(since?: Shared.Instant): readonly Shared.Span[];
}

/** Usage is a projection over spans plus the catalogue that makes “never called” knowable. */
export interface UsageLogging extends Logging {
	catalog(items: readonly Shared.UsageDeclaration[]): void;
	used(): readonly Shared.Use[];
	dead(since: Shared.Instant): readonly Shared.Use[];
	trend(what: string): Shared.Series;
}

/** Validators preserve prior brands, so calls compose through ordinary function nesting. */
export interface Grammar {
	words<Text extends string, Max extends number>(
		text: Text,
		max: Max,
	): Text & Shared.ValueObjects.GrammarStyle.Words<Max>;
	paragraphs<Text extends string, Count extends number>(
		text: Text,
		count: Count,
	): Text & Shared.ValueObjects.GrammarStyle.Paragraphs<Count>;
	inSections<Text extends string, BodyStyle extends string>(
		text: Text,
		body: (section: string) => BodyStyle,
	): Text & Shared.ValueObjects.GrammarStyle.InSections<BodyStyle>;
}

/** THE HOUSE MEASURING ITSELF. Absorbed from the deleted `system.ts` (20/08):
 *  five verbs and one type, and the file existed to hold them.
 *
 *  It belongs HERE, in the layer everybody imports and that imports nobody, for the
 *  reason `system` gave for its own isolation: it runs each system's `check()` BY
 *  SHAPE — anything `{ check(): Finding[] }` — so it needs no import per neighbour
 *  and gains none by moving. A file whose only argument was "I depend on nothing" is
 *  describing `shared`.
 *
 *  `hooks()` did not come along: it reads Claude Code's `settings.json`, a program
 *  this house does not own, and that is `tools`. The old header said so and left it
 *  anyway — the seam it named is the one it was cut on. */
export interface House {
	/** Every measure, one call. Today that is the ratchet's twelve (`okf.sem`,
	 *  `maps.sem_mapa`, …) plus `findings`, `systems` and `systems_with_check` — and NOT
	 *  the `backlog_cards`/`wip_over_limit` this line used to promise, because `kanban`
	 *  is still `planned:` and a board nobody writes has no cards to count. */
	metrics(): readonly Shared.Measure[];

	/** What each system's own `check()` found, grouped by system. Structural, so a new
	 *  system is covered by existing and not by being registered. */
	check(): Record<string, readonly { path: string; says: string }[]>;

	/** THE CATRACA: no number in this house may go UP. What turns "we should clean
	 *  that up" into a build failure, and the one thing a per-system check cannot do —
	 *  comparing today against yesterday needs somebody who sees all of them and
	 *  remembers. */
	ratchet(): Record<string, { was: number; now: number }>;

	/** Which systems declare a check and which declare none. "Nothing to verify" is a
	 *  claim, and this is where it stops being an assumption. */
	coverage(): Record<string, number>;
}
