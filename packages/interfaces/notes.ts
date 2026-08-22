//! `notes` — the zettels in `03_resources/notes/` and the day in `00_daily_notes/`,
//! plus the labels both carry. Full field list: `03_resources/notes/note.schema.json`.
//!
//! implemented: packages/notes/
//! cli:         apps/my_cli/src/{notes,daily_notes,labels}/

import type { Shared } from "./shared";

export interface Finding {
	path: string;
	says: string;
}

export declare namespace NotesSystem {
	export namespace ValueObjects {
		/** `2026-08-22T1014Z`. Immutable: links point at it, and it prefixes the filename. */
		export type NoteId = string;
		/** `2026-08-22`. The day's whole address. */
		export type Day = string;
		/** A word a human types. Flat namespace, lives only in a note's `tags:`. */
		export type Label = string;
		export type Kind = "fleeting" | "literature" | "permanent" | "daily" | "meeting" | "decision" | "reference";
		export type Status = "draft" | "active" | "stable" | "archived";
		export type Scope = "personal" | "company";
		export type Instant = Shared.Instant;
	}

	export namespace Entities {
		export interface Link {
			id: ValueObjects.NoteId;
			why: string;
		}

		export interface Note {
			file: string;
			name: string;
			id?: ValueObjects.NoteId;
			title?: string;
			type?: ValueObjects.Kind;
			status?: ValueObjects.Status;
			tags: ValueObjects.Label[];
		}

		/** A label as answered, never as stored: `count` spans both axes, `notes` is
		 *  the zettel half. */
		export interface Counted {
			label: ValueObjects.Label;
			count: number;
			notes: number;
		}
	}
}

export interface NotesSystemView {
	notes(): NotesSystem.Entities.Note[];
	days(): NotesSystem.Entities.Note[];
	labels(): NotesSystem.Entities.Counted[];

	/** Refuses what the schema refuses, plus one thing it cannot express: a note
	 *  with no link and no stated reason for being the first of its subject. */
	create(input: {
		title: string;
		type?: NotesSystem.ValueObjects.Kind;
		status?: NotesSystem.ValueObjects.Status;
		scope?: NotesSystem.ValueObjects.Scope;
		tags?: NotesSystem.ValueObjects.Label[];
		links?: NotesSystem.Entities.Link[];
		first?: string;
		slug?: string;
	}): NotesSystem.Entities.Note;

	/** Appends one `##` section. There is no edit: a past day freezes. */
	append(day: NotesSystem.ValueObjects.Day, subject: string, body: string): NotesSystem.Entities.Note;

	check(): Finding[];
}
