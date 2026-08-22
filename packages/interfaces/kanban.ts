//! `kanban` — the board, and the only place work is operated from.
//!
//! IT REPLACES `sprints` AND `projects`, and the reason is not taste. A SPRINT IS A
//! TIMEBOX, and this house has never timeboxed anything: it has a queue, a claim and
//! a pull. Every measurement built here — cycle time, lead time, throughput, Monte
//! Carlo, WIP, aging — is kanban's. The word `sprint` described a ceremony nobody
//! performs, and it kept the vocabulary arguing with the practice.
//!
//! `tasks` STAYS THE PRIMITIVE. A task exists whether or not a board shows it: the
//! board is a VIEW with limits, and a card is a task's appearance on it. That split
//! is why deleting a board must never delete work.
//!
//! WHAT WAS FOLDED IN, and each one was already a board wearing another word — this
//! is the DESIGN, and the paragraph below CORRECTED IT on 20/08 against the disk:
//! the header used to say `projects → a LABEL. Deleted 20/08`, past tense, as if the
//! cut had already happened. It had not — `01_projects/`, `src/projects/`,
//! `src/sprints/` and `src/inbox/` were all still on disk and still the only thing
//! `my projects check` / `my sprints list` / `my kanban list` read, and this task's
//! own brief required confirming the three keep working. Corrected here rather than
//! silently: a contract describing a cut that never happened is worse than one
//! admitting the cut is still ahead.
//!
//!   `projects`  → a LABEL, eventually. IMPLEMENTED as `Board = the project folder`
//!                 instead — `01_projects/<slug>/` already IS "a place with no
//!                 forced result or deadline" the moment `open()` stops calling
//!                 `projects/new.ts`'s ceremony. `my projects check` still runs and
//!                 still flags a kanban-only board as `missing_context` — that check
//!                 was never taught the new shape, and teaching it is its own task.
//!   `sprints`   → NOT folded in. A card still lives inside a sprint FOLDER because
//!                 `tasks.criar` still requires one open — `kanban.capture()`
//!                 inherits that refusal rather than papering over it. Swimlanes are
//!                 real (`board.swimlanes` + a label group), but they draw from
//!                 board-declared labels, not from the sprint number.
//!   `inbox`     → NOT deleted. `capture`/`close` are IMPLEMENTED as the kanban
//!                 verbs (backed by `src/kanban/model.ts`, composing
//!                 `tasks.criar`/`tasks.done`), and they duplicate
//!                 `src/inbox/capture.ts` today rather than replacing it — cutting
//!                 the inbox over means migrating every caller first
//!                 (`00_inbox/CONTEXT.md`, the VS Code task, `justfile#inbox`), and
//!                 that migration is not this task's scope.
//!   `workflows` → NOT folded in. `Process` below has NO implementation: a board's
//!                 four columns are hardcoded to `tasks`'s own `Place` vocabulary
//!                 (`backlog · tasks · in_progress · done`), not read from
//!                 `02_areas/00_workflows/`. `open({ columns })` with anything else
//!                 REFUSES rather than pretend a column exists with no folder behind
//!                 it — see `src/kanban/model.ts`'s header for the reasoning.
//!
//! THE SECOND BOARD, DECIDED 21/08: `kanban` learns GitHub Projects v2. It is not a
//! sixth column on the folders and it is not a mirror of them — it is a board of its
//! own, LINKED to a local one, and every verb says which of the two it answers about.
//! The folders are where a task's work lives; the project is where a HUMAN looks at it,
//! and neither is derivable from the other. Three facts drove the shape, all measured:
//!
//!   `Human Review`  the flow is `Inbox → Todo → In Progress → Human Review → Done`,
//!                   and the fourth column is the one only Gabriel moves a card OUT of.
//!                   It has no folder and never will — `tasks.Place` is what a directory
//!                   can be named, and a human gate is not a directory. This is the
//!                   whole reason the remote board was worth adopting instead of read.
//!   the budget      Projects v2 is GraphQL-only (REST has no board and no Status
//!                   field) and the 5000 points/hour are SHARED with every agent and the
//!                   dashboard. It hit zero on 21/08 with 30-second polling on three
//!                   boards, so no board read is implicit: `--remote` or a `gh:` address
//!                   is required, and `check()` — which `my check all` runs — stays on
//!                   disk. One board read is 1 point, measured.
//!   the wipe        `updateProjectV2Field` RECREATES the Status options with new ids
//!                   and every item pointing at the old ones loses its column in
//!                   silence. It took two boards on 21/08. The client REFUSES to send
//!                   it, and every read merges a local item→column snapshot so the loss
//!                   is nameable afterwards.
//!
//! NO ID IS CACHED but owner and number. `_today/.gh_projects.jsonl` — the registry this
//! replaces — stored the project id, the field id and the five option ids, and its own
//! header admitted the option ids rot whenever anybody edits the field.
//!
//! implemented: src/kanban/remote.ts (the Projects v2 client) · src/kanban/model.ts (link, `Human Review` policy, remote findings)
//! implemented: src/kanban/  (my kanban · open·capture·close·add·move·tag·label·limit·list·check·metrics·rename)
//! depends_on: src/projects/ · src/sprints/ · src/tasks/
//! checks:      declared HERE, never imported. `check()` returns `Finding[]` and
//!              the runner reads it structurally, so a check costs no dependency.
//!              IMPLEMENTED in `src/kanban/model.ts` (swept by `src/kanban/check.ts`).

