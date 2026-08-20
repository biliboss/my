//! `tasks` — THE PRIMITIVE: a unit of work that is born, started in a worktree, and
//! closed by proving something. It exists with or without a board.
//!
//! THE PLACE IS THE STATE — for ONE of the two axes. `backlog/`, `tasks/`,
//! `in_progress/`, `done/` is where the task sits in the QUEUE, and a folder cannot
//! disagree with itself. But `blocked` and `dropped` have no folder: they are how the
//! work ENDED, and the queue has nowhere to put them. Two axes, two types below.
//!
//! implemented: src/tasks/model.ts · src/tasks/new.ts · src/tasks/start.ts · src/tasks/done.ts · src/tasks/claim.ts · src/tasks/list.ts · src/tasks/monitor.ts · src/tasks/check.ts
//! depends_on:  src/tasks/
//! checks:      declared HERE, never imported. `check()` returns `Finding[]` and
//!              the runner reads it structurally, so a check costs no dependency.
//!              IMPLEMENTED in `src/tasks/check.ts`.
//! imports:    nothing of the domain. It is the bottom layer; `kanban.ts` points HERE.


import type { Shared } from "./shared";

/** What this system found rotten. Declared here rather than imported: the runner
 *  reads the shape, so owning a check costs no dependency on a hub. */
export interface Finding {
	path: string;
	says: string;
}

export declare namespace TaskSystem {
	export namespace ValueObjects {
		/** `002_camera_api_moves_view` — three digits then `underscore_case`, and it
		 *  never changes. Counts UP: the top of the list is what has waited longest. */
		export type TaskName = string;
		export type Title = Shared.ValueObjects.GrammarStyle.Words<5> &
			Shared.ValueObjects.GrammarStyle.SingleParagraph;

		/** `01_projects/<slug>/` — the folder that contains everything below. */
		export type ProjectSlug = string;
		/** `999_<slug>` — the sprint folder that contains the task. */
		export type SprintName = string;

		/** @see shared.ts — declared once, for everybody. */
		export type Instant = Shared.Instant;

		/** AXIS ONE — WHERE IT SITS IN THE QUEUE, carried by the folder, and the only
		 *  one `ls` answers with no parser. `in_progress` means somebody pulled it and
		 *  the badge inside says who. */
		export type Place = "backlog" | "tasks" | "in_progress" | "done";

		/** AXIS TWO — HOW IT ENDED, carried by `state:` in `output.md`.
		 *
		 *  `blocked` and `dropped` are why this cannot be one type with `Place`: neither
		 *  has a folder, so collapsing the two axes DELETES them — which is exactly what
		 *  this file did until 20/08, declaring `backlog | in_progress | done` and
		 *  leaving `my tasks done --blocked` writing a value the contract had no name
		 *  for. A task closed as `blocked` stays parked in `in_progress/`, and the list
		 *  called it `doing`. */
		export type State = "draft" | "doing" | "done" | "blocked" | "dropped";

		/** WHEN THE TWO DISAGREE, THE FOLDER WINS — for the axis the folder owns.
		 *  A worker that died leaves the folder parked where `ls` shows it, while a
		 *  `state:` nobody rewrote lies in silence. `src/runs.ts` reads it that way, and
		 *  `tasks check` is where the disagreement becomes a Finding instead of a guess. */
		export type PlaceWinsOverStaleState = never;

		/** WHO IS ON IT, written by whoever took it — `.doing/claim.json`. The house's
		 *  existing claim, and the ancestor of `teams.ts`'s. */
		export interface Claim {
			by: string;
			at: Instant;
			worktree?: string;
		}
	}

	export namespace Metrics {
		/** An immutable fact absent from today`s task folders. */
		export type MissingFact =
			| "work_started"
			| "work_stopped"
			| "claim_taken"
			| "claim_released"
			| "proof_attempted"
			| "worktree_opened"
			| "worktree_closed"
			| "first_commit";

