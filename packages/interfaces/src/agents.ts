//! `agents` — the fleet: who is running, under which CLI, with which session.
//!
//! THIS ONE IS NOT A DRAFT. `my agents list|send|read|chat|clone` runs today
//! (@src/agents/), so this file DOCUMENTS what exists and names the few things the
//! code does without a word for them. Where it goes beyond the code it says so.
//!
//! `send`, `read` and `chat` MOVED OWNERSHIP 20/08: the bus they wrote to
//! (`src/agents/bus.ts`) is gone, absorbed into `src/chat/` (@chat.ts). What is
//! left under `src/agents/` is three thin aliases that call the new verbs — kept
//! because the call sites are cited across the house and had to survive the
//! cutover, not because agents still owns the bus.
//! IT IS THE LAYER BELOW TEAMS, AND TEAMS IMPORTS IT. The house rule — systems
//! compose, the contract is the VALUE — governs NEIGHBOURS that move on their own
//! (herdr, inbox). This is not a neighbour: without agents there are no members, so
//! `teams` imports these types instead of copying them. Copy what can
//! disappear; import what you cannot exist without.
//!
//! ASYNC AND ENVELOPED, corrected 20/08 the same way `tools.ts` was corrected the
//! same day, and for the identical reason: every verb below `check()` ends up
//! asking `herdr` a question — a pane read, a `send-text`, a `--help` spawned to
//! measure `caps()` — and there is no synchronous way to ask a process anything.
//! The contract used to promise `Agent` and `string` back from `all`, `find`,
//! `screen`, `log`, `caps`, `start`, `clone`, `restart`, `tune` as if they were
//! reads off a struct already in memory; they are not, they are `herdr` shellouts
//! wearing a UI. So every one of them returns a `Promise`, and the ones that can
//! fail for a herdr-shaped reason (`not_found` · `ambiguous` · `blocked` · `herdr`
//! · `unsupported`, see `Fail` below) return the envelope instead of throwing.
//!
//! `check()` is the one exception, and STAYS synchronous — not because it never
//! touches herdr (a real reconciliation would), but because `src/shared/house.ts`
//! discovers every system's `check()` by `require()`-ing the module and calling the
//! export directly, with no `await`: an `async check()` comes back as a `Promise`
//! object, gets spread into the findings array, and produces nothing — MEASURED
//! 20/08 against `src/tools/check.ts`, whose own `check()` is `async` and shows up
//! as `0` in `house.coverage()` today despite existing and running clean under `my
//! tools check`. So `agents`' `check()` only verifies what is already on disk — the
//! roster file's own structural invariant — never a live herdr call.
//!
//! Doc rule and turn format: see `teams.ts`.
//!
//! imports:    resources.ts (what an agent is started knowing) · tools.ts (the pane
//!              it is drawn in — herdr`s word, held in one place)
//! implemented: src/agents/list.ts (all/check) · src/agents/view.ts (find/health/screen/log/caps)
//!              · src/agents/clone.ts (clone) · src/agents/start.ts (start) ·
//!              src/agents/control.ts (restart/interrupt/stop/tune) ·
//!              src/agents/send.ts · src/agents/read.ts · src/agents/chat.ts · src/agents/bus.ts
//! planned:    —  ← os 13 verbos existem
//! depends_on: src/agents/list.ts · src/agents/view.ts · src/agents/clone.ts ·
//!             src/agents/start.ts · src/agents/control.ts · src/herdr/agents/roster.ts
//! checks:      declared HERE, never imported. `check()` returns `Finding[]` and
//!              the runner reads it structurally, so a check costs no dependency.
//! impacts:    teams.ts

import type { Shared } from "./shared";

/** What this system found rotten. Declared here rather than imported: the runner
 *  reads the shape, so owning a check costs no dependency on a hub. */
export interface Finding {
	path: string;
	says: string;
}

/** The refusal shape for every verb below that shells out to herdr — same tag
 *  vocabulary as `tools.ts`'s `ToolsSystem.Fail` (`not_found` · `ambiguous` ·
 *  `blocked` · `herdr`), plus `unsupported`: a CLI this house knows behaves
 *  differently from `claude-code` (its resume/fork flags spelled another way, or
 *  not wired up here yet) — an honest "not built for this vendor", never a guess
 *  dressed as `false`. Declared here rather than imported for the same reason
 *  `Finding` is: a contract that imports its own implementation cannot be read
 *  alone. */