import type { Shared } from "./shared";
import type { Metrics as TaskMetrics, Service as TaskService, TaskSystem } from "./tasks";

/** What this system found rotten. Declared here rather than imported: the runner
 *  reads the shape, so owning a check costs no dependency on a hub. */
export interface Finding {
	path: string;
	says: string;
}

/** WHAT `kanban` DECLARES TO `my-labels` — the five words it owns.
 *
 *  DECLARING IS NOT APPLYING, and this file is the reason that distinction exists.
 *  `labels.ts` refuses to be state — *"a thing labelled `done` is not done"* — and a
 *  column IS state. Both hold, because these two verbs are different things:
 *
 *    `declare`  kanban OWNS the word `done` in the flat namespace. Nobody else can
 *               declare a different `done` without a collision finding.
 *    `apply`    hanging `done` on a card. Kanban does NOT do this — a card's column
 *               is where it SITS, and the place is the state.
 *
 *  So the five are registered and never applied. It looks like ceremony until the day
 *  another package declares `ready` meaning "the client approved it" — and then the
 *  collision is a conversation instead of two months of two meanings under one word.
 *
 *  THE FIVE ARE THE FLOW, NOT THE FOLDERS. `tasks.Place` is
 *  `backlog · tasks · in_progress · done` because that is what a directory can be
 *  named; this is what a WALL is called. `ready` and `doing` have no folder and are
 *  the two that matter most to read — the queue between commitment and work, and the
 *  work itself. A board that maps them onto four folders loses `ready`, which is
 *  exactly where a queue tells you it is stuck.
 *
 *  EXCLUSIVE, as `group` means in `my-labels`: a card is in one column. That is the
 *  one structural fact a wall has, and it is why this is a group rather than five
 *  loose words.
 *
 *  NOT SEALED. A board is allowed a sixth column — `review` is one argument away, and
 *  a house that seals its wall shape is telling every future board it is wrong. */
export const LABELS = {
	column: {
		inbox: "chegou e ninguém olhou ainda — a fila de quem pede",
		backlog: "olhado e aceito, esperando a vez",
		ready: "comprometido: vai ser puxado a seguir",
		doing: "alguém está nisto agora",
		done: "acabou, e a prova está no lugar",
	},
} as const;

/** The columns as a type. Closed HERE even though `my-labels` keeps names open: inside
 *  this package the five ARE the wall, and a sixth arriving unannounced is a typo. */
export type ColumnName = keyof typeof LABELS.column;

export declare namespace KanbanSystem {
	export namespace ValueObjects {
		/** `my-teams-v1` — the board, and the folder under `01_projects/`. The name a
		 *  human says out loud. */
		export type BoardName = string;

		/** `backlog` · `ready` · `doing` · `review` · `done` — the columns, and they
		 *  are the FOLDERS a task lives in. Open, because a board that cannot add a
		 *  column has to fake one with a label. */
		export type Column = string;

