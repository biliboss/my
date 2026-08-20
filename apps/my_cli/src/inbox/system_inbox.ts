//! `system_inbox` — the PUBLIC VOCABULARY of the inbox. Types only, no emitter, no
//! implementation. It does not contain the domain; it names it.
//!
//! ONE `system_<verb>.ts` PER VERB FOLDER, and it lives beside the code it names —
//! never in a project. A project is scaffolding; `src/` is what survives.
//!
//! THIS IS THE INTERFACE, AND IT COMES FIRST. It says what the inbox IS and what can
//! be asked of it; HOW that is answered is the implementation's business, and it may
//! be answered in more than one way — a markdown page today, something else the day
//! after, without a line of this file changing. So the model is allowed to be ahead
//! of the code.
//!
//! What is NOT allowed is being ahead in silence. Anything named here that nothing
//! implements yet carries `NOT IMPLEMENTED` in its own doc, with where the decision
//! lives. A reader must never have to run the code to find out which half is real.
//!
//! The house has no event log anymore (`_events/` died 17/08: 151 folders, 3.3 MB
//! of receipts, zero readings — the COMMIT is the report). What was missing was
//! never the storage, it was the vocabulary: `inbox capture` and the ramp that
//! reads the item name the same moments in different ways, and a reader has to diff
//! prose to find out they are the same moment.
//!
//! WHY `declare namespace`. The editor's Outline is the second reading surface of
//! this file — the system design, navigable, without opening a mermaid. Nesting is
//! what the Outline draws as a TREE (`Inbox → Events → ItemCaptured`); a flat file
//! draws the same model as a list of siblings you have to recognise as related by
//! their prefix. `declare` is what keeps that free: no runtime object, nothing
//! emitted, the namespace exists only for TypeScript and for the tree.
//!
//! `InboxSystem` IS THE INSIDE, `Inbox` IS THE OUTSIDE. The CLI knows exactly one of
//! them: the verbs (`capture`, `pull`, `process`, `drop`) type themselves against
//! `Inbox` and never name a `ValueObjects.*` — a caller reaching into the internals
//! is a caller that will break when the internals move, which is the whole reason
//! for a surface. The one file allowed to know both is the one that IS the inside
//! (@src/inbox/layout.ts): it turns the vocabulary into folders on disk.
//!
//! TWO TOP-LEVEL NAMES, AND THE SPLIT IS THE POINT. `InboxSystem` is the vocabulary
//! — `ValueObjects` (what the domain is made of), `Entities` (what has identity
//! INSIDE the aggregate), `Events` (what came out). `Inbox`, at the bottom, is the
//! AGGREGATE ROOT: one inbox, and what it can be asked to do. Read top-down the file
//! tells the story vocabulary → things → facts → surface, with nothing pointing
//! backwards.
//!
//! THERE IS NO `Commands` SECTION. A command as a noun (`ProcessItem { became }`) is
//! the intention modelled twice: once as a shape and once as whatever acts on it. A
//! METHOD is the intention, and the payload survives as its parameters —
//! `Parameters<Inbox["process"]>` is the same compile-time seam the interface was.
//! `Policies`, `Queries` and `Errors` are absent for the older reason: a section
//! exists when the domain has a real concept of that kind, not because DDD has a
//! word for it.
//!
//! `interface` FOR A CONCEPT, `type` FOR A SCALAR OR A UNION — an Outline decision,
//! not a typing one. VS Code's document-symbol provider treats a `type` alias as a
//! LEAF and an `interface` as a CONTAINER: the same fields are invisible one way and
//! a branch the other. Inherited members are not repeated, which is the bonus:
//! `ProcessItem : ItemRef` shows only what it ADDS, and `ItemRef` is one level up.
//!
//! METHODS AND EVENTS ARE NOT SYMMETRIC, on purpose. `AgentNotified` has no method
//! here, because the inbox does not own that pane — herdr does. A verb belongs to
//! whoever ACCEPTS it, so the day `HerdrSystem` gets written, this tree already says
//! the waking was never the inbox's to answer.
//!
//! ponytail: no `emit()`, no store, no bus, no wire names, no branded scalars. A
//! brand (`string & {__brand}`) buys compile-time safety only where a CONSTRUCTOR
//! validates — with none here it buys a cast at every call site and checks nothing.
//! The invariants of a value object (a name is a name, a path exists) live in the
//! code that builds them; this file only says the field is not "a string".
//!
//! depends_on: 01_projects/inbox-v1/docs/02_system_design_captura.md · 01_projects/inbox-v1/docs/03_system_design_processamento.md
//! impacts:    src/inbox/capture.ts