		/** WHY `measure()` HAS NO IMPLEMENTATION, AND WHAT WOULD BUY ONE.
		 *
		 *  `output.md` keeps the LAST value of every field and nothing else: `start`
		 *  overwrites `started_at`, `done` overwrites `ended_at` and `commit_end`, and
		 *  `claim --release` erases the badge with the folder move. A task started
		 *  twice reports one start. Every fact above is a TRANSITION, and this house
		 *  records only positions.
		 *
		 *  What would have to exist: each transition APPENDED — never overwritten — in
		 *  the task's own folder, one line per event with `at` and what happened, so
		 *  `escreverFm` stops being the only writer of progress. Nothing else is
		 *  missing: the shas already delimit the diff, the badge already names the
		 *  executor, the proof already has an exit code that nobody keeps.
		 *
		 *  And it must live INSIDE the task folder. `_events/` died on 17/08 for being a
		 *  receipt nobody read and nothing verified — 151 folders, 3.3 MB, and the ten
		 *  tasks that owed a receipt each wrote zero. A log the task carries dies with
		 *  the task and is read by whoever opens it; a log in a parallel tree is the
		 *  same bet that already lost. Until somebody wants a number badly enough to
		 *  pay for that line, this namespace stays a description of the hole. */
		export type Measure<T> =
			| { kind: "measured"; value: T }
			| { kind: "unavailable"; missing: MissingFact[] };

		export interface TaskMeasure {
			touched: Measure<Shared.Millis>;
			claims: Measure<{ taken: number; released: number }>;
			proofs: Measure<{ attempts: number; failed: number; passed: number }>;
			worktrees: Measure<{ opened: number; restarted: number }>;
			first_claim_to_first_commit: Measure<Shared.Millis>;
		}
	}

	export namespace Entities {
		/** THE TASK AS IT IS ON DISK — `src/tasks/model.ts`'s `Task`, named here with the
		 *  names that file already uses. Two files, two tenses, and it is what decides
		 *  where each field lives: `pedido` is `CONTEXT.md` (what to do, the proof, the
		 *  budget) and does not change because work happened; `saida` is `output.md`
		 *  (the state, the two shas, the worktree) and is the only one `start`/`done`
		 *  rewrite. */
		export interface Task {
			/** `001_x` — the folder name. The NNN is an ADDRESS: it is never reused and
			 *  never renumbered, because a citation to it must keep resolving. */
			name: ValueObjects.TaskName;
			/** The absolute folder. THE TASK KNOWS ITS OWN PATH — see below. */
			dir: string;

			/** `CONTEXT.md`'s front matter: `proof`, `duration`, `repo`, `worktree`. */
			pedido: Record<string, unknown>;
			/** `output.md`'s front matter: `state`, `owner`, the two shas, the branch. */
			saida: Record<string, unknown>;
			titulo: string;

			claim?: ValueObjects.Claim;
			/** Minutes budgeted. A planning hint, never touched time. */
			minutes?: number;
		}

		/** THE PATH IS THE TASK'S OWN DATUM, AND THE CONTRACT USED TO DENY IT.
		 *
		 *  This file said "a task does not know where it is shown", and inferred from it
		 *  that a task knows no project and no sprint. The inference was wrong, and the
		 *  whole implementation contradicted it: every verb takes `-P <project>`, tasks
		 *  are born in `sprints/NNN/tasks/`, and the worktree name carries the sprint
		 *  number precisely because the NNN restarts in each one.
		 *
		 *  The house rule that produced the denial is still true, and it is NARROWER
		 *  than what was written: `tasks` must not import a type from `kanban.ts`. A
		 *  BOARD is a place a task is SHOWN, chosen by somebody else, and pointing back
		 *  at it would close the cycle and leave no bottom layer to build first.
		 *
		 *  A sprint is not that. Containment IS the pointer: no `sprint:` field exists,
		 *  because a field would be the second source and it is always the one that
		 *  ages. Project and sprint are READ FROM `dir` — that is what `projetoDe`,
		 *  `sprintDe` and `placeDe` are — so the task carries no board, no foreign type,
		 *  and still answers where it lives. */
		export interface Where {
			project: ValueObjects.ProjectSlug;
			/** Absent in the pre-sprint shape (`tasks/NNN_*`), still read while it exists. */
			sprint?: ValueObjects.SprintName;
			place: ValueObjects.Place;
			state: ValueObjects.State;
		}
	}
}

export interface Metrics {
	/** Current disk records state and the current claim, not immutable history; unavailable names every missing fact. */
	measure(task: TaskSystem.ValueObjects.TaskName): TaskSystem.Metrics.TaskMeasure;
}

