//! `chat` — IMPLEMENTED 20/08 (@src/chat/). Who said what to whom, and where it
//! stayed written.
//!
//! IT KILLED THE SECOND BUS. This house had two: `my agents send/read` wrote a
//! line addressed by agent name (`src/agents/bus.ts`, now deleted), and
//! `biliboss channels/messages` keeps a named channel with a body on the wall.
//! `src/chat/` is the one system now; `my agents send|read|chat` survive only as
//! thin aliases (@src/agents/send.ts) because the fleet calls them today and the
//! call site must not break mid-cutover.
//!
//! ADDRESSING IS A VALUE, NOT AN IMPORT. A recipient is a name — the same string
//! `my agents send <name>` takes — so this module never imports the agent system.
//! Chat works with an agent that does not exist yet and with a human who is not an
//! agent at all.
//!
//! THE MIGRATED BUS HAS NO CHANNEL: the old 4-column TSV (`at·from·to·text`)
//! never had one, so every message it carried over lives at `channel: ""` —
//! empty, not an invented name like `"fleet"`. `src/chat/store.ts` explains the
//! full mapping and what could not be recovered (`thread`, `answers`).
//!
//! Doc rule, split rule and turn format: see `teams.ts`.
//!
//! implemented: src/chat/store.ts · src/chat/index.ts · src/chat/say.ts ·
//!              src/chat/read.ts · src/chat/listen.ts · src/chat/check.ts — ten verbs
//!              became five on 21/08, and the six that went were never features: `ask`
//!              was a flag on `say`, `inbox`/`unanswered`/`seen` were three readings of
//!              one file, `channels`/`open` were the bare verb with `--members`.
//! absorbed:   src/agents/bus.ts (deleted) · src/agents/send.ts · src/agents/read.ts ·
//!             src/agents/chat.ts — the last three stayed as thin aliases, not
//!             dependencies: `my agents send|read|chat` is cited across the house
//!             and had to keep working after the cutover.
//! checks:      declared HERE, never imported. `check()` returns `Finding[]` and
//!              the runner reads it structurally, so a check costs no dependency.
//! impacts:    teams.ts · src/agents/send.ts · src/agents/read.ts · src/agents/chat.ts

import type { Shared } from "./shared";

/** What this system found rotten. Declared here rather than imported: the runner
 *  reads the shape, so owning a check costs no dependency on a hub. */
export interface Finding {
	path: string;
	says: string;
}

export declare namespace ChatSystem {
	export namespace ValueObjects {
		/** `plantao-coding`, `022_my_teams` — a room. Named after the thing being
		 *  discussed, so the channel outlives whoever was in it. */
		export type ChannelName = string;

		/** Whoever can be addressed: an agent by name, `"human"` for the person at the
		 *  wheel, `"all"` for the room.
		 *
		 *  `"human"` IS NOT AN AGENT and must never be routed like one — a message to
		 *  `"all"` that wakes four agents and pages a person is the mistake this union
		 *  exists to make visible. */
		export type Addressee = string | "all" | "human";

		/** What a message is ABOUT: an inbox item, a task, a work path. Absent means the
		 *  room itself — coordination that is not about one thing. */
		export type Thread = string;

		/** @see shared.ts — declared once, for everybody. */
		export type Instant = Shared.Instant;

		/** HOW LONG SILENCE HAS TO LAST before a listener fires, in milliseconds.
		 *
		 *  N AGENTS APPENDING AT ONCE IS ONE EVENT, NOT N. Four members answering the
		 *  same question inside a second would wake a listener four times, and each wake
		 *  is a model turn with a bill attached — the batching is not smoothing, it is
		 *  the difference between one reply and four.
		 *
		 *  TRAILING EDGE, never leading: it fires after the quiet, because firing on the
		 *  first message and batching the rest delivers a reply written before the other
		 *  three arrived.
		 *
		 *  IT IS A CEILING ON RESPONSIVENESS, so it is a value and not a constant: too
		 *  long and the channel feels dead to a human typing in it, too short and a
		 *  four-agent burst is four wake-ups again. Around two seconds is the guess this
		 *  house starts with, and `max_wait` is what stops a channel that never goes
		 *  quiet from never delivering. */
		export type DebounceTime = number;

		/** Monotonic per channel, so "since I last read" is answerable without a clock
		 *  everybody agrees on. Two machines disagreeing about the time is what makes a
		 *  timestamp cursor lose messages. */
		export type Cursor = number;
	}

	export namespace Entities {
		/** One thing said. Append-only: a message is never edited, because a channel
		 *  where the past changes cannot be used to settle an argument.
		 *
		 *  THERE IS NO `type` FIELD, and adding one is a regression. The bus this
		 *  replaced carried five (`message`, `ack`, `join`, `protocol`, `review`) and
		 *  four of them were state dressed as prose: an ack IS a cursor, a join IS
		 *  `Channel.members`, a protocol IS the channel's body, a review IS a message
		 *  with `thread` and `answers`. Measured 21/08 in the fleet's channels: 29 ack
		 *  lines and 13 join lines, none of which any reader ever folded. */
		export interface Message {
			seq: ValueObjects.Cursor;
			channel: ValueObjects.ChannelName;
			/** REQUIRED, never inferred from context: a room with four agents and a human
			 *  needs to say who asked for the rewrite. */
			from: ValueObjects.Addressee;
			to: ValueObjects.Addressee;
			at: ValueObjects.Instant;
			text: string;
			thread?: ValueObjects.Thread;
			/** Present when this answers a specific message. What makes a question and its
			 *  answer readable as a pair a week later. */
			answers?: ValueObjects.Cursor;
		}