/** The inbox: a FOLDER with a `CONTEXT.md`, in more than one place — `00_inbox/`
 *  serves the house, `01_projects/<p>/inbox/` serves a project, same shape.
 *  @see 01_projects/inbox-v1/docs/00_system_design_big_picture.md */
export declare namespace InboxSystem {
	/** WHAT THE DOMAIN IS MADE OF. */
	namespace ValueObjects {
		/** Absolute path of a FOLDER — the inbox itself, with `CONTEXT.md` and
		 *  `archive/` inside it. `--to` names one; without it, the house inbox is the
		 *  default.
		 *
		 *  `FolderPath` and not `InboxPath`: the type says WHAT THE VALUE IS, and every
		 *  caller already knows which folder it is holding from the field name
		 *  (`inbox_path`). A type named after its first use case is a rename waiting for
		 *  the second one. */
		type FolderPath = string;

		/** `007_specialized_skills` — the item's IDENTITY, and the name of its folder:
		 *  three digits, then `underscore_case`. It never changes, and the folder carries
		 *  it through all three states, so every reference to it survives.
		 *
		 *  NO TIMESTAMP IN THE NAME, and that was a reversal on 20/08. A name like
		 *  `2026-08-20T0759Z_specialized_skills` buys arrival order and nothing else, and
		 *  the price is 17 characters of noise before the word that says what the request
		 *  IS — in a sidebar where that word is the whole point.
		 *
		 *  THE `NNN` BUYS THE SAME ORDER FOR THREE CHARACTERS. It counts UP from `001`,
		 *  like a task inside a sprint and unlike a sprint itself: a sprint numbers DOWN
		 *  because the top of that list is what is being planned now, and an inbox is a
		 *  QUEUE — the top is what has been waiting longest, which is what should be
		 *  pulled next. Assigned once, at capture, from the highest number in ALL THREE
		 *  states: a number freed by archiving must never be handed out again, or two
		 *  records in one inbox end up sharing an address.
		 *
		 *  It is the natural key, so it is unique inside one inbox and dedup happens at
		 *  CREATION: same number never twice, and a repeated title takes `_2`. */
		type ItemName = string;

		/** WHERE THE ITEM SITS IS ITS STATE — there is no status field, and a folder
		 *  cannot disagree with one. Three places, three states, and the whole machine is
		 *  `backlog → ready → archive`:
		 *
		 *  - `backlog` — `<inbox>/backlog/<name>/`. Every new item lands here.
		 *  - `ready` — `<inbox>/<name>/`, beside the `CONTEXT.md`. It is here
		 *    because someone PULLED it, and being here means it is being worked on. The
		 *    inbox root is a working set, not a pile.
		 *  - `archive` — `<inbox>/archive/<name>/`. Answered, with what it became
		 *    written inside it. Frozen record.
		 *
		 *  This is what the two-state version could not do, measured 20/08: 13 of 20
		 *  requests had sat parked for 3 days looking exactly like the ones nobody had
		 *  read yet. "Captured" and "being worked on" are different facts, and a place
		 *  is the only way to spell them differently that cannot rot. */
		type ItemState = "backlog" | "ready" | "archive";

		/** WHICH FOLDER EACH STATE IS — the layout as a contract, instead of three string
		 *  literals repeated across the implementation.
		 *
		 *  `ready` IS THE ROOT, and the empty segment is the whole point: an item being
		 *  worked on sits beside the inbox's own `CONTEXT.md`, in the open, visible the
		 *  moment the folder is opened. A `ready/` folder would put the working set one
		 *  click deeper than the pile, which is backwards.
		 *
		 *  A TYPE AND NOT A CONSTANT, because this file is `declare`: it emits no runtime
		 *  object, so a `const` here would be a name that resolves to `undefined` for
		 *  whoever imports it. The folder NAMES are the contract and live here; the
		 *  values live in the module that touches the disk (@src/inbox/layout.ts) and are
		 *  typed against this, so the two cannot drift. */
		type StateFolder = {
			backlog: "backlog";
			ready: "";
			archive: "archive";
		};

