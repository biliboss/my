//! `resources` — everything this house knows, N at a time. The R of PARA, and the
//! same word skills use for the same thing.
//!
//! `references` WAS A SECOND VERB AND IS GONE (20/08). It named a KIND of resource —
//! `03_resources/references/` is a folder INSIDE resources — so two verbs asked one
//! question with two vocabularies, and a reader had to know which before searching.
//! One verb, `kind` says which.
//!
//! N AT A TIME IS THE POINT: reading one per call is how an agent spends a context
//! window on table of contents. `read` takes a list.
//!
//! implemented: src/resources/  ← absorveu src/resources.ts e src/references.ts (20/08)
//! depends_on:  src/resources/store.ts · src/shared/telemetry.ts
//! checks:      declared HERE, never imported. `check()` returns `Finding[]` and
//!              the runner reads it structurally, so a check costs no dependency.

/** What this system found rotten. Declared here rather than imported: the runner
 *  reads the shape, so owning a check costs no dependency on a hub. */
export interface Finding {
	path: string;
	says: string;
}

import type { Shared, UsageLogging } from "./shared";

// ─── CONFIG ─────────────────────────────────────────────────────────────────
// THE FACTS THIS SYSTEM RUNS ON, AS DATA. Everything below used to be a paragraph
// somewhere above a method, and a paragraph is a fact nothing can read: the mapping
// from a lens to its folders was prose, so `Launch.knows` could not be filled without
// somebody re-typing the list. A constant IS the documentation and the configuration
// at once — one place to argue with, one place to change, and `Object.keys()` away
// from being a menu in a UI.
//
// It lives in the INTERFACE and not in a `config.json` for the reason the whole folder
// exists: a contract that says `Kind` is a string and leaves the six real values in a
// file elsewhere has documented nothing.

/** The folders under `03_resources/`, and what each is FOR — the sentence is what
 *  stops a note being filed as a rule. Open at the edges: `Kind` stays `string`, so a
 *  folder somebody adds tomorrow arrives as itself instead of being filed as "other". */
export const KINDS = {
	references: "o que uma coisa É — o conceito, estável, citável por nome",
	notes: "o que se APRENDEU num dia, com a data — não envelhece bem de propósito",
	templates: "a forma que esta casa COPIA: landing, outline, call stack",
	rules: "o que é PROIBIDO, e o porquê ao lado",
	processes: "as fases, os portões, o que se decide em cada um",
} as const;

/** WHICH LENS READS WHAT, and which role loads which lens. Was three paragraphs; the
 *  paragraphs disagreed with each other twice before this became data.
 *
 *  THE FIRST VERSION OF THIS CONSTANT WAS ASPIRATIONAL, and measured on 20/08 the same
 *  day it was written: it named nine folders — `references/coding`, `design-system`,
 *  `qa`, `infra`, `product`, `design`, `voice`, `offers`, `clients` — and ZERO existed
 *  on disk. A constant that points at nothing is the same rot as prose pointing at
 *  nothing, only with syntax. What is below is what `03_resources/` HAS.
 *
 *  Every path is relative to `03_resources/`, and a FILE is as valid as a folder —
 *  `voice_tone` is one file inside a folder that is otherwise about notation.
 *
 *  `qa` reads the hacker lens and that is a COMPROMISE, not a mapping — the one who
 *  verifies is not one of the three H. The hustler side has no member at all, because
 *  nobody on this fleet sells. Written here rather than hidden, so the gap is a fact
 *  somebody can close instead of a silence somebody rediscovers.
 *
 *  `asks` is WHERE EACH SUB-QUESTION LOOKS, and it is data for the reason `reads` is:
 *  it was three doc comments, and a doc comment cannot be filtered. Two of them narrow
 *  by TERM instead of by folder (`hacker.gotchas`, `hacker.decisions`) because this
 *  house has no `gotchas/` folder and never had one — a trap with a known fix is a
 *  PARAGRAPH inside a page about something else. Inventing the folder to make the
 *  shape uniform would be inventing the data. */