		export interface Channel {
			name: ValueObjects.ChannelName;
			/** Who is expected to read it. Not enforcement — anybody can post — but the
			 *  list `to: "all"` means, and the list a silent channel is measured against.
			 *
			 *  IT ONLY GROWS. A join UNIONS: the names handed in are added to whoever is
			 *  already there, and nothing takes a name out. No writer knows the whole
			 *  list — a team member joining declares ONE name, its own, and a replace
			 *  would evict the other three. Same rule as `seen()` and for the same
			 *  reason: every writer knows only its own half. Leaving means editing the
			 *  registry by hand, and there is no verb for it, on purpose. */
			members: ValueObjects.Addressee[];
			created_at: ValueObjects.Instant;
		}
	}
}

/** Answers about a channel. Nothing here writes. */
export interface View {
	/** No message without `from`, and no `answers` pointing at a `seq` that does not exist. */
	check(): Finding[];

	channels(): ChatSystem.Entities.Channel[];

	/** Oldest first, optionally one thread. Survives every workspace being closed,
	 *  which is the reason a channel beats a pane. */
	read(
		channel: ChatSystem.ValueObjects.ChannelName,
		thread?: ChatSystem.ValueObjects.Thread,
	): ChatSystem.Entities.Message[];

	/** Addressed to me and after my cursor. What a woken agent reads instead of
	 *  re-reading a room it shares with three others. */
	inbox(
		channel: ChatSystem.ValueObjects.ChannelName,
		me: ChatSystem.ValueObjects.Addressee,
		since?: ChatSystem.ValueObjects.Cursor,
	): ChatSystem.Entities.Message[];

	/** Messages whose `answers` nobody wrote. The room's open questions, which is the
	 *  only reason anybody scrolls a channel by hand today. */
	unanswered(
		channel: ChatSystem.ValueObjects.ChannelName,
	): ChatSystem.Entities.Message[];
}

/** WHAT A LISTENER GETS: everything that landed during the burst, in order, with the
 *  range it covers — so a handler that crashes can be replayed from `from` without
 *  re-reading the channel. */
export interface Batch {
	channel: ChatSystem.ValueObjects.ChannelName;
	from: ChatSystem.ValueObjects.Cursor;
	to: ChatSystem.ValueObjects.Cursor;
	messages: ChatSystem.Entities.Message[];
}

export interface Chat extends View {
	/** Wake me when the channel goes quiet after new traffic addressed to me.
	 *
	 *  The cursor moves only when the handler returns — a listener that advanced on
	 *  delivery loses the batch it crashed on, and the message nobody answered is
	 *  exactly the one worth keeping. */
	listen(
		channel: ChatSystem.ValueObjects.ChannelName,
		me: ChatSystem.ValueObjects.Addressee,
		on: (batch: Batch) => void,
		opts?: {
			/** Silence required before firing. Omitted, the house default. */
			debounce?: ChatSystem.ValueObjects.DebounceTime;
			/** Deliver anyway after this long, however busy the channel is. Without it a
			 *  room where somebody types every second never fires at all. */
			max_wait?: ChatSystem.ValueObjects.DebounceTime;
		},
	): { stop(): void };

	/** Find-or-create the channel, and JOIN `members` to it — twice with one name
	 *  each leaves both, and a name already there costs nothing. The membership is
	 *  the SUBSCRIPTION: `_today` kept the same mapping in a `crew:` block of its
	 *  own YAML with a regex to read it, which is this field in a second place. */
	open(
		name: ChatSystem.ValueObjects.ChannelName,
		members?: ChatSystem.ValueObjects.Addressee[],
	): ChatSystem.Entities.Channel;

	/** Write one line, and hand back the line the FILE holds.
	 *
	 *  A WRITE IS NOT DONE UNTIL IT READS BACK. The row is re-read from disk after
	 *  the append and compared to what was written; a row that does not come back
	 *  intact raises, and never returns a Message the channel does not carry.
	 *  Measured 21/08: 4 of 607 lines in the fleet's channels were torn, and every
	 *  one was found hours later by somebody who was not its writer. */
	say(
		channel: ChatSystem.ValueObjects.ChannelName,
		to: ChatSystem.ValueObjects.Addressee,
		text: string,
		thread?: ChatSystem.ValueObjects.Thread,
	): ChatSystem.Entities.Message;

	/** Say it and wait. A question and a statement must not read alike in a channel —
	 *  the reply carries `answers`, and `unanswered` is what that buys. */
	ask(
		channel: ChatSystem.ValueObjects.ChannelName,
		to: ChatSystem.ValueObjects.Addressee,
		question: string,
	): Promise<ChatSystem.Entities.Message>;

	/** Move my cursor. Explicit, never a side effect of `read`: an agent that crashes
	 *  mid-work must find the same messages when it comes back.
	 *
	 *  IT ONLY GOES FORWARD: `upto` folds with `max` over what is stored, never
	 *  overwrites it. A batch is addressed before its handler runs and acknowledged
	 *  after, so two overlapping wakes end with the SLOW one writing last, carrying
	 *  the OLDER `upto` — an absolute write there rewinds the cursor and re-delivers
	 *  work already done. Going back on purpose means deleting the cursor; there is
	 *  no verb for it, on purpose. */
	seen(
		channel: ChatSystem.ValueObjects.ChannelName,
		me: ChatSystem.ValueObjects.Addressee,
		upto: ChatSystem.ValueObjects.Cursor,
	): void;
}