		/** Who an inbox, or one item in it, is FOR — `qa-workflow`, `zenit`,
		 *  `gabriel`. The same name the fleet bus addresses by (`my agents send <name>`)
		 *  and the same one an agent knows itself by (`MY_AGENT`).
		 *
		 *  A NAME, NEVER A PANE. `w2B:p1` is where a delivery lands, and it changes every
		 *  time an agent is reopened; the name is what stays. Same pairing as
		 *  `ItemName` against `created_at`: one is the key, the other is a measurement.
		 *
		 *  DECLARED HERE ON PURPOSE, even though `agents` has the same concept. Systems
		 *  COMPOSE, they do not share a kernel: importing the agents' type would make
		 *  this module fail to build because a neighbour moved a file. The contract
		 *  between the copies is the VALUE — the string in the `<para>` column of the
		 *  bus — not the declaration. */
		type AgentName = string;

		/** ISO instant, `2026-08-20T07:10:59.000Z`. */
		type Instant = string;

		/** WHEN. `modified_at` is the folder's `mtime`, always — the filesystem is the
		 *  only honest answer to "has anyone touched this".
		 *
		 *  `created_at` HAS TWO SOURCES, IN ORDER: the `created:` in the item's own
		 *  frontmatter first, the folder's `birthtime` second. The written one wins
		 *  because it survives what the filesystem does not — a `cp -r`, a restore from
		 *  backup, a folder recreated by a migration all reset `birthtime` to today and
		 *  quietly make a three-day-old request look new (measured on 20/08, on the
		 *  migration in this very repo). The `birthtime` is the fallback for an item
		 *  someone wrote by hand and did not date.
		 *
		 *  The two can disagree, and when they do the WRITTEN one is the answer: it was
		 *  put there by whoever captured the request, and the filesystem only knows when
		 *  bytes last landed on disk.
		 *
		 *  PER ITEM, and that is the second thing an item-as-FOLDER buys. While an item
		 *  was a section of one page, the filesystem only knew the page's `mtime`: touch
		 *  one request and all twenty-one read as modified. A folder of its own has its
		 *  own times, so "this one has been sitting untouched for three days" is a
		 *  question the disk answers, with no parser and no `git log -L`. */
		interface Timestamps {
			created_at: Instant;
			modified_at: Instant;
		}

		/** Which item, in which inbox — the identity, apart from the content. Every
		 *  command and every event carries this and nothing less. */
		interface ItemRef {
			inbox_path: FolderPath;
			name: ItemName;
		}

		/** The clipboard screenshot, saved INSIDE the item's own folder and linked
		 *  relatively: `/tmp` disappears on reboot, and a relative link survives the item
		 *  moving `backlog → inbox → archive`. Path is relative to the item's
		 *  `CONTEXT.md` — the whole folder travels together, links intact. */
		type AttachmentPath = string;

		/** Where the work ended up living: a run, a sprint, a project, a note. The answer
		 *  to the only question anyone ever asks an old request. */
		type Destination = string;

		/** How a request ENDED — and the two endings carry different things, which is
		 *  why this is a union and not one shape with two optional fields. Processed
		 *  points at what exists now; dropped points at nothing and owes an
		 *  explanation instead. A shape with `became?` and `reason?` would let both be
		 *  absent, which is the state that must not be representable: an answered item
		 *  with no answer in it. */
		type Answer =
			| { kind: "processed"; became: Destination }
			| { kind: "dropped"; reason: string };
	}

