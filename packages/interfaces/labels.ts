//! `labels` — DRAFT. One flat namespace of labels, and every one of them has an owner.
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
//! ── WHAT THIS OWES, AND IS NOT DONE UNTIL IT PAYS ────────────────────────────
//!
//! `kanban.Board.labels` is a second store of the same thing. It becomes a SELECTION of
//! declared labels — the board says which it uses, not what they mean — and this file is
//! a fifth spelling until that edit lands. `company.Role` stays a closed TS union AND
//! registers here: the union is the compile-time claim, the declaration is what makes
//! `check()` able to see the collision at all.
//!
//! external:    nothing
//! implemented: nothing
//! planned:     packages/my-labels/
//! depends_on:  packages/interfaces/shared.ts
//! absorbs:     kanban.Entities.Label · company.Role · resources.LENSES —
//!              a selection each, never a second store
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
	 *  eventually report that a folder is blocked. */
	export interface Subject {
		system: string;
		id: string;
	}

	export interface Label {
		name: LabelName;
		by: PackageName;
		/** REQUIRED, unlike `kanban`'s optional description. It is the field the second
		 *  collision check reads: two names with one meaning is one concept under two
		 *  words, and no amount of uniqueness on `name` catches it. */
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

	export interface Applied {
		subject: Subject;
		label: LabelName;
		at: Shared.Instant;
	}
}

/** `my labels <verb>`. Declaring is rare and loud; applying is common and quiet. */
export interface Labels {
	/** THE ONE THAT EARNS THE FILE: every name owned once, no two names meaning the same
	 *  thing, no sealed set grown a member, and no subject carrying a name nobody
	 *  declared. */
	check(): Finding[];

	/** Registers a package's set. REFUSES on collision — it does not rename, prefix or
	 *  merge, because all three hide the fact that two packages disagreed about a word. */
	declare(
		by: LabelSystem.PackageName,
		labels: LabelSystem.Label[],
		opts?: { sealed?: boolean },
	): LabelSystem.Declaration | LabelSystem.Refusal;

	/** Everything declared, or one package's. */
	declared(by?: LabelSystem.PackageName): LabelSystem.Label[];

	/** Who owns this word. The first call to make before declaring anything, and the one
	 *  a human makes when a label surprises them. */
	owner(name: LabelSystem.LabelName): LabelSystem.Label | undefined;

	/** Puts a label on something. Refuses an undeclared name — a typo must be a refusal,
	 *  never a new category invented by accident. */
	apply(
		subject: LabelSystem.Subject,
		name: LabelSystem.LabelName,
	): LabelSystem.Applied | LabelSystem.Refusal;

	remove(subject: LabelSystem.Subject, name: LabelSystem.LabelName): void;

	/** What this subject carries. */
	on(subject: LabelSystem.Subject): LabelSystem.Label[];

	/** Everything wearing this label, across systems. The query that makes a flat
	 *  namespace worth its collision risk: one word, and every card, folder and process
	 *  that answers to it. */
	wearing(name: LabelSystem.LabelName): LabelSystem.Subject[];
}
