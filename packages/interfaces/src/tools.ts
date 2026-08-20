//! `tools` — the programs this house DOES NOT OWN, behind one verb: `my tools
//! <tool> <verb>`.
//!
//! ONE FILE, NOT A FOLDER, because the boundary is what matters and it is the same
//! boundary for all of them: somebody else ships it, somebody else breaks it, and
//! when it changes an id format the file that fails should visibly be theirs. Four
//! files repeated that sentence four times.
//!
//! THE TEST FOR ENTERING, corrected 20/08: not "who wrote it" but WHO CAN THIS REPO
//! CHANGE IN ONE COMMIT. The old wording was "do we ship it?", and `my-graph` broke
//! it — we wrote every line of it, and it still belongs here, because it lives in
//! `github.com/biliboss/my-graph` with its own history: a bug in it cannot be fixed
//! in the same commit as the caller, exactly like `herdr`. Ownership of the SOURCE is
//! not the boundary; ownership of the RELEASE is.
//!
//! `agents` and `chat` stay outside — the fleet name and the bus are ours and in this
//! repo, even though an agent runs a vendor CLI.
//!
//! ASYNC AND ENVELOPED, and the contract said neither until 20/08. Every verb here
//! but two ends in another program — a `Bun.spawn` of `gh`, of `herdr`, of `open(1)`,
//! or a socket to `my-graph.localhost` — and there is no synchronous way to ask a
//! process a question. (The two: `graph.url` is string arithmetic, and `claude.hooks`
//! reads files off this disk.) So the return types are `Promise`, and where the code already answers
//! `{ ok, … } | Fail` the contract says so: **a program from outside failing is an
//! EVENT, not an exception** — a missing binary, a timeout and a dead server are
//! three ordinary answers a caller has to branch on, not three stack traces — and
//! that is the whole reason the envelope exists.
//!
//! external:    askuser · gh · herdr · VS Code · my-graph · neutralino
//! implemented: src/tools/graph.ts · src/tools/check.ts · src/tools/claude/hooks.ts
//! planned:     src/tools/  ← absorve src/{askuser,gh,herdr,vscode}/
//! depends_on:  src/askuser/ · src/gh/ · src/herdr/ · src/vscode/ · src/shared/result.ts · src/tools/graph.ts · src/tools/check.ts · src/tools/claude/hooks.ts
//! checks:      declared HERE, never imported. `check()` returns `Finding[]` and
//!              the runner reads it structurally, so a check costs no dependency.
//!              THIS one returns `Promise<Finding[]>`, alone among the systems: the
//!              answer comes from four child processes and a socket, and no amount of
//!              contract makes that synchronous.

/** What this system found rotten. Declared here rather than imported: the runner
 *  reads the shape, so owning a check costs no dependency on a hub. */
export interface Finding {
	path: string;
	says: string;
}

import type { Shared } from "./shared";

export declare namespace ToolsSystem {
	/** THE REFUSAL, tagged. Lives at runtime in `src/shared/result.ts`; restated here
	 *  for the same reason `Finding` is — a contract that imports its implementation
	 *  is a contract that cannot be read alone.
	 *
	 *  The tag exists because a caller answers the four reasons differently, and an
	 *  HTTP wrapper maps them to 404 / 409 / 502. Before it, the wrapper re-derived the
	 *  reason by matching the message text, and a reworded error turned a 409 into a
	 *  500 in silence. */
	export type Fail = {
		ok: false;
		error: string;
		/** `not_found` the id names nothing · `ambiguous` it names more than one ·
		 *  `blocked` the workspace fence refuses · `herdr` the multiplexer itself
		 *  failed, and the fault is OUTSIDE this process. */
		reason: "not_found" | "ambiguous" | "blocked" | "herdr";
		/** The candidates, on `ambiguous` only — the ambiguity is returned, never guessed. */
		ids?: string[];
	};

	/** The question that goes on a SCREEN and BLOCKS until somebody decides.
	 *  Blocking is the feature: a question printed in a pane is a question an
	 *  unattended agent answers itself. */
	export namespace AskUser {
		export interface Option {
			label: string;
			description?: string;
		}