export const LENSES = {
	hacker: {
		reads: [
			"references/clis",
			"references/scripts",
			"references/vscode",
			"references/macos",
			"references/claude_code",
			"references/google_workspace",
			"references/skills",
		],
		roles: ["coding", "qa"],
		asks: {
			// AS DUAS RÉGUAS SÃO ESTREITAS DE PROPÓSITO, e foram medidas contra as 18
			// páginas da lente em 20/08. `quebr|medido em|em vez de` casavam 8 a 10 delas
			// — nesta casa quase toda página conta um erro medido, então uma régua larga
			// devolve "quase tudo", que é o mesmo que não perguntar. As palavras abaixo
			// são as que esta casa usa quando está de fato marcando a coisa: 6 armadilhas
			// e 3 decisões.
			gotchas: { term: "armadilha|pegadinha|gotcha" },
			decisions: { term: "recusad|descartad|foi considerad" },
		},
	},
	hipster: {
		reads: ["references/cockpit", "templates/cockpit", "rules/design", "references/writing"],
		roles: ["product", "design"],
		asks: {
			product: { in: ["references/cockpit"] },
			system: { in: ["templates/cockpit", "rules/design"] },
			voice: { in: ["references/writing", "rules/design/voice_tone.md"] },
		},
	},
	hustler: {
		reads: ["references/hustler", "references/acme"],
		/** Empty ON PURPOSE: nobody on this fleet sells. */
		roles: [] as string[],
		asks: {
			offers: { in: ["references/hustler"] },
			promises: { in: ["references/acme"] },
		},
	},
} as const;

/** WHAT NO LENS CLAIMS, said out loud — a lens that reaches for a folder that is not
 *  hers is worse than an incomplete lens, and silence about the gap is how the reach
 *  happens. `references/system` is the biggest one on purpose: eleven pages about how
 *  THIS HOUSE works are the vocabulary of the system itself, not a reading of the
 *  world, and forcing them into one of the three H would make that lens mean "and also
 *  the manual". `notes`, `meetings`, `mukutu`, `project` and the rest of `rules/` and
 *  `templates/` are reached by `list(kind)` and `search`, which is the whole point of
 *  the store being one. */
export const NO_LENS = [
	"references/system",
	"notes",
	"meetings",
	"mukutu",
	"project",
	"rules (except rules/design)",
	"templates (except templates/cockpit)",
] as const;

/** THE STACK, WHERE IT IS KNOWLEDGE AND NOT A GUESS. Every agent that starts a project
 *  asks this, and the answer was living in a chat window: Next.js unless there is a
 *  reason, and the reason has to be said out loud. */
export const STACK = {
	web: "Next.js + HeroUI + Tailwind — o padrão, e desviar exige motivo escrito",
	cli: "commander — CLI puro, sem TUI",
	tui: "curses, como o Claude Code",
	db: "sqlite por padrão; surrealDB quando o dado é grafo de verdade",
	pkg: "bun",
} as const;

export declare namespace ResourceSystem {
	export namespace ValueObjects {
		/** The name, never the path — the path moves, the name is cited. */
		export type ResourceName = string;
		/** A key of `KINDS`, or anything else: open, because the folder somebody adds
		 *  tomorrow must arrive as itself. */
		export type Kind = keyof typeof KINDS | (string & {});
		/** A key of `LENSES`. Closed — a fourth H would be a different idea, not a new
		 *  value. */
		export type Lens = keyof typeof LENSES;
	}

	export namespace Entities {
		export interface Resource {
			name: ValueObjects.ResourceName;
			kind: ValueObjects.Kind;
			path: string;
			body: string;
			/** The other names it answers to, from `aliases:` in the front matter. Real,
			 *  and measured on 20/08: ONE page uses it (`askuser.md`, five names) and one
			 *  of those names — `interview` — is what the process vocabulary cites. An
			 *  alias creates no file, so there is still one page per subject. */
			aliases: ValueObjects.ResourceName[];
			/** Other resources it mentions. `my check references` walks these, and a
			 *  mention pointing at nothing is a rot finding — the one check that made
			 *  the old second verb worth keeping, now applied to all of them. */
			mentions: ValueObjects.ResourceName[];
		}
	}
}

/** THE THREE H — Hustler, Hacker, Hipster — as three READINGS of one store, never
 *  three stores. The same resource is read by different people asking different
 *  questions, and splitting the DATA by audience is how the same rule ends up written
 *  three times and drifts twice.
 *
 *  @see LENSES — who reads what, as data rather than as this paragraph. */
export interface Resources extends UsageLogging {
	/** Every `mentions` points at a resource that exists — the rot check the old `references` verb carried. */
	check(): Finding[];