		/** HOW MANY CARDS A COLUMN MAY HOLD. The number kanban exists for, and the one
		 *  thing a board does that a folder cannot. `0` means no limit — spelled as a
		 *  number so the absence is a value and not a missing field. */
		export type WipLimit = number;

		/** WHAT A WORKFLOW BECAME: the ordered columns a card moves through, plus who
		 *  is answerable for each. Named because two boards can share one, and a
		 *  process copied into a second board drifts within a week. */
		export type ProcessName = string;

		/** `bug`, `p1`, `frontend`, `blocked-by-human` — free-form, 0..N per card.
		 *
		 *  `Label` AND NOT `tag`: GitHub, Linear and Jira all call it a label, and this
		 *  house reuses the word the domain already has instead of inventing a synonym
		 *  everybody has to translate.
		 *
		 *  IT IS THE ONLY EXTENSIBLE AXIS ON A BOARD, on purpose. A column is the
		 *  PROCESS and must stay short; a label is everything else somebody needs to say
		 *  about a card, and it costs nothing to add and nothing to ignore. */
		export type LabelName = string;

		/** WHEN ONE LABEL EXCLUDES ANOTHER — `priority`, `area`, `size`. Linear`s idea,
		 *  and the one thing plain GitHub labels cannot do: within a group a card holds
		 *  at most one, so `p1` and `p3` cannot both be true.
		 *
		 *  A GROUP IS WHAT MAKES A SWIMLANE POSSIBLE: rows on a board are a group`s
		 *  values, and without exclusivity a card would appear in two rows at once. */
		export type LabelGroup = string;

		/** Why this card jumps the queue. A POLICY, not a priority number — a queue
		 *  where everything can be a 1 has no queue.
		 *
		 *  IT WAS `string` HERE AND THE THREE NAMES LIVED IN THIS COMMENT, which made
		 *  this file the second store of a vocabulary `tasks` also has. Now it points
		 *  at the declaration (`tasks.LABELS.service`), and the board SELECTS from what
		 *  was declared instead of describing it again — the debt `labels.ts` names.
		 *
		 *  Open at the end anyway: a board is allowed a class of service this house has
		 *  not met, and a closed union would drop it silently. */
		export type Service = TaskService | (string & {});
	}

	export namespace Entities {
		/** THE WALL. One per place work happens, not one per project — a project is a
		 *  label now, and a board per project is how twelve boards end up with one card
		 *  each and nobody looking at any of them.
		 *
		 *  WHAT WAS LOST WITH `projects`, said plainly: `result` and `deadline`, which
		 *  `my projects check` used to shame. A label cannot demand either. If that
		 *  demand is worth keeping it comes back as a labelled card with a due date —
		 *  never as a second container. */
		export interface Board {
			name: ValueObjects.BoardName;
			columns: ValueObjects.Column[];
			limits: Record<ValueObjects.Column, ValueObjects.WipLimit>;
			/** Every label this board knows. Declared, so `check()` can name a card
			 *  carrying one nobody defined. */
			labels: Label[];
			/** Which label group draws the ROWS. Absent means one row — a board with no
			 *  swimlane, which is the honest default and what most boards should stay. */
			swimlanes?: ValueObjects.LabelGroup;
		}

		/** A LABEL AS THE BOARD DECLARES IT. Cards hold names; this is where a name gets
		 *  its meaning, so a typo is a label nobody defined rather than a new category
		 *  invented by accident. */
		export interface Label {
			name: ValueObjects.LabelName;
			/** Absent means ungrouped: any number of those may sit on one card. */
			group?: ValueObjects.LabelGroup;
			/** For the human eye only. The model never branches on it. */
			color?: string;
			/** What it MEANS, which is the field that decides whether two labels are the
			 *  same thing under two names. */
			description?: string;
		}

		/** THE PROCESS A BOARD RUNS: the columns in order. Prose about a workflow lives
		 *  in its `CONTEXT.md`; this is the part a machine can enforce. */
		export interface Process {
			name: ValueObjects.ProcessName;
			columns: ValueObjects.Column[];
			/** Which column a captured request lands in. `backlog`, always, so far —
			 *  a process that intakes straight into `doing` has no queue. */
			intake: ValueObjects.Column;
		}