		/** Free text is always available beside the options — a menu that cannot be
		 *  escaped is a menu that gets a wrong answer. */
		export interface Answer {
			chosen?: string;
			text?: string;
			at: Shared.Instant;
		}
	}

	/** GitHub from the outside. It ASKS, it does not mirror: a local copy of an issue
	 *  is a second truth that goes stale during a review. */
	export namespace Gh {
		export type Repo = string;
		export type Branch = string;

		/** `merged` is not a kind of `closed`: the two mean opposite things about the
		 *  work. */
		export type State = "open" | "closed" | "merged";

		export interface Issue {
			repo: Repo;
			number: number;
			title: string;
			state: State;
			url: string;
		}

		export interface PullRequest extends Issue {
			branch: Branch;
			checks?: "pending" | "passing" | "failing";
		}
	}

	/** The multiplexer where the fleet lives. Four nouns are ITS: workspace, tab,
	 *  pane, agent — so every id here is an address, never an identity. */
	export namespace Herdr {
		/** `w2B` — handed out again after a restart. */
		export type WorkspaceId = string;
		/** `w2B:p1` — where something is drawn right now. */
		export type PaneId = string;

		/** `+` beside, `/` below, relative to the LAST pane. `|` is missing on purpose:
		 *  the shell eats the pipe before the CLI sees it. */
		export type Split = "+" | "/";

		export interface Workspace {
			id: WorkspaceId;
			name: string;
			panes: PaneId[];
		}

		export interface Pane {
			id: PaneId;
			/** The fleet name attached to it. herdr knows nothing about our names; the
			 *  roster on disk is what maps them. */
			agent?: string;
		}
	}

	/** The sidebar. The workspace file is the truth and this writes it; VS Code
	 *  reloads on its own, which is why there is no `apply`. */
	export namespace ClaudeCode {
		/** `SessionStart`, `UserPromptSubmit`, `PreToolUse` — Claude Code's names, not
		 *  ours. An open set: an event we have not met must arrive as itself. */
		export type HookEvent = string;

		export interface Hook {
			event: HookEvent;
			command: string;
			/** Which settings file declared it. Two files declaring the same hook is how
			 *  a session gets a rule twice. */
			source: string;
		}
	}

	/** THE GRAPH VIEWER, `github.com/biliboss/my-graph` — a Next app that reads a
	 *  folder of contracts and draws who depends on whom.
	 *
	 *  IT IS OURS AND IT IS STILL A TOOL. It was extracted from `01_projects/my-v1/`
	 *  on 20/08 precisely so it would stop knowing this repo: the tree it draws is
	 *  `MY_GRAPH_ROOT`, a parameter. What made it publishable is what makes it foreign
	 *  — this house can no longer change it and the caller in one commit. */
	export namespace MyGraph {
		/** The folder of `<system>.ts` contracts to draw. Absolute, because the viewer
		 *  runs from its own checkout and has no idea where this one is. */
		export type Root = string;

		/** A palette name from the viewer's `ui/Themes.tsx` — `monokai`, `aura`,
		 *  `tokyo-night`, `synthwave`… Open: the list is THEIRS, and a theme added over
		 *  there must arrive as itself rather than be rejected here. */
		export type Theme = string;

		/** WHAT THE VIEWER SHOWS, which is the whole of its state — it keeps none.
		 *  Every field is a URL parameter (`#open=…&sel=…&d=…&hub=0&t=…`), so a `View`
		 *  IS a link, and this house never has to script a click to reach a reading. */
		export interface View {
			/** Files whose interfaces are expanded into a ring. */
			open?: string[];
			/** `kanban`, or `kanban::Metrics` for one interface of it. */
			selected?: string;
			density?: "compact" | "balanced" | "comfortable";
			/** Draw the cited `src/…` paths, off by default. */
			externals?: boolean;
			/** Hide the arrows INTO the hub — the node half the graph imports. */
			hideHub?: boolean;
			theme?: Theme;
		}
	}

