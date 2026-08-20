//! `company` — DRAFT. Three processes, and the joints where companies actually die.
//!
//! ── THE THEORY IS NOT THE CONTRIBUTION ───────────────────────────────────────
//!
//! *Vender o que entrega · entregar o que vendeu · ser amado pelo que entregou.*
//! That frame is the landing's, and a page says it better than a type ever will. What
//! this file adds is the sentence printed underneath it:
//!
//!     Empresas não morrem de falta de ideia. Morrem NA JUNÇÃO entre o que foi
//!     prometido, o que foi entregue e o que foi sentido por quem pagou.
//!
//! So the load-bearing noun here is not `Process` — it is `Seam`. A contract whose main
//! noun is the process is an org chart with types bolted on: every company already owns
//! one, and not one of them has ever caught the failure. Nobody oversells inside sales.
//! They oversell *at the handoff*, where the claim stops being watched.
//!
//! ── THE RING, NOT THE LINE ───────────────────────────────────────────────────
//!
//! `amar` is not the end of a pipeline. What somebody FELT is what the next sale can
//! honestly claim, and drawing it as a line is why "customer success" reads as a cost
//! centre in every company that draws it that way. Closed back into `vender`, it is the
//! only one of the three that compounds.
//!
//! Three processes, THREE seams. The third is the one nobody staffs.
//!
//! ── THE SECOND AXIS: HIPSTER · HUSTLER · HACKER ──────────────────────────────
//!
//! The README calls the trio *lineage* and says this project moves "one level over,
//! from the profiles of the PEOPLE to the processes of the COMPANY". Read as a
//! replacement, that sentence throws the trio away. Read as a rotation, it does not —
//! and the rotation is the useful reading:
//!
//!     the three processes are what a company DOES.
//!     the three H are what every one of them is MADE OF.
//!
//! Orthogonal, so it is a 3×3 and never a list of six. `vender` still needs a hacker —
//! somebody has to be able to build the thing being promised — and `entregar` still
//! needs a hipster or it ships correct and unloved.
//!
//! AND THIS IS WHAT MAKES THE TRIO LOAD-BEARING INSTEAD OF DECORATIVE: every tear at
//! every seam is an ABSENCE of one role. `Tear` and `Role` are the same fact read from
//! two sides — which is why `Gap` carries `missing` and it is not optional.
//!
//! A ROLE IS NOT A TEAM, A FOLDER OR A PACKAGE. `resources.ts` already refused this
//! one level down — *"three READINGS of one store, never three stores"* — and the
//! refusal holds here for the same reason: split the company BY audience and the same
//! promise gets written three times and drifts twice.
//!
//! `packages/my-hacker` was that mistake, made and buried on the same day (20/08): a
//! lens had become a package, with its own `package.json` and its own store. It is
//! deleted, not deprecated — zero consumers, and the experiment it carried (Resource
//! addressed by the SHA-1 of its own text) belongs to `resources`, not to a trio
//! member. `git show 1531af7` is where it lives now.
//!
//! ── WHAT IS CLOSED, AND WHY THAT IS THE CLAIM ────────────────────────────────
//!
//! `Trio` is a CLOSED union — the only closed one in this file. Refusing a fourth member
//! IS the theory; a `Trio` that accepts `"financeiro"` has stopped being an argument and
//! become a folder. Everything below level 1 is open, because *o seu jeito é o produto*:
//! a house declares its own sub-processes and this contract must never hold the list.
//!
//! THE IDS STAY PORTUGUESE. `vender` · `entregar` · `amar` are already rendered in the
//! live graph and read by whoever saw the page. Translating them here would fork the
//! vocabulary across two artefacts that describe one idea.
//!
//! ── WHY THERE IS NO CODE UNDER THIS YET ──────────────────────────────────────
//!
//! The landing came before the project ON PURPOSE — that is the repository's own thesis,
//! and this file is the second artefact, not a retrofit. `apps/my-company/` is empty
//! today and the emptiness is the argument.
//!
//! external:    nothing — the theory runs on files this house writes
//! implemented: nothing
//! planned:     apps/my-company/
//! depends_on:  packages/interfaces/shared.ts · packages/interfaces/kanban.ts ·
//!              packages/interfaces/resources.ts
//! buries:      packages/my-hacker/ — a lens that had become a package (20/08)
//! checks:      declared HERE, never imported. `check()` returns `Finding[]` and the
//!              runner reads the shape, so owning a check costs no dependency.

