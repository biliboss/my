//! `labels` — DRAFT. One flat namespace of labels, every one with an owner, and the
//! whole thing stored as graph edges so "what else is this?" is one query.
//!
//! ── THE PROBLEM, COUNTED ─────────────────────────────────────────────────────
//!
//! Five places in this family had already invented a label and none of them knew about
//! the others: `kanban` declares them per board, `graph` colours nodes by `draft`/`tool`,
//! `resources` ships `KINDS` and `LENSES`, `vscode` carries `@tag` on a folder, and
//! `company` reserved three. Same mechanic, five spellings — which is how `p1` on a card
//! and `p1` in a folder end up meaning different things and nobody notices for a month.
//!
//! ── THE NAMESPACE IS FLAT, AND THAT IS THE DECISION ──────────────────────────
//!
//! The obvious fix is to namespace: `company:hacker`, `kanban:blocked`. It is also the
//! wrong one. A label is a thing a HUMAN TYPES — the whole value of the word is that
//! `hacker` is three syllables and no punctuation. Prefixing buys uniqueness by making
//! the label unusable, and a label nobody types is a field.
//!
//! So the bare name stays global, `by` is metadata, and **two packages declaring the
//! same name is a FINDING, never a merge**. The collision has to be loud precisely
//! because the flat namespace cannot make it impossible. This is the file's one real
//! obligation and `check()` exists for it.
//!
//! The second collision is subtler and gets checked too: two DIFFERENT names declared
//! with the same `means`. That is one concept living under two words, and it rots the
//! same way — which is why `means` is required here even though `kanban` had it
//! optional.
//!
//! ── SEALED: A RESERVED SET REFUSES A FOURTH ──────────────────────────────────
//!
//! `company` reserved `hustler · hacker · hipster` and the three ARE the theory — a
//! fourth is not an extension, it is a different claim. So a declaration can be
//! `sealed`, and `declare()` REFUSES to add to it at runtime rather than accepting and
//! warning. A warning nobody reads is how a sealed set gains a fourth member.
//!
//! Sealed is per DECLARATION, not per package: one package may seal its trio and leave
//! its operational labels open. The trio is a claim; `blocked-by-human` is a sticky note.
//!
//! ── AN APPLIED LABEL IS AN EDGE, NOT A COLUMN ────────────────────────────────
//!
//! `RELATE <subject>->labeled->label:<name>` in SurrealDB. Measured against 3.2.3 on
//! 20/08, not read in a doc. A `labels: string[]` column would read the same and lose
//! three things that were measured working:
//!
//!   · the edge CARRIES FIELDS — `at` lives on it, so "when did this get labelled"
//!     has an answer instead of a commit message.
//!   · the reverse is free — `<-labeled<-card` answers `wearing()` without scanning a
//!     table. On a column that is a full scan by definition, in every system at once.
//!   · the filter goes INSIDE the traversal — `->labeled[WHERE …]->label` is one query.
//!
//! **`RELATE` DUPLICATES SILENTLY**, and this is the measurement that decided the key:
//! two identical `RELATE a->labeled->b` leave TWO edges and the count says 2. Applying
//! a label that is already applied is the most ordinary thing a user does, and the
//! database does not complain.
//!
//! The fix is the EXPLICIT deterministic id — `labeled:[<subject>, <label>]` — measured
//! the same day: two RELATEs with the same id leave ONE edge. It is @CLAUDE.md's
//! natural-key rule applied to a graph: dedup at CREATION, never after. `apply()` is
//! idempotent by construction, which is why it has no `reapply` sibling.
//!
//! ── SEARCH IS THE OTHER HALF ─────────────────────────────────────────────────
//!
//! A label nobody can search for is a field with extra steps. Native full-text,
//! measured: `DEFINE ANALYZER pt TOKENIZERS blank,class FILTERS lowercase,ascii,
//! snowball(portuguese)` plus `DEFINE INDEX … FULLTEXT ANALYZER pt BM25`, then `@@` in
//! the `WHERE`.
//!
//! **`SEARCH` BECAME `FULLTEXT` in 3.x** — `DEFINE INDEX … SEARCH` is a PARSE ERROR,
//! and the message (`Unexpected token, expected Eof`) does not say which word it
//! disliked. Four attempts.
//!
//! What the analyzer buys, measured in this order: `estourar` finds "o parser ESTOURA
//! em arquivo vazio" (snowball), and `arquivos` finds `arquivo` (ascii + stemming).
//! Without those two filters, search is `LIKE` under another name.
//!
//! `search::score()` RETURNED 0 on the probe while the row matched. I do not know
//! whether that is the index, the query or the `@1@`, and ranking that was not
//! measured does not enter a contract — `find()` returns database order until somebody
//! measures it. It is the only unmeasured claim in this file.
//!
//! ── LABELLING IS AN EVENT, AND THAT IS THE OTHER HALF OF THE POINT ──────────
//!
//! "This got labelled `blocked`" is a FACT something should react to. Once labels are
//! edges in one store, the bus is already there — and a house that has one bus stops
//! inventing a second one per system.
//!
//! TWO MECHANISMS, MEASURED, AND THEY ARE NOT ALTERNATIVES:
//!
//!   `LIVE`   push to whoever is CONNECTED. `db.live(new Table("labeled"))` fires on
//!            CREATE and DELETE of the edge. Nothing durable: a subscriber that was
//!            not there missed it, by design.
//!   `EVENT`  `DEFINE EVENT … WHEN $event = "CREATE" THEN (CREATE outbox …)` — the
//!            server writes the fact down. It fired on `RELATE`, measured. This is
//!            what a `my_api` reads on boot to catch up.
//!
//! `watch()` is the LIVE one because that is what a CLI wants; the outbox is what an
//! API wants, and the same edge feeds both. Neither needs a broker.
//!
//! **THE `.where()` OF A LIVE QUERY IS IGNORED WHEN GIVEN A STRING**, and this is the
//! nastiest thing measured all day: `.where("out = label:bug")` does not throw, does
//! not warn, and delivers EVERY event on the table to a subscriber that believed it
//! had filtered. In a pub/sub that is every consumer reacting to everything. Only
//! `surql\`out = ${new RecordId("label","bug")}\`` filters. `match` below exists so a
//! caller never has to know this — it builds the expression.
//!
//! ── THE RULES LIVE IN THE DATABASE, NOT IN THIS INTERFACE ───────────────────
//!
//! Measured 20/08, and it changes what `apply()` has to do:
//!
//!   `ASSERT`      refuses at write time with a usable message — `means` cannot be
//!                 empty, and the client stops re-validating it.
//!   `SCHEMAFULL`  refuses a field nobody declared: a typo becomes an error instead
//!                 of a new column.
//!   `DEFAULT`     `at` is `time::now()` on the edge — the client never sends it.
//!   `TYPE RELATION IN … OUT …`  the edge cannot point at the wrong kind of thing.
//!
//! So `apply()` is thin on purpose. A validation written here AND asserted there is
//! two rules that drift; the one that survives is the one the database enforces.
//!
//! ── NATIVE TYPES, NOT STRINGS ───────────────────────────────────────────────
//!
//! `at` is `datetime`, not an ISO string — a date kept as text is a date compared with
//! string `<`. The subject and the label are `record<t>` links, which is what makes
//! `->` traversal and `FETCH` work at all. A group's membership is a `set<>`, not an
//! `array<>`: unordered and unique is exactly the rule, and expressing it in the type
//! means no code enforces it.
//!
//! This interface still speaks `Shared.Instant` at its edge because a CLI prints
//! strings — the STORAGE is native, the boundary is not.
//!
//! ── EVERYTHING IS ASYNC, AND THAT IS NOT STYLE ───────────────────────────────
//!
//! The first draft of this interface was synchronous. It cannot be: the store is a
//! SurrealDB standalone reached over a socket, and its JS SDK is async-only (measured —
//! there is no 3.x SDK on npm and 2.0.8 speaks to server 3.2.3). A sync signature here
//! would be a lie that only surfaces at the first forgotten `await`, which is the same
//! correction `tools.ts` already took.
//!
//! ── WHAT THIS OWES, AND IS NOT DONE UNTIL IT PAYS ────────────────────────────
//!
//! FIRST DEBT PAID, 20/08: `kanban.ValueObjects.Service` was `string` with the three
//! names living in a comment — a second store of a vocabulary `tasks` also had. It now
//! points at `tasks.LABELS.service`, so the board SELECTS from what was declared
//! instead of describing it again. That is the shape every other absorption takes.
//!
//! SECOND DEBT PAID, same day: `resources.LENSES[*].reads` was a folder list, and a
//! folder list is a reading FROZEN INTO A PATH — a page in the wrong folder was in the
//! wrong lens forever, and nobody could say why. A lens is now `wearing(<label>)`, with
//! `reads` demoted to the seed. It crosses systems for free: a task, a folder and a
//! page can all be `hacker`, which no folder list can express.
//!
//! `kanban` PAID DIFFERENTLY, and the difference is worth reading: it declares its five
//! column words and NEVER applies them. Declaring buys the word in the flat namespace
//! so a second `done` is a collision; applying would make this file state, which it
//! refuses to be. Same registry, opposite use.
//!
//! `kanban.Board.labels` is a second store of the same thing. It becomes a SELECTION of
//! declared labels — the board says which it uses, not what they mean — and this file is
//! a fifth spelling until that edit lands. `company.Role` stays a closed TS union AND
//! registers here: the union is the compile-time claim, the declaration is what makes
//! `check()` able to see the collision at all.
//!
//! ── WHAT IT REFUSES TO BE ────────────────────────────────────────────────────
//!
//! Not a hierarchy. `group` groups, it does not nest — inside a group a subject holds
//! at most one, and that is the only structural rule a label needs. A tree of labels is
//! the feature every tagging system grows and nobody uses twice.
//!
//! Not permission, not workflow, not state. A thing labelled `done` is not done; the
//! system that knows is `tasks`. A label that decides behaviour is an enum wearing
//! data's clothes.
//!
//! external:    SurrealDB — `RELATE`, arrow traversal, FULLTEXT index
//! implemented: nothing
//! planned:     packages/my-labels/
//! depends_on:  packages/interfaces/shared.ts · packages/interfaces/home.ts
//! absorbs:     kanban.Entities.Label · kanban.ValueObjects.Service · company.Role ·
//!              resources.LENSES — a selection each, never a second store
//! checks:      declared HERE, never imported. `check()` returns `Finding[]` and the
//!              runner reads the shape, so owning a check costs no dependency.