	/** WHAT HAS IDENTITY INSIDE THE AGGREGATE.
	 *
	 *  One entity, and it is here rather than being a root because nothing addresses
	 *  it on its own: every change to an item goes through the `Inbox` it lives in,
	 *  which is what makes the inbox the consistency boundary. `InboxFolder` used to
	 *  sit here as a second entity and was deleted — it WAS the aggregate, described
	 *  from the outside, and the aggregate is `Inbox` itself.
	 *
	 *  The `Inbox` prefix stays on the name because the Outline and the graph show
	 *  the label alone, without the namespace path: a bare `Item` could be anybody's. */
	namespace Entities {
		/** A request, and it is a FOLDER of its own — `<name>/` with a `CONTEXT.md`
		 *  inside, plus whatever came with it. It never changes name; what changes is
		 *  which of the three places it sits in.
		 *
		 *  A folder and not a section of one page, and the three reasons are all things
		 *  the section could not do: it can MOVE (which is what makes the state
		 *  unfalsifiable), it has its own `mtime` (so "parked for three days" is a
		 *  question the disk answers), and it can hold its own attachments without
		 *  crowding anybody else's request. */
		interface InboxItem extends ValueObjects.ItemRef, ValueObjects.Timestamps {
			title: string;
			/** The request VERBATIM. The only thing the result can be judged against
			 *  later, so it is carried whole and never rewritten. */
			body: string;
			state: ValueObjects.ItemState;
			attachment?: ValueObjects.AttachmentPath;
			/** Present exactly when the item is in `archive` — an open request has no
			 *  answer, and an answered one is never anywhere else. The pair is what makes
			 *  a read of the archive useful on its own: what was asked, and what came of
			 *  it, in one object. */
			answer?: ValueObjects.Answer;
			/** Who THIS request is for, when it is not whoever owns the inbox — a request
			 *  dropped in the house inbox that is plainly the `zenit`'s.
			 *
			 *  RESOLUTION, and it lives here so it is written once: **item, then folder,
			 *  then the house.** Two places naming a destination is how two truths start;
			 *  the more specific one wins and the other is not consulted.
			 *
			 *  ABSENT AND `null` ARE DIFFERENT ANSWERS, which is why the field is both
			 *  optional and nullable. Absent means NOT STATED — go ask the folder, then
			 *  the house. `null` means STATED, and the answer is nobody: this one item is
			 *  not the owner's, and the resolution stops right here instead of walking up.
			 *  Collapsing the two would make "I did not say" indistinguishable from "I
			 *  said no one", and in an inbox with an owner those route the request to
			 *  different people.
			 *
			 *  Addressing is NOT state. An assigned item nobody read is exactly as open
			 *  as any other — `ItemState` stays out of this.
			 *
			 *  NOT IMPLEMENTED. */
			agent?: ValueObjects.AgentName | null;
		}
	}

	/** WHAT WE KNOW HAPPENED — past tense, and it carries what only exists AFTER. */
	namespace Events {
		/** An item folder was written into `<inbox>/backlog/`. Nothing else happened: no
		 *  work started. Carries the whole item because the name and the `created:` only
		 *  exist from this moment on. */
		interface ItemCaptured extends Entities.InboxItem {}

		/** The item moved `backlog → ready`: its folder now sits at the inbox root, in
		 *  the open, and it is being worked on. */
		interface ItemPulled extends ValueObjects.ItemRef {}

		/** Something tried to steer the agent's pane with a pulled item. Failure is an
		 *  EVENT and not an exception: the item is already on disk and survived the
		 *  session, which was the point — what was lost is only the wake-up.
		 *  @see src/herdr/panes/send.ts */
		interface AgentNotified extends ValueObjects.ItemRef {
			/** WHO it was for — resolved: item, then folder, then the house. Absent means
			 *  nobody was addressed and the delivery went wherever the house points.
			 *
			 *  Carried NEXT TO `pane` and not instead of it, because they answer different
			 *  questions: the agent is who should have got it, the pane is where it
			 *  actually landed. With only the pane, "delivered to the wrong agent" reads
			 *  exactly like "delivered".
			 *
			 *  NOT IMPLEMENTED. */
			agent?: ValueObjects.AgentName | null;
			/** WHERE it landed. `w2B:p1` — an address of the moment, not an identity. */
			pane: string;
			/** Absent when it arrived. The text is herdr's, verbatim. */
			error?: string;
		}

		/** The item became something, and its folder moved into `archive/`. What it became
		 *  is written INSIDE the item — the request and its answer travel together, so
		 *  there is no second file to keep in sync and nothing to link. */
		interface ItemProcessed extends ValueObjects.ItemRef {
			became: ValueObjects.Destination;
		}

		/** The item became NOTHING, on purpose, and moved into `archive/` all the same. A
		 *  refused request is the most expensive information in the house: the only one
		 *  you cannot reconstruct by reading the code afterwards, so it is archived,
		 *  never deleted. */
		interface ItemDropped extends ValueObjects.ItemRef {
			reason: string;
		}
	}
}