/** What this system found rotten. Declared here rather than imported: the runner reads
 *  the shape, so owning a check costs no dependency on a hub. */
export interface Finding {
	path: string;
	says: string;
}

import type { Shared } from "./shared";

export declare namespace CompanySystem {
	/** THE ONLY CLOSED UNION HERE. A fourth member is not an extension, it is a
	 *  different theory — and the moment `Trio` accepts one, this file stops arguing
	 *  anything and becomes a list of departments. */
	export type Trio = "vender" | "entregar" | "amar";

	/** THE SECOND AXIS, and closed for the same reason `Trio` is: three is the claim.
	 *
	 *  THE WORD IS `role` BECAUSE O2 ALREADY USES IT — there, work is *"addressed to a
	 *  role, never to an agent"*, and the graph carries an `o2:role` node. A second word
	 *  for the same unit is a fork of the vocabulary, not a synonym.
	 *
	 *  Lineage: popularised by Reid Hoffman; the one peer-reviewed anchor is Rudic,
	 *  Hübner & Baum, *Journal of Business Venturing Insights* 15 (2021). It is a
	 *  practitioner framework, NOT a standardised academic construct — worth saying here
	 *  so nobody later cites this file as evidence it is one.
	 *
	 *  · `hustler` — what it is worth, and to whom. The offer, the price, the promise.
	 *  · `hacker`  — whether it can be built, and why it broke last time.
	 *  · `hipster` — whether it is worth building, and how it should feel. */
	export type Role = "hustler" | "hacker" | "hipster";

	/** Anything below the trio. Open, because the sub-processes are the part each company
	 *  owns; a closed set here would tell a house its way of working is invalid. */
	export type ProcessId = string;

	export interface Process {
		id: ProcessId;
		label: string;
		/** Absent only on the three. Everything else hangs off something. */
		parent?: ProcessId;
		/** WHICH ROLE CARRIES IT. One, not a list: a sub-process that leans on all three
		 *  equally has not been cut finely enough, and "everyone owns it" is the shape
		 *  ownership takes right before nobody does. Absent on the three — a process is
		 *  made of all three by definition, which is the whole 3×3. */
		role?: Role;
		/** Written by this house rather than adopted from the shipped set. These are the
		 *  ones worth reading first — the rest are everybody's. */
		own: boolean;
	}

	/** WHERE TWO PROCESSES TOUCH. The three of them, and the third is the one nobody
	 *  staffs — which is exactly why referral revenue is always somebody's side project. */
	export type Seam =
		| "vender→entregar"
		| "entregar→amar"
		| "amar→vender";

	/** WHAT SELLING EMITTED — and a claim that cannot be checked is not a claim, it is a
	 *  mood. `checkedBy` is required for that reason: it names the observable that will
	 *  later say whether this was true, and it is written BEFORE the sale closes, by the
	 *  person making the promise. Written after, it is always written to pass. */
	export interface Claim {
		id: string;
		/** What the buyer was told, in the buyer's words. Short because a promise nobody
		 *  can repeat back is a promise nobody can hold you to. */
		says: Shared.ValueObjects.GrammarStyle.Words<25>;
		checkedBy: string;
		at: Shared.Instant;
	}

	/** WHAT DELIVERY CLOSED. It points at the claim on purpose: work that closes no claim
	 *  is either a gift or a misunderstanding, and the two are worth telling apart. */
	export interface Delivered {
		claim: Claim["id"];
		/** The kanban card that did it. Delivery is not modelled twice. */
		card?: string;
		at: Shared.Instant;
	}