/** EVERY VERB TAKES WHAT THE CLI HAD TO RESOLVE ANYWAY. The old signatures here
 *  (`new(title)`, `start(name)`) were the CLI's arguments with the project filed
 *  off — and the project is not optional, it is just resolved earlier, from `-P`,
 *  from the cwd, or from the last one used. The verbs below are the functions
 *  `src/tasks/*.ts` export; `main(argv): number` stays what it always was, the
 *  shell that parses argv, prints, and turns a refusal into an exit code.
 *
 *  REFUSAL IS A VALUE, not an exception: `{ erro }` is how `acharTask` has always
 *  answered, and a verb that throws makes every caller decide whether to catch. */
export interface Tasks {
	/** No task in `in_progress/` without a claim, no claim whose worktree is gone, and
	 *  no `done/` task whose proof never ran. Omit the project to check every one —
	 *  a crooked queue elsewhere is still crooked. */
	check(project?: TaskSystem.ValueObjects.ProjectSlug): Finding[];

	/** No board argument: putting it on one is `kanban.add`, and a verb that did both
	 *  would make work that cannot exist unshown. The SPRINT is not that argument —
	 *  it is the folder the task is born in, and omitted it means the current one.
	 *
	 *  Named `criar` in the implementation, because `new` is a reserved word. */
	criar(
		project: TaskSystem.ValueObjects.ProjectSlug,
		title: TaskSystem.ValueObjects.Title,
		options?: { sprint?: TaskSystem.ValueObjects.SprintName; folder?: string; duration?: string; proof?: string; priority?: string; backlog?: boolean },
	): { task: TaskSystem.Entities.Task; sprint: TaskSystem.ValueObjects.SprintName; n: number } | { erro: string };

	/** Cuts the worktree and stamps the start. One worktree per task is what keeps two
	 *  agents out of one index. Takes the TASK and not its name: the caller already
	 *  resolved it, and resolving twice is how two verbs disagree about which `001` it was. */
	start(
		task: TaskSystem.Entities.Task,
		options?: { owner?: string; here?: boolean },
	): { task: TaskSystem.Entities.Task; worktree: string; branch: string; subject: string; commitStart: string } | { erro: string };

	/** Runs the proof, commits the worktree, moves the folder to `done/`. Refuses when
	 *  the proof fails — a task that closes without evidence is a lie with a date.
	 *  `blocked`/`dropped` skip the proof: proving a stuck task measures nothing. */
	done(
		task: TaskSystem.Entities.Task,
		options?: { blocked?: string; dropped?: string },
	): { task: TaskSystem.Entities.Task; state: TaskSystem.ValueObjects.State; why?: string; arquivada?: string } | { erro: string };

	/** Locks, PULLS the folder into `in_progress/`, and writes the badge. Returns the
	 *  NEW folder: the task moved, and the caller is holding the old path. */
	claim(
		task: TaskSystem.Entities.Task,
		extra?: Record<string, string>,
	): { cracha: TaskSystem.ValueObjects.Claim; dir: string } | { erro: string };

	/** Drops the lock and RETURNS the folder to the queue. Dropping without moving
	 *  leaves a folder saying "running" with nobody inside. */
	release(task: TaskSystem.Entities.Task, force?: boolean): { dir: string } | { erro: string };

	/** Every task of a project, or the ones with one OUTCOME. Filtering by board is
	 *  `kanban.cards` — that question is the board`s, and this one does not know the
	 *  answer. Each row carries both axes, because neither answers alone. */
	list(
		project: TaskSystem.ValueObjects.ProjectSlug,
		state?: TaskSystem.ValueObjects.State,
	): (TaskSystem.Entities.Where & { nnn: string; title: string; duration?: number; proof?: string; dir?: string })[];

	/** One line per state change, streamed — and a change on EITHER axis counts:
	 *  `backlog/draft` → `tasks/draft` is a promotion a worker must see. A poll that
	 *  prints the same queue twice is a poll nobody watches. */
	monitor(
		project: TaskSystem.ValueObjects.ProjectSlug,
		on: (event: TaskSystem.Entities.Where & { event: "open" | "appeared" | "state" | "gone"; from?: string }) => void,
		options?: { sprints?: readonly TaskSystem.ValueObjects.SprintName[]; interval?: number; changesOnly?: boolean },
	): { stop(): void };
}