/** What this system found rotten. Declared here rather than imported: the runner reads
 *  the shape, so owning a check costs no dependency on a hub. */
export interface Finding {
	path: string;
	says: string;
}

import type { Shared } from "./shared";

export declare namespace LabelSystem {
	/** Who declared it — `@biliboss/company`. The package name, because that is the unit
	 *  that ships and the unit a collision is reported against. */
	export type PackageName = string;

	/** Bare, global, and typed by a human. Lowercase kebab so two spellings of one word
	 *  are not two labels. */
	export type LabelName = string;

	/** WHEN ONE LABEL EXCLUDES ANOTHER — `priority`, `size`. Within a group a subject
	 *  holds at most one, which is what `kanban` needed for swimlanes and what plain
	 *  GitHub labels cannot do. Groups are global too, for the same reason names are. */
	export type Group = string;

	/** WHAT CARRIES LABELS. Deliberately not an id alone: `card/7` and `folder/7` are
	 *  different subjects, and a labelling system that cannot tell them apart will
	 *  eventually report that a folder is blocked.
	 *
	 *  THE PAIR IS THE RECORD ID — `card:7` in SurrealDB — which is what makes "generic"
	 *  true without a join table per type. Two fields and not one string because the
	 *  string form is the STORAGE, and a caller that assembles it by hand gets one
	 *  colon wrong and silently labels nothing. */
	export interface Subject {
		system: string;
		id: string;
	}