	/** WHAT THE PAYER FELT, which is not what was delivered and not what was promised.
	 *  Kept as its own noun so the gap can be named instead of averaged into a score. */
	export interface Felt {
		claim: Claim["id"];
		says: Shared.ValueObjects.GrammarStyle.Words<25>;
		/** `-1 | 0 | 1`. Three values because a 0–10 scale invites a dashboard, and a
		 *  dashboard is how a company stops reading the sentence. */
		sign: -1 | 0 | 1;
		at: Shared.Instant;
	}

	/** THE FOUR WAYS A SEAM TEARS. Each belongs to exactly one seam, and the fourth is the
	 *  reason the ring exists:
	 *
	 *  · `oversold`   claimed more than was delivered — `vender→entregar`, and the role
	 *                 that was absent is `hacker`: the promise outran what is buildable
	 *  · `undersold`  delivered more than was claimed — `hustler` missing: the value is
	 *                 real, invisible, and never becomes a reason to buy
	 *  · `unfelt`     delivered, closed, and nobody felt it — `entregar→amar`, `hipster`
	 *                 missing: correct and unloved is a shipped product with no second sale
	 *  · `unclaimed`  loved, and never sold again — `amar→vender`, `hustler` missing. The
	 *                 tear that reads like nothing is wrong, because nothing broke */
	export type Tear = "oversold" | "undersold" | "unfelt" | "unclaimed";

	/** ONE TEAR, WITH THE THREE SENTENCES SIDE BY SIDE. The evidence is quoted, never
	 *  summarised: a gap that arrives as a number has already lost the thing that would
	 *  let somebody fix it. */
	export interface Gap {
		seam: Seam;
		tear: Tear;
		/** WHICH ROLE WAS ABSENT. Required, and derivable from `tear` — it is stated
		 *  anyway because the name of the tear says what happened and this says who was
		 *  not in the room, and only the second one can be fixed on Monday. */
		missing: Role;
		claim: Claim["id"];
		promised: string;
		delivered?: string;
		felt?: string;
	}
}

/** `my company <verb>`. The three processes are read-only vocabulary; the verbs are all
 *  about the joints between them. */
export interface Company {
	check(): Finding[];

	/** The tree, three roots deep by default. `own` first — the shipped sub-processes are
	 *  everybody's, and reading somebody else's list teaches nothing about this house. */
	processes(under?: CompanySystem.Trio): CompanySystem.Process[];

	/** Declares a sub-process this house wrote. THE VERB IS `own`, NOT `add`: the page
	 *  says *o seu jeito é o produto*, and a house that only adopts the shipped set has
	 *  bought a template rather than described itself. */
	own(parent: CompanySystem.ProcessId, label: string): CompanySystem.Process;

	/** Records the promise, and REFUSES a claim with no `checkedBy`. That refusal is the
	 *  whole point of the noun: an unverifiable promise costs nothing to make, which is
	 *  precisely why it gets made under pressure. */
	claim(says: string, checkedBy: string): CompanySystem.Claim;

	/** Closes a claim with the work that answered it. */
	deliver(claim: CompanySystem.Claim["id"], card?: string): CompanySystem.Delivered;

	/** Records what the payer said, in their words. Quoted, never scored. */
	felt(claim: CompanySystem.Claim["id"], says: string, sign: -1 | 0 | 1): CompanySystem.Felt;

	/** WHERE IT IS TEARING RIGHT NOW — the one verb worth running on a Monday. Empty is a
	 *  real answer and the common one early, when there are too few claims to tear. */
	gaps(seam?: CompanySystem.Seam): CompanySystem.Gap[];

	/** Hands the tree to `my-graph` as a folder of contracts, so the company is drawn by
	 *  the same extractor that draws the code. One picture, one renderer: a company that
	 *  needs a second drawing tool has two truths about its own shape. */
	graph(): { root: string };
}