/**
 * THE AGGREGATE ROOT: one inbox, and everything it can be asked to do.
 *
 * `InboxSystem` above is the vocabulary the domain is made of; this is the surface
 * someone actually touches. Two names and not one merged `Inbox`: declaration
 * merging would put a tree of types and a list of verbs under one symbol, and the
 * Outline would show them as one confusing branch. Split, the editor shows exactly
 * what this file is — a vocabulary, and a thing that uses it.
 *
 * The question stops being *which commands exist* and becomes **what does an inbox
 * know how to do**, which is the question a reader actually has.
 *
 * IT IS ONE INBOX, NOT THE SYSTEM OF INBOXES, and that is what makes it an
 * aggregate root rather than a service: every method already knows which folder it
 * belongs to, so nothing here takes an `inbox_path`. A `listAllInboxes()` or a
 * `createInbox()` would be a different thing wearing this name.
 *
 * THERE IS NO `Commands` NAMESPACE, and that is the same decision seen from the
 * other side: `ProcessItem` as a noun was the intention modelled twice — once as a
 * shape, once as whatever acts on it. A method IS the intention. What was worth
 * keeping from those types is the PAYLOAD, and it survives as the parameters: a
 * caller that wants the command shape asks for `Parameters<Inbox["process"]>`,
 * which fails to compile on a rename exactly like the old interface did.
 *
 * EVERY METHOD RETURNS ITS EVENT. Not decoration: it is what pins command to event
 * in the type system, and without it the pairing lives only in prose — the parser
 * that draws this graph had to be told with a `@produces` tag precisely because
 * nothing else connected the two.
 *
 * NOT IMPLEMENTED AS AN OBJECT, and it may never be. The implementation is four CLI
 * subverbs (`src/inbox/capture.ts`, `pull.ts`, `process.ts`, `drop.ts`), each one a
 * script that does one of these and exits. This interface says WHAT an inbox does,
 * not that there is a class somewhere doing it — a shape is free to be answered by
 * four files, a server, or an object, and this one is answered by four files.
 */
export interface Inbox {
	/** WHERE this inbox is — the folder that holds `CONTEXT.md`, `backlog/` and
	 *  `archive/`. */
	readonly path: InboxSystem.ValueObjects.FolderPath;

	/** Who this inbox is FOR. Absent means the house: whoever is at the wheel.
	 *
	 *  An inbox with an owner is not a new KIND of inbox and never a new place — no
	 *  folder per agent. It is the same folder with a name on it, which is what keeps
	 *  one sweep able to read all of them.
	 *
	 *  NOT IMPLEMENTED: nothing reads it yet. It will come from the frontmatter of
	 *  this inbox's `CONTEXT.md` (`agent: qa-workflow`) — a folder has nowhere to keep
	 *  a field, and that file already has frontmatter. */
	readonly agent?: InboxSystem.ValueObjects.AgentName | null;

	/** Take a new request in. It lands in `backlog/` — always, whoever asks — because
	 *  "captured" and "being worked on" are different facts, and an inbox that spells
	 *  them the same way is the one that let 13 requests sit for 3 days.
	 *
	 *  It wakes NOBODY. Waking moved to `pull` when `backlog/` appeared: waking on
	 *  capture is what made every request urgent and none of them tracked.
	 *
	 *  No `name` in, because the name is minted here from the title — a caller passing
	 *  one would be naming the item's identity for it, and dedup happens on the way in.
	 *  @produces ItemCaptured
	 *  @see 01_projects/inbox-v1/docs/02_system_design_captura.md */
	capture(request: {
		title: string;
		body: string;
		attachment?: InboxSystem.ValueObjects.AttachmentPath;
		/** Address this one request, whoever owns the inbox. Omitted, the inbox
		 *  answers, and if it says nothing the house does.  NOT IMPLEMENTED. */
		agent?: InboxSystem.ValueObjects.AgentName | null;
	}): InboxSystem.Events.ItemCaptured;

	/** Take an item out of the pile and put it in the open: `backlog → ready`. THIS is
	 *  what says "work on it" — the only door into answering, and the moment an agent
	 *  is woken. Deciding is a separate act from capturing, and this is where it lives.
	 *  @produces ItemPulled
	 *  @produces AgentNotified */
	pull(name: InboxSystem.ValueObjects.ItemName): InboxSystem.Events.ItemPulled;

	/** Turn an item into work that now lives somewhere: `ready → archive`, and from
	 *  `backlog` too — most of what gets answered on sight was never pulled.
	 *  @produces ItemProcessed
	 *  @see 01_projects/inbox-v1/docs/03_system_design_processamento.md */
	process(
		name: InboxSystem.ValueObjects.ItemName,
		became: InboxSystem.ValueObjects.Destination,
	): InboxSystem.Events.ItemProcessed;