		/** A TASK'S APPEARANCE ON A BOARD. The task is the truth (`tasks.ts`); this is
		 *  where it sits, what it costs to hold, and which policy moved it. */
		export interface Move {
			column: ValueObjects.Column;
			entered_at: Shared.Instant;
			left_at?: Shared.Instant;
		}

		export interface Card {
			task: TaskSystem.ValueObjects.TaskName;
			board: ValueObjects.BoardName;
			column: ValueObjects.Column;
			service: ValueObjects.Service;
			/** 0..N, and at most one per group. The row a card sits in is the value it
			 *  holds in the board`s `swimlanes` group. */
			labels: ValueObjects.LabelName[];
			/** Immutable column visits. Current folders alone cannot answer flow or rework. */
			moves: Move[];
		}
	}
}

/** Answers about the board. Nothing here moves a card. */
export interface View {
	/** No card in a column past its limit, no card whose task no longer exists, no
	 *  card carrying a label the board never declared, and no card holding two labels
	 *  of one group. */
	check(): Finding[];

	boards(): KanbanSystem.Entities.Board[];
	board(name: KanbanSystem.ValueObjects.BoardName): KanbanSystem.Entities.Board | undefined;

	/** The board as it stands. `labels` narrows by ALL of them, not any — a filter
	 *  that widens as you add terms is a filter nobody trusts twice. */
	cards(
		board: KanbanSystem.ValueObjects.BoardName,
		where?: {
			column?: KanbanSystem.ValueObjects.Column;
			labels?: KanbanSystem.ValueObjects.LabelName[];
		},
	): KanbanSystem.Entities.Card[];

	/** The rows, as the board`s swimlane group defines them, each with its cards. One
	 *  row named `""` holds the cards carrying no value in that group — hiding them is
	 *  how work disappears from a board that looks complete. */
	swimlanes(
		board: KanbanSystem.ValueObjects.BoardName,
	): Record<string, KanbanSystem.Entities.Card[]>;

	/** Cards per column against the limit. The one number a board exists to enforce,
	 *  and the one that explains a bad cycle time before any other. */
	wip(board: KanbanSystem.ValueObjects.BoardName): Record<
		KanbanSystem.ValueObjects.Column,
		{ cards: number; limit: KanbanSystem.ValueObjects.WipLimit }
	>;

	/** Which columns are OVER their limit right now. Pulled out of `wip` because it is
	 *  what a policy acts on, and a caller comparing two numbers by hand forgets. */
	blocked(board: KanbanSystem.ValueObjects.BoardName): KanbanSystem.ValueObjects.Column[];
}

/** HOW THE BOARD FLOWS. Named `Metrics` and not `KanbanMetrics`: the file already
 *  says kanban, and a prefix that repeats its own folder is a word the reader has to
 *  skip in every single line. Read from the cards` own column history — no ledger, no
 *  second record. Every one of these is a kanban metric and none is a team`s: a team
 *  that changes hands mid-card does not change how long the card took. */
export interface Metrics {
	/** The inside-of-task source used only where board movement is insufficient. */
	readonly taskMetrics: TaskMetrics;

	/** Cycle (first active column → done) and lead (board entry → done) per label, so "how long does a
	 *  `bug` take" is answerable without a second board. THE PAIR IS THE POINT: the gap
	 *  between them is the queue, and reporting only cycle looks excellent while
	 *  requests rot — 13 of 20 sat 3 days (20/08). */
	flow(by?: KanbanSystem.ValueObjects.LabelGroup): {
		label: string;
		cycle_p50: number;
		cycle_p85: number;
		lead_p50: number;
		lead_p85: number;
		sample: number;
	}[];

	/** Cards finished per day, oldest first. The raw series a forecast samples from,
	 *  exposed because a forecast whose input nobody can see is trusted either too much
	 *  or not at all. */
	throughput(days: number): number[];

	/** Monte Carlo over `throughput`: how many days for `cards`, at p50/p85/p95. Nobody
	 *  estimates, and the variability comes out in the answer instead of being
	 *  apologised for afterwards. */
	forecast(cards: number): { days_p50: number; days_p85: number; days_p95: number };