	/** What a human types into a search box. It goes through the analyzer, so
	 *  `estourar` finds `estoura` and `arquivos` finds `arquivo` (measured 20/08). */
	export type Query = string;

	export interface Label {
		name: LabelName;
		by: PackageName;
		/** REQUIRED, unlike `kanban`'s optional description. It is the field the second
		 *  collision check reads: two names with one meaning is one concept under two
		 *  words, and no amount of uniqueness on `name` catches it.
		 *
		 *  It is also what gets INDEXED: searching "urgent" has to find `p1` when that
		 *  is what somebody wrote here. */
		means: Shared.ValueObjects.GrammarStyle.Words<15>;
		group?: Group;
		/** For the eye only. Nothing in the model ever branches on it. */
		color?: string;
	}

	/** WHAT A PACKAGE DECLARES, in one call. A package with two declarations has two
	 *  sets with two seal states, which is the point — the trio is sealed, the sticky
	 *  notes are not. */
	export interface Declaration {
		by: PackageName;
		/** The set is the claim: `declare()` refuses to extend it, and the refusal is an
		 *  error rather than a warning. */
		sealed: boolean;
		labels: Label[];
		at: Shared.Instant;
	}

	/** WHY A DECLARATION OR AN APPLICATION WAS REFUSED. Four reasons, answered
	 *  differently — which is the whole reason this is tagged and not a message.
	 *
	 *  · `collision`  the name is already owned by another package
	 *  · `synonym`    a different name already declared this exact `means`
	 *  · `sealed`     the set said three, and this is the fourth
	 *  · `undeclared` a subject was labelled with a name nobody ever declared */
	export type Refusal = {
		ok: false;
		reason: "collision" | "synonym" | "sealed" | "undeclared";
		label: LabelName;
		/** Present on `collision` and `synonym`: the label already holding the ground.
		 *  Returned rather than described, because the answer to both is a conversation
		 *  with whoever owns the other one. */
		conflictsWith?: Label;
	};