export type Fail = {
	ok: false;
	error: string;
	reason: "not_found" | "ambiguous" | "blocked" | "herdr" | "unsupported";
	ids?: string[];
};

import type { ResourceSystem } from "./resources";

import type { ToolsSystem } from "./tools";

export declare namespace AgentSystem {
	export namespace ValueObjects {
		/** What an agent knows itself by (`MY_AGENT`) and what `my agents send <name>`
		 *  takes. A NAME, never a pane: the pane changes every reopen. */
		export type Name = string;

		/** OURS TO MINT, measured 20/08: `claude`, `pi` and `gemini` all accept
		 *  `--session-id <uuid>`. `codex` is the fourth, which is why `Runtime` stays a
		 *  union rather than one string shared with the vendor. */
		export type SessionId = string;

		/** WHERE IT IS DRAWN, and it is herdr`s word — so it comes from `tools.ts`,
		 *  which is the one file allowed to know their vocabulary. Declaring it here was
		 *  a second copy of somebody else`s id format (fixed 20/08). */
		export type PaneId = ToolsSystem.Herdr.PaneId;

		/** @see shared.ts — declared once, for everybody. */
		export type Instant = Shared.Instant;

		/** `claude --effort` uses exactly these; `pi --thinking` adds `off` and
		 *  `minimal`. */
		export type Effort = "low" | "medium" | "high" | "xhigh" | "max" | (string & {});

		/** Four CLIs spell it four ways — `--permission-mode`, `--approval-mode`,
		 *  `codex sandbox`, `pi --approve` — so the house picks its own and each
		 *  launcher translates. `bypass` is what makes unattended possible AND
		 *  dangerous. */
		export type Permission = "ask" | "accept_edits" | "plan" | "bypass" | (string & {});

		/** `claude -w` and `gemini -w` create one; elsewhere it is a directory. THE ONLY
		 *  HONEST ANSWER FOR AN AGENT THAT WRITES — one `git stash` from one session
		 *  took nine files of another's refactor with it (17/08). */
		export type Worktree = string;

		/** Measured 20/08 — `native`: `claude --fork-session`, `pi --fork`, `codex
		 *  fork`. `emulated`: `gemini --session-file` + `--session-id`. `none` starts
		 *  COLD, and whoever asked is told so. */
		export type ForkSupport = "native" | "emulated" | "none";

		/** WHAT IT WAS ASKED TO BE. The union pairs the FIELDS — a session id cannot
		 *  enter where a model belongs — never the spelling: every `Model` keeps an open
		 *  end for next month's release. */
		export namespace Engine {
			export interface ClaudeCode {
				cli: "claude-code";
				model?: AgentSystem.ValueObjects.ClaudeCode.Model;
			}

			export interface Pi {
				cli: "pi";
				model?: AgentSystem.ValueObjects.Pi.Model;
			}

			export interface Codex {
				cli: "codex";
				model?: AgentSystem.ValueObjects.Codex.Model;
			}

			export interface Gemini {
				cli: "gemini";
				model?: AgentSystem.ValueObjects.Gemini.Model;
			}

			/** A CLI the house has not met. `cli: "other"` with the real name beside it:
			 *  `string & {}` as the discriminator still accepts `"gemini"`. */
			export interface Other {
				cli: "other";
				name: string;
				model?: string;
			}

			export type Any = ClaudeCode | Pi | Codex | Gemini | Other;
		}

		export namespace ClaudeCode {
			/** The id in `~/.claude/projects/<slug>/<id>.jsonl`. */
			export type SessionId = string;

			/** Aliases; full ids (`claude-opus-5`) go through the open end. */
			export type Model = "fable" | "opus" | "sonnet" | "haiku" | (string & {});
		}

		export namespace Pi {
			export type SessionId = string;

			/** `pi --model` takes `provider/id` — the provider is part of the string
			 *  here, unlike everywhere else. */
			export type Model = `${string}/${string}` | (string & {});
		}

		export namespace Codex {
			export type SessionId = string;

			export type Model = "gpt-5-codex" | "gpt-5" | (string & {});
		}

		export namespace Gemini {
			export type SessionId = string;

			export type Model = "gemini-3-pro" | "gemini-3-flash" | (string & {});
		}