	/** Decide, on purpose, that an item becomes nothing. The reason is required: a
	 *  refusal with no why is the same as deleting the request, and a refusal is the
	 *  one record that cannot be reconstructed by reading the code afterwards.
	 *  @produces ItemDropped */
	drop(name: InboxSystem.ValueObjects.ItemName, reason: string): InboxSystem.Events.ItemDropped;

	// ─── READING ─────────────────────────────────────────────────────────────────
	//
	// Everything below only ANSWERS; nothing here moves a folder or writes a byte.
	// The split is worth keeping visible: the four verbs above are the whole surface
	// through which an inbox changes, so anything that surprises you about the state
	// came from one of four places, never from a reader.
	//
	// None of these invent an index. The disk already holds the answer — three
	// folders and a name that sorts by arrival — and an index would be a second
	// truth that goes stale exactly when someone moves a folder by hand.

	/** One item by its identity, wherever it sits. `undefined` when there is none —
	 *  a name that was never captured is a question, not an error.
	 *
	 *  By NAME, which is the folder: it is the identity, it is unique in this inbox,
	 *  and it is the same in all three states. */
	find(name: InboxSystem.ValueObjects.ItemName): InboxSystem.Entities.InboxItem | undefined;

	/** Every item in one state, oldest first — arrival order, which is free because
	 *  ordered by `created_at` — which now costs a read of each item's frontmatter,
	 *  and that is the price of a name that says what the request IS. Omit the state
	 *  for all three at once, which is what a sweep wants. */
	items(state?: InboxSystem.ValueObjects.ItemState): InboxSystem.Entities.InboxItem[];

	/** What is waiting, untouched: `items("backlog")`. The name exists because this
	 *  is the question asked most often, and `items("backlog")` reads like plumbing
	 *  at a call site that just wants the pile. */
	backlog(): InboxSystem.Entities.InboxItem[];

	/** What is being worked on right now: `items("ready")`. In a healthy inbox this
	 *  is SHORT — it is a working set, and a long one means things were pulled and
	 *  abandoned, which is a finding in itself. */
	ready(): InboxSystem.Entities.InboxItem[];

	/** What was answered, oldest first. Each carries its `answer`, so "what did we do
	 *  about X" is one read and not an archaeology session. */
	archived(): InboxSystem.Entities.InboxItem[];

	/** The oldest thing in the backlog — the fila, honoured. It is what `pull --next`
	 *  runs on, and it is a method rather than `backlog()[0]` because the definition
	 *  of "next" is a domain decision: today it is arrival order, and the day it
	 *  becomes "the addressed one first" this signature does not change. */
	next(): InboxSystem.Entities.InboxItem | undefined;

	/** Items nobody has touched in `days` days, oldest first. Straight at the pain
	 *  that was measured on 20/08 — 13 of 20 requests sitting for 3 days with nothing
	 *  saying so. Answerable only because each item is a folder with its own `mtime`;
	 *  while items were sections of one page, this method could not have existed. */
	stale(days: number): InboxSystem.Entities.InboxItem[];

	/** Everything addressed to one agent, in every state. `null` asks the opposite
	 *  question — what is explicitly NOBODY's — which is the pile that quietly grows
	 *  in an inbox with an owner.
	 *
	 *  Resolution is applied here, not by the caller: an item with no agent of its
	 *  own inherits the inbox's. NOT IMPLEMENTED, with `agent`. */
	assignedTo(agent: InboxSystem.ValueObjects.AgentName | null): InboxSystem.Entities.InboxItem[];

	/** How many are in each state. One line for a status bar or a check, without
	 *  reading a single body — and the shape says which states exist, so a new state
	 *  cannot be added without every counter noticing. */
	counts(): Record<InboxSystem.ValueObjects.ItemState, number>;

	/** Items whose title or body contains `term`, case-insensitive. It exists so a
	 *  script can ask without shelling out to `rg` and parsing paths back into items;
	 *  a human at a terminal should still just grep.
	 *
	 *  No ranking, no fuzzy match, no index. If this ever needs those, the answer is
	 *  a search engine, not a better regex in here.  NOT IMPLEMENTED. */
	search(term: string): InboxSystem.Entities.InboxItem[];

	/** What this item became, or why it did not — `undefined` while it is still open.
	 *  The one question anyone asks an old request, as its own method because the
	 *  answer lives inside the item and reading it should not mean parsing markdown
	 *  at the call site.  NOT IMPLEMENTED. */
	answerOf(name: InboxSystem.ValueObjects.ItemName): InboxSystem.ValueObjects.Answer | undefined;
}