	/** A JANELA SAIU DAQUI EM 20/08. Era `Window`, era Neutralino, e nunca virou
	 *  código — o que é a parte que importa: o desenho sobreviveu um mês sem um
	 *  consumidor conseguir usá-lo, porque faltava a resposta pra "como a página
	 *  devolve o que a pessoa respondeu". Neutralino não dá RPC; a resposta ia ter
	 *  que ser um POST pra um servidor que alguém subisse.
	 *
	 *  O lugar dela agora é `packages/my-canvas`, sobre Electrobun, que tem RPC
	 *  tipado dos dois lados e serve o bundle por esquema próprio — as duas coisas
	 *  que faltavam. E ela deixa de ser `tools` por um motivo de fronteira, não de
	 *  runtime: `tools` agrupa programa que QUEBRA A GENTE de fora pra dentro, e uma
	 *  base de desktop não é um adaptador entre outros vinte — quando ela cai, não
	 *  cai um verbo, cai a capacidade de PERGUNTAR.
	 *
	 *  Não fica ponteiro nem tipo pendurado aqui: migração que deixa metade pra trás
	 *  é o dual-write que o @CLAUDE.md proíbe. Quem quiser janela, `my-canvas`. */

	export namespace Vscode {
		/** Relative to `~/src` — `me/01_projects/my-teams-v1`. */
		export type FolderPath = string;

		export interface Folder {
			path: FolderPath;
			name?: string;
		}
	}
}

/** `my tools <tool> <verb>`. One surface per program, so a caller names the tool it
 *  is talking to and an outage has an obvious owner. */
export interface Tools {
	/** Each wrapped program answers `--version`, and the viewer answers `up()`. The only
	 *  honest check for something we do not ship: their logic is theirs and changes
	 *  without telling us; what a caller silently assumes every time is that the binary
	 *  is there, runs, and answers. */
	check(): Promise<Finding[]>;

	askuser: {
		/** Asks and WAITS. The caller does not continue without an answer, which is the
		 *  difference between a gate and a log line. */
		ask(
			question: string,
			options: ToolsSystem.AskUser.Option[],
		): Promise<ToolsSystem.AskUser.Answer>;

		/** Past decisions, newest first. Makes "we already decided this" checkable
		 *  instead of remembered. The log belongs to the `askuser` app, so reading it is
		 *  another call out — `Promise`, like everything else here. NO CODE YET. */
		history(): Promise<ToolsSystem.AskUser.Answer[]>;
	};

	/** NO ENVELOPE HERE, and that is not an oversight: `src/gh/` retries 5xx three times
	 *  and times out at 15 s, so by the time it gives up there is nothing left for a
	 *  caller to decide — `src/gh/prs.ts` and `src/gh/issues.ts` throw with the `gh`
	 *  message attached. The tagged envelope is `herdr`'s, where the four reasons are
	 *  answered differently. */
	gh: {
		/** Is there an open PR for this branch? Asked before opening a second one. */
		prs(branch: ToolsSystem.Gh.Branch): Promise<ToolsSystem.Gh.PullRequest[]>;
		issue(repo: ToolsSystem.Gh.Repo, number: number): Promise<ToolsSystem.Gh.Issue>;
	};

