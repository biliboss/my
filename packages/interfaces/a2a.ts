//! `a2a` — NOT IMPLEMENTED. The wire between two BOXES, and only that.
//!
//! THE MEMORY DOES NOT CHANGE. `chat.ts` stays the record: every `SendMessage`
//! that lands here ends as one `ChatSystem.Entities.Message` appended by the
//! same `say()` a local agent calls. A transport that owns its own history is a
//! second truth, and reconciling two of them is the work this file exists to
//! avoid — measured 22/08, the study that decided it is
//! `~/src/me/03_resources/notes/2026-08-22T0743Z_a2a-nao-e-barramento-o-estudo.md`.
//!
//! A2A IS NOT A BUS, so nothing here is named like one. Spec v1.0 (Linux
//! Foundation) has eleven methods and ZERO pub/sub: its only broadcast is events
//! of ONE task reaching whoever subscribed to THAT task. There is no room, no
//! `to: "all"`, no member list — those live in `chat.ts` and stay there.
//!
//! WAKING IS NOT DELIVERING. `SubscribeToTask` (SSE) and `herdr panes send` pull
//! an idle agent out of idle; the delivery already happened when the line hit the
//! file. A dead pane misses the nudge and keeps the message, because its cursor
//! still points behind — that is the whole difference from the socket this
//! replaced, where what passed unheard passed for good.
//!
//! ONLY THE SUBSET WE USE IS DECLARED. The spec has eleven methods; four are
//! below. Declaring the other seven would be a contract nothing implements, and
//! the house cannot tell an unimplemented contract from a broken one.
//!
//! Doc rule, split rule and turn format: see `teams.ts`.
//!
//! project:  ~/src/me/01_projects/a2a-transport/
//! design:   ~/src/me/01_projects/a2a-transport/docs/02_system_design_send_to_remote.md
//! depends_on: chat.ts — every landed message becomes one of ITS messages
//! impacts:  chat.ts · src/chat/say.ts (gains `--to <agent>@<box>`)

import type { ChatSystem } from "./chat";
import type { Shared } from "./shared";

/** What this system found rotten. Declared here rather than imported: the runner
 *  reads the shape, so owning a check costs no dependency on a hub. */
export interface Finding {
	path: string;
	says: string;
}

export declare namespace A2ASystem {
	export namespace ValueObjects {
		/** WHICH MACHINE, never which process — `mac`, `vps`. It is the half of an
		 *  address that decides the FIBRE: same box means append straight to the
		 *  store, another box means one HTTP call. A box name that resolves to two
		 *  machines is the bug that makes a message land in the wrong store. */
		export type BoxName = string;

		/** `pm@mac` — the agent, then the box. The agent half is a
		 *  `ChatSystem.ValueObjects.Addressee` verbatim, so a name never changes
		 *  meaning by crossing a wire. Bare `pm`, with no `@`, means THIS box: the
		 *  local case must stay the short one, or every existing call site becomes
		 *  a migration. */
		export type QualifiedAddressee = string;

		/** Where a box answers, absolute and with scheme: `https://127.0.0.1:5399`.
		 *  It is DATA, discovered from the card — never assembled from a box name,
		 *  because assembling it is how a port change becomes silent. */
		export type Endpoint = string;

		/** Server-minted, opaque, and the ONLY handle for everything after the send:
		 *  `GetTask`, `SubscribeToTask`, `CancelTask`. The client never guesses one. */
		export type TaskId = string;

		/** The spec's lifecycle, and it is OPEN: an unknown value is kept verbatim,
		 *  never mapped onto the nearest known one. A2A is somebody else's spec and
		 *  it versions without asking — a closed union drops a new state in silence,
		 *  which reads exactly like a task that never moved. */
		export type TaskState = "submitted" | "working" | "completed" | "failed" | "canceled" | (string & {});

		/** @see shared.ts — declared once, for everybody. */
		export type Instant = Shared.Instant;
	}

	export namespace Entities {
		/** WHO EXISTS AND WHERE THEY ANSWER — the document that replaces "whoever
		 *  bound the socket".
		 *
		 *  IT IS WHY THIS PROJECT STARTS HERE. Today identity is
		 *  `rosterName ?? a.title` (`src/agents/list.ts:89`), so an agent with no
		 *  roster entry is known by its herdr TAB TITLE: measured 22/08, two of the
		 *  six "members" of the `viacorretor` channel were window titles. A title
		 *  changes when somebody renames a tab; a card does not. */
		export interface AgentCard {
			/** The SAME string `my chat say <name>` takes. A card whose name does not
			 *  round-trip through the channel is a second identity for one agent. */
			name: ChatSystem.ValueObjects.Addressee;
			box: ValueObjects.BoxName;
			url: ValueObjects.Endpoint;
			/** Free prose for a human deciding whom to address. Never parsed. */
			description?: string;
			/** The spec's version string, kept verbatim so a mismatch is readable
			 *  rather than inferred. */
			protocolVersion: string;
		}

		/** ONE UNIT OF WORK CROSSING A BOX BOUNDARY, and the reason A2A earns its
		 *  place: `my agents send` is fire-and-forget prose, while a task has an id,
		 *  a state and a cancel.
		 *
		 *  IT IS NOT THE MEMORY. `history` is the server's convenience for replaying
		 *  one task; the record everybody reads is still the channel. When the two
		 *  disagree, the file wins — it is the one that survives the server. */
		export interface Task {
			id: ValueObjects.TaskId;
			state: ValueObjects.TaskState;
			from: ValueObjects.QualifiedAddressee;
			to: ValueObjects.QualifiedAddressee;
			at: ValueObjects.Instant;
			/** The channel the landed line was appended to. Present once the message
			 *  is in the store — its absence is how "accepted" is told from "written". */
			channel?: ChatSystem.ValueObjects.ChannelName;
			/** The `seq` of the appended line. The receipt: with it, anybody can `rg`
			 *  the store and see the same row the sender was promised. */
			seq?: ChatSystem.ValueObjects.Cursor;
		}
	}
}

/** The four methods this house serves, and no more. */
export interface A2ASystemView {
	/** The card THIS box publishes, built from the roster. Served at
	 *  `/.well-known/agent-card.json` — the spec's path, so a stranger finds it
	 *  without being told. */
	card(name: ChatSystem.ValueObjects.Addressee): A2ASystem.Entities.AgentCard;

	/** Deliver one message to another box, and hand back the task.
	 *
	 *  IT RETURNS ONLY AFTER THE LINE IS IN THE REMOTE STORE — `seq` is populated
	 *  or this throws. An accepted-but-unwritten task is the failure mode a
	 *  fire-and-forget send cannot report, and read-back is what `chat.ts` already
	 *  pays for locally; crossing a wire is not a reason to stop paying it. */
	sendMessage(
		to: A2ASystem.ValueObjects.QualifiedAddressee,
		channel: ChatSystem.ValueObjects.ChannelName,
		text: string,
	): Promise<A2ASystem.Entities.Task>;

	/** The task by id, for whoever holds one and wants the current state. */
	getTask(id: A2ASystem.ValueObjects.TaskId): Promise<A2ASystem.Entities.Task>;

	/** LATENCY, NEVER DURABILITY. An SSE stream of one task's states, ending at the
	 *  terminal one. It dies with the connection and loses nothing when it does:
	 *  whoever missed it reads the store, whose cursor still points behind. */
	subscribeToTask(id: A2ASystem.ValueObjects.TaskId): AsyncIterable<A2ASystem.Entities.Task>;
}