	/** Many at once, in one call. */
	read(names: ResourceSystem.ValueObjects.ResourceName[]): ResourceSystem.Entities.Resource[];
	list(kind?: ResourceSystem.ValueObjects.Kind): ResourceSystem.Entities.Resource[];
	/** Case-insensitive over title and body. No index, no ranking — if it ever needs
	 *  those, the answer is a search engine. */
	search(term: string): ResourceSystem.Entities.Resource[];

	/** THE PROCESSES: the four phases, the rules, what is decided at each gate. One
	 *  process is one folder — `02_areas/00_workflows/<domain>/<NN>_<verb>/CONTEXT.md`,
	 *  named by the FOLDER — which is the only place in this house where a `CONTEXT.md`
	 *  IS the resource instead of the map to it.
	 *
	 *  `meta.ts` IS NOT DELETED. This line claimed it was, and `src/meta.ts` was on disk
	 *  the whole time (measured 20/08): it reads `META.md`, and folding it in is a
	 *  second migration with a second set of callers. Reading the process folders costs
	 *  nothing and duplicates nothing — `META.md` is generated from them. */
	processes(): ResourceSystem.Entities.Resource[];

	/** THE SHAPES THIS HOUSE COPIES: a landing, an outline, a call stack, the three
	 *  docs of a system design — `03_resources/templates/`.
	 *
	 *  `src/system_design/` IS NOT DELETED either, same measurement, same day. Reading a
	 *  template and WRITING the three files it shapes are different verbs; this one only
	 *  reads. The day the writer is folded in, it is one more subverb here, not a
	 *  sentence in this comment. */
	templates(): ResourceSystem.Entities.Resource[];

	/** KNOWLEDGE NOBODY OPENED since `since`. The deletion list for a folder that only
	 *  ever grows — the same argument `dead()` makes about verbs, applied to the thing
	 *  it is even easier to hoard. A reference nobody reads is not a safety net, it is
	 *  a search result that wastes somebody`s afternoon.
	 *
	 *  IT NEEDS THE READS TO BE LOGGED, which is why this interface extends
	 *  `UsageLogging`: `read([names])` opens a span per name, and `Use.what` holds the
	 *  resource name. One sink, two questions — verbs and knowledge. */
	unread(since: Shared.Instant): Shared.Use[];

	/** The three lenses. Same store, three questions. */
	hustler: Hustler;
	hacker: Hacker;
	hipster: Hipster;
}

/** WHAT IS THIS WORTH, AND TO WHOM. The business lens: offers, pricing, the client,
 *  the promise made and who it was made to. */
export interface Hustler {
	/** Everything this lens covers, so nobody has to guess which folders are "the
	 *  business ones". */
	all(): ResourceSystem.Entities.Resource[];

	/** What was promised to a client, and where it is written. The one question that
	 *  costs money when the answer is "somebody remembers". */
	promises(client?: string): ResourceSystem.Entities.Resource[];

	/** How this house prices and packages work. */
	offers(): ResourceSystem.Entities.Resource[];
}

/** HOW IT IS BUILT AND WHY IT BROKE. The technical lens: patterns, gotchas,
 *  measurements with dates, and the decisions that were argued and lost. */
export interface Hacker {
	all(): ResourceSystem.Entities.Resource[];

	/** A known trap with a known fix — the ones that cost a night once and must never
	 *  cost a second. */
	gotchas(about?: string): ResourceSystem.Entities.Resource[];

	/** What was decided, AND what was rejected beside it. The rejected half is the
	 *  part no code can be read to recover, which is why it is a first-class query. */
	decisions(): ResourceSystem.Entities.Resource[];
}

/** WHAT IS WORTH BUILDING AND HOW IT SHOULD FEEL. Product AND design in one lens,
 *  because separating them is how a house ends up with a beautiful thing nobody
 *  asked for and a useful thing nobody can stand to look at. */
export interface Hipster {
	all(): ResourceSystem.Entities.Resource[];

	/** WHAT TO BUILD AND FOR WHOM — the problems, the users, and the scope that was
	 *  cut. The cut half is the one nobody writes down and everybody re-proposes. */
	product(): ResourceSystem.Entities.Resource[];

	/** Tokens, components, layouts — what a screen is assembled from. */
	system(): ResourceSystem.Entities.Resource[];

	/** How this house WRITES: the voice, the words it refuses, the shape of a
	 *  sentence. Copy is design, and keeping it in the technical lens is how a product
	 *  ends up sounding like a changelog. */
	voice(): ResourceSystem.Entities.Resource[];
}