	/** EVERY VERB IS ENVELOPED, because every one of them is a `herdr` shellout with a
	 *  9 s ceiling: a timeout, a missing binary and a dead server are answers, not
	 *  exceptions, and `src/herdr/run.ts` never throws so a caller has ONE shape to
	 *  branch on. `close` and `focus` return the id they acted on rather than `void` —
	 *  "it worked" and "on what" are the same answer, and the id is what the next call
	 *  needs. */
	herdr: {
		workspaces(): Promise<{ ok: true; workspaces: ToolsSystem.Herdr.Workspace[] } | ToolsSystem.Fail>;
		workspace(name: string): Promise<{ ok: true; workspace: ToolsSystem.Herdr.Workspace } | ToolsSystem.Fail>;
		close(id: ToolsSystem.Herdr.WorkspaceId): Promise<{ ok: true; id: string; label: string } | ToolsSystem.Fail>;
		focus(id: ToolsSystem.Herdr.WorkspaceId): Promise<{ ok: true; id: string } | ToolsSystem.Fail>;

		/** NO CODE YET — `src/herdr/panes/` splits, reads, sends and grids, and nobody
		 *  has needed to list. Declared because the id in every other verb comes from
		 *  somewhere. */
		panes(workspace: ToolsSystem.Herdr.WorkspaceId): Promise<{ ok: true; panes: ToolsSystem.Herdr.Pane[] } | ToolsSystem.Fail>;
		split(
			pane: ToolsSystem.Herdr.PaneId,
			how: ToolsSystem.Herdr.Split,
		): Promise<{ ok: true; pane: ToolsSystem.Herdr.PaneId } | ToolsSystem.Fail>;

		/** What is on a pane's screen. */
		read(pane: ToolsSystem.Herdr.PaneId): Promise<{ ok: true; text: string } | ToolsSystem.Fail>;

		/** Types into a pane. Failure is an EVENT, not an exception: whatever was
		 *  delivered already survived on disk, and only the wake-up was lost. `enter`
		 *  says whether the text was SUBMITTED — typed-but-not-submitted is the failure
		 *  that looks exactly like success from outside. */
		send(
			pane: ToolsSystem.Herdr.PaneId,
			text: string,
		): Promise<{ ok: true; pane: ToolsSystem.Herdr.PaneId; enter: boolean } | ToolsSystem.Fail>;

		/** herdr owns the geometry; callers pick a side length, never compute one. */
		grid(
			workspace: ToolsSystem.Herdr.WorkspaceId,
			side: number,
		): Promise<{ ok: true; panes: ToolsSystem.Herdr.PaneId[] } | ToolsSystem.Fail>;
	};

	/** ABSORVIDO DE `system` (20/08). `settings.json` é arquivo do Claude Code, e o
	 *  Claude Code é programa que esta casa não escreve — ler hook de lá sempre foi
	 *  pergunta de `tools` com nome de `system`. O cabeçalho antigo dizia isso e
	 *  deixava o verbo lá mesmo; a costura que ele nomeou é onde o corte caiu. */
	claude: {
		/** SYNCHRONOUS, and the only verb here that gets to be: a `settings.json` is a
		 *  file this house reads, not a program it runs. It throws on invalid JSON —
		 *  which is not a program failing, it is OUR read of a file that Claude Code
		 *  would drop from the stack in silence. */
		hooks(): ToolsSystem.ClaudeCode.Hook[];
	};

	/** `my tools graph` — o desenho de quem depende de quem. */
	graph: {
		/** THE LINK, NOT A SCREENSHOT. Everything the viewer shows is in its URL, so a
		 *  reading of the graph is a string this house can paste into a card, a chat
		 *  turn or a commit — and it stays correct while the code changes, because the
		 *  picture is rendered from the code at open time. */
		url(view?: ToolsSystem.MyGraph.View): string;

		/** Opens the browser on that reading. Serving is not our job: the viewer is
		 *  behind `my-graph.localhost` (Caddy → :4173), and `up()` is what says whether
		 *  anybody is listening. `open(1)` is a program from outside like any other, so
		 *  a browser that refuses to open comes back as an answer.
		 *
		 *  A JANELA NATIVA é `window.open(url, { mode: "fullscreen" })` — este verbo
		 *  segue sendo o browser, e o shell não mora aqui: `my-graph` é app web e não
		 *  carrega toolchain nativo por causa desta casa. */
		open(view?: ToolsSystem.MyGraph.View): { ok: true; url: string } | { ok: false; error: string };

		/** Is it serving? The only honest check for a program with its own release —
		 *  and a socket cannot be asked synchronously. Connection refused, DNS and
		 *  timeout are all `false`: three OS messages, one question. */
		up(): Promise<boolean>;
	};

	vscode: {
		/** `-t` puts the folder at the TOP, the only position anybody asks for by
		 *  name. */
		set(folders: ToolsSystem.Vscode.Folder[], top?: ToolsSystem.Vscode.FolderPath): void;
		list(): ToolsSystem.Vscode.Folder[];
	};
}