		/** WHAT IT ACTUALLY IS. `Engine` is the request, this is the fact — merged, a
		 *  request would carry a session id for a run that has not happened.
		 *
		 *  `session` is OPTIONAL on every variant, corrected 20/08: `herdr agent list`
		 *  only fills `agent_session` for the CLI it knows how to introspect — measured
		 *  live, a `claude` pane in the list carries it, a `pi` pane next to it does
		 *  not. The CLI kind (`cli`) is always known (herdr detects the program); the
		 *  session is known only when herdr says so. */
		export namespace Runtime {
			export interface ClaudeCode {
				cli: "claude-code";
				session?: AgentSystem.ValueObjects.ClaudeCode.SessionId;
			}

			export interface Pi {
				cli: "pi";
				session?: AgentSystem.ValueObjects.Pi.SessionId;
			}

			export interface Codex {
				cli: "codex";
				session?: AgentSystem.ValueObjects.Codex.SessionId;
			}

			export interface Gemini {
				cli: "gemini";
				session?: AgentSystem.ValueObjects.Gemini.SessionId;
			}

			export interface Other {
				cli: "other";
				name: string;
				session?: string;
			}

			export type Any = ClaudeCode | Pi | Codex | Gemini | Other;
		}

		/** HOW ONE IS STARTED, as a value. Every field optional: omitted means the CLI's
		 *  own default, and the house does not restate what the vendor decides. */
		export interface Launch {
			engine?: Engine.Any;
			effort?: Effort;
			permission?: Permission;
			worktree?: Worktree;
			/** The vendor's own id. What makes an agent survive a restart — without it,
			 *  stop-and-start is amnesia. All four resume. */
			resume?: string;
			/** Meaningless without `resume`. Two agents resuming one id append to one
			 *  transcript and neither record stays readable. */
			fork?: boolean;
			/** WHAT IT IS STARTED KNOWING: house resources loaded into its context —
			 *  the rules it must not rediscover, the reference for the thing it is
			 *  about to touch.
			 *
			 *  BY NAME, NEVER BY PATH: `resources` owns where they live, and an agent
			 *  holding a path is an agent that breaks when a folder moves. It is also
			 *  the honest home for what four CLIs spell four ways —
			 *  `--append-system-prompt`, `--add-dir`, a plugin, a skill. */
			knows?: ResourceSystem.ValueObjects.ResourceName[];
		}

		/** `working` is a transcript that grew recently — the only positive evidence
		 *  there is. `stuck` looks identical from outside; `blocked` waits on a human,
		 *  and the fix is a person rather than a restart. */
		export type Health = "working" | "waiting" | "stuck" | "blocked" | "dead";

		/** WHERE A NEW AGENT LANDS, and what it is asked to do — added 20/08,
		 *  measured against `src/herdr/agents/start.ts`: starting one for real needs
		 *  either an existing pane or a workspace to open a tab in, and `--prompt` is
		 *  MANDATORY there ("an agent with no ask is a pane nobody knows the state
		 *  of"). None of that fits `Launch` — `Launch` is also `tune`'s vocabulary,
		 *  and a running agent has neither a workspace to move into nor a first
		 *  prompt to receive twice. So `start` takes this SECOND value instead of
		 *  overloading `Launch` with fields that mean nothing once the agent exists. */
		export interface Placement {
			workspace?: string;
			pane?: string;
			tab?: string;
			cwd?: string;
			prompt: string;
		}
	}

	export namespace Entities {
		/** One agent, running. The facts you need when it stops answering: which CLI,
		 *  which session of ours, which of theirs, which pane. */
		export interface Agent {
			name: ValueObjects.Name;
			/** OPTIONAL, corrected 20/08: `SessionId` above is "ours to mint", and
			 *  nothing in this house mints one today — no `start()` call passes
			 *  `--session-id`. So this field is real only the day that lands; until
			 *  then a caller reads `runtime.session`, the vendor's own id, which is
			 *  what herdr can actually report. */
			session?: ValueObjects.SessionId;
			/** OPTIONAL too, and for the same reason as `session` above one level
			 *  down: MEASURED 20/08 against `herdr agent list` — a `claude` pane
			 *  carries `agent_session`, a `pi` pane in the same list does not. herdr
			 *  only self-reports the session for the vendor it detects one from; the
			 *  others are simply unknown until this house starts minting and passing
			 *  its own id at launch. */
			runtime?: ValueObjects.Runtime.Any;
			/** RESOLVED, never the request: "which model is this one burning" must be
			 *  answerable here and not by replaying whatever asked for it. Every field
			 *  of `Launch` is itself optional (omitted = vendor default), so `{}` is a
			 *  true answer — "started plain" — not a stub. */
			launch: ValueObjects.Launch;
			pane: ValueObjects.PaneId;
			/** OPTIONAL, corrected 20/08: only knowable by resolving the vendor's own
			 *  transcript (`View.log`) and reading its first timestamp — real for
			 *  `claude-code` (measured: `~/.claude/projects/<slug>/<session>.jsonl`
			 *  carries a `timestamp` on its first event) and for `pi` (the session
			 *  filename itself is an ISO timestamp), unknown for the vendors this house
			 *  has not mapped a transcript path for yet. `all()` does not pay this cost
			 *  for every agent on every call; it is filled in where cheap. */
			started_at?: ValueObjects.Instant;
			/** Who it was forked from. `my agents list` already prints "clone de quem";
			 *  this is that fact with a name. */
			parent?: ValueObjects.Name;
		}
	}
}