	/** Does `cards` land by `by`, and with what probability. `forecast` read the useful
	 *  way round — nobody asks how many days, they ask whether it lands on Friday. */
	goal(cards: number, by: Shared.Instant): { probability: number; fits: number };

	/** Open cards, oldest first. Board age and current-column dwell come only from movement history. */
	aging(): { task: string; age_hours: number; column_hours: number }[];

	/** Touched time divided by cycle time. Missing task facts make the result explicitly unavailable. */
	efficiency(
		by?: KanbanSystem.ValueObjects.LabelGroup,
	): TaskSystem.Metrics.Measure<{ label: string; ratio: number; sample: number }[]>;

	/** How often a card comes BACK to an earlier column. The only quality signal a
	 *  board can produce without a human grading anything. */
	rework(): { label: string; rate: number }[];
}

export interface Kanban extends View {
	open(spec: {
		name: KanbanSystem.ValueObjects.BoardName;
		columns?: KanbanSystem.ValueObjects.Column[];
	}): KanbanSystem.Entities.Board;

	/** The name changes and EVERYTHING pointing at it changes too — the reason this is
	 *  a verb and not a `mv`. */
	rename(
		from: KanbanSystem.ValueObjects.BoardName,
		to: KanbanSystem.ValueObjects.BoardName,
	): KanbanSystem.Entities.Board;

	/** TAKE A REQUEST IN — what `inbox capture` was. It lands in the process`s intake
	 *  column and wakes NOBODY: "captured" and "being worked on" are different facts,
	 *  and a board that spells them the same way is the one that let 13 of 20 requests
	 *  sit 3 days (20/08).
	 *
	 *  The body is kept VERBATIM on the card`s task — the only thing a result can be
	 *  judged against later. */
	capture(
		board: KanbanSystem.ValueObjects.BoardName,
		title: TaskSystem.ValueObjects.Title,
		body: string,
	): KanbanSystem.Entities.Card;

	/** END A CARD WITH AN ANSWER — what `inbox process` and `inbox drop` were, and
	 *  they are one verb because both end the same way: the card leaves the board and
	 *  the answer travels with the work.
	 *
	 *  A REFUSAL REQUIRES ITS REASON, and that asymmetry stays: what a card became is
	 *  reconstructable from the commits, why it became nothing is not. */
	close(
		task: TaskSystem.ValueObjects.TaskName,
		answer: { became: string } | { dropped: string },
	): KanbanSystem.Entities.Card;

	/** Put a task on a board. A task with no card is work nobody is watching, which is
	 *  allowed and worth being able to see. */
	add(
		task: TaskSystem.ValueObjects.TaskName,
		board: KanbanSystem.ValueObjects.BoardName,
		labels?: KanbanSystem.ValueObjects.LabelName[],
	): KanbanSystem.Entities.Card;

	/** REFUSED WHEN THE TARGET COLUMN IS FULL, and that refusal is the whole product:
	 *  a limit that can be exceeded by moving one more card is a suggestion. Override
	 *  is a `Service`, never a flag — an expedite is a decision with a name. */
	move(
		task: TaskSystem.ValueObjects.TaskName,
		to: KanbanSystem.ValueObjects.Column,
	): KanbanSystem.Entities.Card;

	/** Declare a label on a board, or redefine one. */
	label(
		board: KanbanSystem.ValueObjects.BoardName,
		label: KanbanSystem.Entities.Label,
	): KanbanSystem.Entities.Board;

	/** Put labels on a card, or take them off. REFUSED when two of them share a group:
	 *  `p1` and `p3` on one card is a priority that means nothing, and refusing at the
	 *  write is what keeps every reader from having to pick one. */
	tag(
		task: TaskSystem.ValueObjects.TaskName,
		labels: KanbanSystem.ValueObjects.LabelName[],
	): KanbanSystem.Entities.Card;

	/** Set or lift a column's limit. `0` lifts it, and lifting a limit to unblock a
	 *  board is the most common way a board stops meaning anything. */
	limit(
		board: KanbanSystem.ValueObjects.BoardName,
		column: KanbanSystem.ValueObjects.Column,
		limit: KanbanSystem.ValueObjects.WipLimit,
	): KanbanSystem.Entities.Board;
}
