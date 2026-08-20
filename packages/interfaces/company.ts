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
//! depends_on:  packages/interfaces/shared.ts · packages/interfaces/kanban.ts
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

	/** Anything below the trio. Open, because the sub-processes are the part each company
	 *  owns; a closed set here would tell a house its way of working is invalid. */
	export type ProcessId = string;

	export interface Process {
		id: ProcessId;
		label: string;
		/** Absent only on the three. Everything else hangs off something. */
		parent?: ProcessId;
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
	 *  · `oversold`   claimed more than was delivered — `vender→entregar`
	 *  · `undersold`  delivered more than was claimed — the value is real and invisible,
	 *                 so it never becomes a reason to buy
	 *  · `unfelt`     delivered, closed, and nobody felt it — `entregar→amar`
	 *  · `unclaimed`  loved, and never sold again — `amar→vender`, the tear that reads
	 *                 like nothing is wrong, because nothing broke */
	export type Tear = "oversold" | "undersold" | "unfelt" | "unclaimed";

	/** ONE TEAR, WITH THE THREE SENTENCES SIDE BY SIDE. The evidence is quoted, never
	 *  summarised: a gap that arrives as a number has already lost the thing that would
	 *  let somebody fix it. */
	export interface Gap {
		seam: Seam;
		tear: Tear;
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