/** Answers about the fleet as it is. Nothing here starts or stops anything. */
export interface View {
	/** No two roster entries (`_data/agents.json`) claim the same pane. SYNCHRONOUS
	 *  on purpose — see the header. A real "does every name still resolve to a live
	 *  pane" reconciliation is one herdr call away (`roster()` already does it,
	 *  async) but cannot be `check()` without falling off `house.check()`'s radar. */
	check(): Finding[];

	/** What `my agents list` prints today, typed. */
	all(): Promise<AgentSystem.Entities.Agent[]>;

	find(name: AgentSystem.ValueObjects.Name): Promise<AgentSystem.Entities.Agent | undefined>;

	health(name: AgentSystem.ValueObjects.Name): Promise<AgentSystem.ValueObjects.Health | Fail>;

	/** What is on its screen right now. */
	screen(name: AgentSystem.ValueObjects.Name): Promise<{ ok: true; text: string } | Fail>;

	/** Path to its raw transcript. Four vendors keep it in four places, and no caller
	 *  should learn all four. */
	log(name: AgentSystem.ValueObjects.Name): Promise<{ ok: true; path: string } | Fail>;

	/** What a CLI can do, MEASURED by spawning `<bin> --help` and grepping the real
	 *  flags — never declared from memory. `not_installed` when the binary is not on
	 *  PATH: an honest "I don't know because I don't have it", not a `false`. */
	caps(
		cli: string,
	): Promise<{ ok: true; fork: AgentSystem.ValueObjects.ForkSupport } | (Fail & { reason: "not_found" | "unsupported" })>;
}

export interface Agents extends View {
	/** Start one, named. `where` is not optional: no pane/workspace and no prompt
	 *  means no agent, only a claim that one exists — see `Placement`. */
	start(
		name: AgentSystem.ValueObjects.Name,
		where: AgentSystem.ValueObjects.Placement,
		launch?: AgentSystem.ValueObjects.Launch,
	): Promise<AgentSystem.Entities.Agent | Fail>;

	/** Fork a live session into a new agent: same context, new id, new pane. This is
	 *  `my agents clone`, which already runs — `clone(name, as)` is the same
	 *  mechanism aimed at any named roster agent instead of only the caller's own
	 *  pane. */
	clone(
		name: AgentSystem.ValueObjects.Name,
		as: AgentSystem.ValueObjects.Name,
	): Promise<AgentSystem.Entities.Agent | Fail>;

	/** Session RESUMED, so the repair keeps the context. `claude-code` only today —
	 *  the other three resume differently (see `caps`), and wiring a resume this
	 *  house has not measured against a live vendor is a guess, not a repair. */
	restart(name: AgentSystem.ValueObjects.Name): Promise<AgentSystem.Entities.Agent | Fail>;

	/** The escape key, not a kill. */
	interrupt(name: AgentSystem.ValueObjects.Name): Promise<{ ok: true } | Fail>;

	stop(name: AgentSystem.ValueObjects.Name): Promise<{ ok: true } | Fail>;

	/** Merged over what it has. LIVE only for `effort` today, and only for
	 *  `claude-code` — MEASURED 20/08 against a real pane. `engine.model` looked
	 *  live-tunable (`/model` opens a "this session only" picker) and was
	 *  REFUSED after two tries against a disposable test pane both ended up
	 *  overwriting the house's GLOBAL `~/.claude/settings.json` default instead
	 *  of scoping to the one session — see `src/agents/control.ts`'s header for
	 *  the incident. Everything not live goes through the next `restart` instead
	 *  — `caps` says which CLI even has a live surface worth trying. */
	tune(
		name: AgentSystem.ValueObjects.Name,
		launch: Partial<AgentSystem.ValueObjects.Launch>,
	): Promise<AgentSystem.Entities.Agent | Fail>;
}