	/** WHO GETS WOKEN. One label, a set of them, a whole group, or everything — the
	 *  flexibility is the point, because the interesting subscription is rarely one word.
	 *
	 *  `any` fires when ANY of them lands; `all` only when the subject ends up wearing
	 *  every one. The second is the expensive one and it is why this is a TYPE instead
	 *  of a string: `blocked` alone is noise, `blocked` AND `p1` is a page.
	 *
	 *  A string here would also be the bug the header describes — the live `.where()`
	 *  swallows strings silently, so the caller never hands one over. */
	export type Match =
		| { any: LabelName[] }
		| { all: LabelName[] }
		| { group: Group }
		| "everything";

	/** What a subscriber receives. `action` is the EDGE's, not the subject's: a label
	 *  going on and a label coming off are different news, and collapsing them is how a
	 *  listener ends up re-running work on an untag. */
	export interface Event {
		action: "applied" | "removed";
		subject: Subject;
		label: LabelName;
		at: Shared.Instant;
	}

	/** The handle. `stop()` and nothing else: a subscription that can only be ended by
	 *  ending the process is a leak with a heartbeat. */
	export interface Watch {
		match: Match;
		stop(): void;
	}

	/** THE EDGE. `at` lives on the relation, not on the subject and not on the label —
	 *  it is a fact about the LINK, and putting it anywhere else makes it a fact about
	 *  the wrong thing. */
	export interface Applied {
		subject: Subject;
		label: LabelName;
		at: Shared.Instant;
	}

	/** WHAT A SEARCH RETURNS. `why` is not decoration: a list of subjects makes the
	 *  caller guess whether the hit came from the label or from the text, and those two
	 *  are fixed in different ways. */
	export interface Hit {
		subject: Subject;
		why: "label" | "text";
		/** The matched fragment, when it came from text. */
		excerpt?: string;
	}
}

/** `my labels <verb>`. Declaring is rare and loud; applying is common and quiet.
 *
 *  Async throughout — see the header. The store is a socket away. */
export interface Labels {
	/** THE ONE THAT EARNS THE FILE: every name owned once, no two names meaning the same
	 *  thing, no sealed set grown a member, no subject carrying a name nobody declared,
	 *  and no edge pointing at a subject that no longer exists. */
	check(): Promise<Finding[]>;

	// ─── DECLARING ───────────────────────────────────────────────────────────

	/** Registers a package's set. REFUSES on collision — it does not rename, prefix or
	 *  merge, because all three hide the fact that two packages disagreed about a word. */
	declare(
		by: LabelSystem.PackageName,
		labels: LabelSystem.Label[],
		opts?: { sealed?: boolean },
	): Promise<LabelSystem.Declaration | LabelSystem.Refusal>;

	/** Everything declared, or one package's. */
	declared(by?: LabelSystem.PackageName): Promise<LabelSystem.Label[]>;

	/** Who owns this word. The first call to make before declaring anything, and the one
	 *  a human makes when a label surprises them. */
	owner(name: LabelSystem.LabelName): Promise<LabelSystem.Label | undefined>;

	/** RENAMES, dragging the edges along. Without it, fixing a typo means removing and
	 *  reapplying across N subjects — and that is how every `at` on those edges is lost. */
	rename(
		from: LabelSystem.LabelName,
		to: LabelSystem.LabelName,
	): Promise<{ moved: number } | LabelSystem.Refusal>;

	// ─── APPLYING ────────────────────────────────────────────────────────────

	/** Puts a label on something. Refuses an undeclared name — a typo must be a refusal,
	 *  never a new category invented by accident.
	 *
	 *  IDEMPOTENT BY CONSTRUCTION: the edge id is derived from the pair, so applying
	 *  twice leaves one edge. Without that, the database happily keeps both (measured). */
	apply(
		subject: LabelSystem.Subject,
		name: LabelSystem.LabelName,
	): Promise<LabelSystem.Applied | LabelSystem.Refusal>;

	/** Silent when it was not there: the caller wants the end state, and "was not there"
	 *  already is the end state. */
	remove(subject: LabelSystem.Subject, name: LabelSystem.LabelName): Promise<void>;

	/** What this subject carries. */
	on(subject: LabelSystem.Subject): Promise<LabelSystem.Label[]>;

	/** WHEN each one was applied — the traversal that reads the fields ON THE EDGE.
	 *  Separate from `on()` because it is a different question and a different cost. */
	history(subject: LabelSystem.Subject): Promise<LabelSystem.Applied[]>;

	// ─── FINDING ─────────────────────────────────────────────────────────────

	/** Everything wearing this label, across systems. The query that makes a flat
	 *  namespace worth its collision risk: one word, and every card, folder and process
	 *  that answers to it. `system` narrows it when the caller already knows where. */
	wearing(name: LabelSystem.LabelName, system?: string): Promise<LabelSystem.Subject[]>;

	/** FULL TEXT, across the whole house: the `means` of every declared label and the
	 *  indexed text of every subject, in one result.
	 *
	 *  DATABASE ORDER, NOT RANKING — see the header. `search::score()` measured 0 while
	 *  the row matched, and a ranking nobody measured does not belong in a contract. */
	find(q: LabelSystem.Query, system?: string): Promise<LabelSystem.Hit[]>;

	// ─── LISTENING ───────────────────────────────────────────────────────────

	/** WAKES ON A LABEL. Returns the handle, because a subscription with no off switch
	 *  means the only way to stop is killing the process that also holds the CLI.
	 *
	 *  THE FILTER IS BUILT HERE, NEVER PASSED AS A STRING — see the header. A live
	 *  `.where()` given a string is ignored in silence, and a subscriber that believes
	 *  it filtered gets every event on the table. */
	watch(
		match: LabelSystem.Match,
		on: (e: LabelSystem.Event) => void,
	): Promise<LabelSystem.Watch>;

	/** WHAT SHOWS UP ALONGSIDE this label. Two edges out, which is what a graph gives for
	 *  free and a column cannot give at all.
	 *
	 *  It exists to answer "does this already have a name?" — if `p1` always appears with
	 *  `client`, the two may be one label. That question is the reason a flat namespace
	 *  survives: collisions get caught by `check()`, and near-duplicates by this. */
	near(name: LabelSystem.LabelName): Promise<{ label: LabelSystem.LabelName; together: number }[]>;
}
