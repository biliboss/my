//! THE REMOTE BOARD — GitHub Projects v2, over GraphQL, because there is no other way.
//!
//! REST has no board and no Status field. Projects v2 exists ONLY in the GraphQL API,
//! so every call here is `gh api graphql` and every one of them spends from the SAME
//! 5000 points/hour that every agent and the dashboard also spend from. That budget
//! hit zero on 21/08 with 30-second polling across three boards, which is why every
//! exported function below carries its MEASURED cost in its docstring and why not one
//! of them may be called from a loop.
//!
//! MEASURED 21/08 with `rateLimit { cost nodeCount }` inside the query itself:
//! `readBoard()` on project 24 (26 items, `items(first:100)`) → `cost: 1`,
//! `nodeCount: 100`. One board read is ONE point, and it already carries the project
//! id, the Status field id, every option id and every item. Splitting it into
//! `gh project field-list` + `gh project item-list` — which is what `today boards`
//! did — costs two.
//!
//! ## THE TRAP THAT WIPED TWO BOARDS
//!
//! `updateProjectV2Field` does not edit options — it RECREATES them with NEW ids, and
//! every item still pointing at an old id loses its Status SILENTLY. No error, no
//! event, the cards simply fall out of every column. It took two boards on 21/08.
//! `graphql()` below REFUSES to send it, and the refusal is the enforcement: this
//! module cannot rename, add or delete a column, only move cards between the columns
//! that exist. Whoever needs to edit the field does it in the web UI, after
//! `my kanban list <board> --remote` has written the snapshot that makes the wipe
//! recoverable.
//!
//! ## WHY NO ID IS EVER READ FROM A FILE
//!
//! `_today/.gh_projects.jsonl` cached `project_id`, `status_field_id` and all five
//! option ids, and its own header admitted they rot: *"option ids for a board change
//! whenever anyone edits the Status field"*. A cached option id is how a move lands a
//! card in a column that no longer exists. So the only durable coordinates stored
//! anywhere are OWNER and NUMBER — a URL a human can type — and everything volatile is
//! re-read by `readBoard()` on every single command.
//!
//! ## SUB-ISSUES ARE INVISIBLE
//!
//! An issue with a parent nests UNDER the parent in the board view and disappears from
//! the columns — three items vanished this way on 21/08. `addIssue()` refuses one, and
//! `RemoteItem.parent` is what lets `check` name the ones already there.
//!
//! depends_on: gh(1) with `project` scope
//! impacts:    src/kanban/model.ts · src/kanban/list.ts · src/kanban/move.ts · src/kanban/add.ts · src/kanban/check.ts

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { store } from "../home/paths.ts";

/** THE FLOW, in order. `Inbox → Todo → In Progress → Human Review → Done`.
 *
 *  These are the option NAMES of the `Status` single-select field, and they are the
 *  only thing about a board this house hardcodes — the ids behind them are read live.
 *  The list is ordered because a board printed in hash order is a board nobody can
 *  read, and because `Done` being last is what makes "did it pass Human Review?"
 *  answerable by comparing two indices. */
export const FLOW = ["Inbox", "Todo", "In Progress", "Human Review", "Done"] as const;
export type FlowColumn = (typeof FLOW)[number];

/** THE COLUMN ONLY GABRIEL MOVES A CARD OUT OF. Everything an agent produces parks
 *  here and stops. The rule is enforced in `src/kanban/move.ts`, not here: this module
 *  is the wire, and a wire that decides policy is a wire nobody can reuse. */
export const HUMAN_REVIEW: FlowColumn = "Human Review";
export const INTAKE: FlowColumn = "Inbox";
export const DONE: FlowColumn = "Done";

export type RemoteRef = { owner: string; number: number };

export type RemoteColumn = { id: string; name: string };

/** ONE CARD ON THE REMOTE BOARD.
 *
 *  `id` is the PROJECT ITEM id (`PVTI_…`), not the issue id, and that distinction is
 *  the one that costs a day: field values — Status included — live on the ITEM. Read
 *  the issue and you see none of them. Two items on two boards can point at one issue
 *  and hold two different Statuses, and both are true.
 *
 *  `status` is the raw option NAME as GitHub returned it, never narrowed to `FlowColumn`:
 *  the enum stays open, so a column somebody adds in the web UI shows up as itself
 *  instead of being dropped on the floor. */
export type RemoteItem = {
	id: string;
	status?: string;
	statusOptionId?: string;
	kind: "Issue" | "PullRequest" | "DraftIssue" | "unknown";
	number?: number;
	title: string;
	url?: string;
	state?: string;
	/** The parent issue's number when this is a SUB-ISSUE — which means it does not
	 *  render in any column. */
	parent?: number;
	updated_at?: string;
};

export type RemoteBoard = {
	ref: RemoteRef;
	project_id: string;
	title: string;
	url: string;
	status_field_id: string;
	columns: RemoteColumn[];
	items: RemoteItem[];
	/** True when the board holds more than one page. Everything downstream is then
	 *  reading a PREFIX of the board, and says so rather than reporting a short count
	 *  as the truth. */
	truncated: boolean;
};

// ============================================================================
// The wire
// ============================================================================

/** Mutations that RECREATE a single-select field's options and silently orphan every
 *  item pointing at the old ids. Sending one costs two boards; it cost exactly that on
 *  21/08. Nothing in this house has a reason to reach them — moving a card uses
 *  `updateProjectV2ItemFieldValue`, which touches one item and no option id. */
const FORBIDDEN = ["updateProjectV2Field", "deleteProjectV2Field", "createProjectV2Field"];

function gh(args: string[]): string {
	try {
		return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
	} catch (e) {
		const err = e as { stdout?: string; stderr?: string };
		const out = `${err?.stdout ?? ""}${err?.stderr ?? ""}`.trim();
		// The rate limit is the most common failure here and the easiest to mistake for
		// "it does not exist" — an exhausted budget and a missing board both come back
		// as an empty-ish error. Name it.
		if (/rate limit|API rate limit exceeded/i.test(out))
			throw new Error("GitHub GraphQL budget is exhausted — `gh api rate_limit --jq .resources.graphql`. It is 5000 points/hour SHARED with every other agent.");
		throw new Error(out || String(e));
	}
}

/** The refusal, as a function, so it can be proved without spending a point. Returns
 *  the reason when the query must not be sent, `undefined` when it may. */
export function refuseIfDestructive(query: string): string | undefined {
	for (const m of FORBIDDEN)
		if (query.includes(m))
			return `refused: \`${m}\` recreates the Status options with new ids and every card loses its column silently (it wiped two boards on 21/08). Edit the field in the web UI, after \`my kanban list <board> --remote\` has taken the snapshot.`;
	return undefined;
}

function graphql(query: string, vars: Record<string, string | number> = {}): unknown {
	const no = refuseIfDestructive(query);
	if (no) throw new Error(no);
	const args = ["api", "graphql", "-f", `query=${query}`];
	for (const [k, v] of Object.entries(vars)) args.push("-F", `${k}=${v}`);
	return JSON.parse(gh(args)) as unknown;
}

/** WHOSE PROJECTS, when the address did not say. Resolved from the authenticated `gh`,
 *  never hardcoded — the old registry pinned `biliboss` in prose and every command that
 *  forgot `--owner` put its item on somebody else's board.
 *
 *  NO ENV OVERRIDE, on purpose: `gh:biliboss/24` already spells the owner out, and a
 *  second way to say the same thing is a second thing to get wrong silently.
 *
 *  COSTS NOTHING FROM THE GRAPHQL BUDGET: `gh api user` is REST, which has its own
 *  5000/hour. Memoised per process anyway, because a verb may resolve twice. */
let cachedOwner: string | undefined;
export function owner(): string {
	cachedOwner ??= gh(["api", "user", "--jq", ".login"]);
	return cachedOwner;
}

/** `gh:24` · `gh:biliboss/24` — the address of a board that has no folder in this
 *  house. Anything else is not a remote address, and `undefined` says so rather than
 *  throwing: callers use this to DECIDE which of the two boards they were handed. */
export function parseRef(s: string): RemoteRef | undefined {
	const m = /^gh:(?:([^/]+)\/)?(\d+)$/.exec(s.trim());
	if (!m) return undefined;
	return { owner: m[1] || owner(), number: Number(m[2]) };
}

export const refToString = (r: RemoteRef) => `gh:${r.owner}/${r.number}`;

// ============================================================================
// Reads
// ============================================================================

const BOARD_QUERY = `
query($owner:String!, $number:Int!){
  user(login:$owner){
    projectV2(number:$number){
      id title url
      field(name:"Status"){ ... on ProjectV2SingleSelectField { id options { id name } } }
      items(first:100){
        totalCount
        pageInfo{ hasNextPage }
        nodes{
          id updatedAt
          fieldValueByName(name:"Status"){ ... on ProjectV2ItemFieldSingleSelectValue { name optionId } }
          content{
            __typename
            ... on Issue { number title url state parent { number } }
            ... on PullRequest { number title url state }
            ... on DraftIssue { title }
          }
        }
      }
    }
  }
}`;

/** THE WHOLE BOARD IN ONE CALL — project id, Status field id, every option id, and up
 *  to 100 items with their column.
 *
 *  **COST: 1 point** (measured 21/08 on project 24: `cost: 1`, `nodeCount: 100`).
 *  NEVER call this in a loop, and never on a timer. Three boards polled every 30s is
 *  360 points/hour of pure polling, and that is what emptied the budget on 21/08.
 *
 *  Every read also writes the snapshot — see `saveSnapshot`. */
export function readBoard(ref: RemoteRef): RemoteBoard {
	const raw = graphql(BOARD_QUERY, { owner: ref.owner, number: ref.number }) as {
		data?: { user?: { projectV2?: Record<string, any> | null } | null };
		errors?: { message: string }[];
	};
	if (raw.errors?.length) throw new Error(raw.errors.map((e) => e.message).join("; "));
	const p = raw.data?.user?.projectV2;
	if (!p) throw new Error(`no project ${refToString(ref)} — \`gh project list --owner ${ref.owner}\``);
	if (!p.field?.id) throw new Error(`project ${refToString(ref)} has no single-select field named \`Status\` — without it there are no columns, only a list.`);

	const items: RemoteItem[] = (p.items?.nodes ?? []).map((n: any): RemoteItem => ({
		id: n.id,
		status: n.fieldValueByName?.name,
		statusOptionId: n.fieldValueByName?.optionId,
		kind: n.content?.__typename === "Issue" || n.content?.__typename === "PullRequest" || n.content?.__typename === "DraftIssue" ? n.content.__typename : "unknown",
		number: n.content?.number,
		title: String(n.content?.title ?? ""),
		url: n.content?.url,
		state: n.content?.state,
		parent: n.content?.parent?.number,
		updated_at: n.updatedAt,
	}));

	const board: RemoteBoard = {
		ref,
		project_id: p.id,
		title: p.title,
		url: p.url,
		status_field_id: p.field.id,
		columns: (p.field.options ?? []).map((o: any) => ({ id: o.id, name: o.name })),
		items,
		truncated: Boolean(p.items?.pageInfo?.hasNextPage),
	};
	saveSnapshot(board);
	return board;
}

/** The boards this owner has, without their items. **COST: 1 point.** Answers "which
 *  number is that board" so nobody has to keep a registry file that goes stale. */
export function listProjects(who = owner()): { number: number; title: string; url: string }[] {
	const raw = graphql(
		`query($owner:String!){ user(login:$owner){ projectsV2(first:50, orderBy:{field:NUMBER, direction:DESC}){ nodes{ number title url closed } } } }`,
		{ owner: who },
	) as { data?: { user?: { projectsV2?: { nodes?: any[] } } } };
	return (raw.data?.user?.projectsV2?.nodes ?? [])
		.filter((n) => !n.closed)
		.map((n) => ({ number: n.number, title: n.title, url: n.url }));
}

/** The item on this board whose ISSUE number is `n`. The card address a human types is
 *  `<board>#57`, because the issue number is what is printed everywhere else; the
 *  `PVTI_…` item id is an implementation detail nobody should have to carry. */
export const itemByIssue = (b: RemoteBoard, n: number): RemoteItem | undefined =>
	b.items.find((i) => i.number === n);

export const columnByName = (b: RemoteBoard, name: string): RemoteColumn | undefined =>
	b.columns.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());

/** The board grouped by column, in `FLOW` order, with any column the board added of
 *  its own after them, and the statusless last. A card with no Status is in NO column
 *  and is invisible on the real board — it gets its own bucket rather than being
 *  quietly dropped, which is how three items went missing on 21/08. */
export function byColumn(b: RemoteBoard): { column: string; items: RemoteItem[] }[] {
	const order = [...b.columns.map((c) => c.name)].sort((a, c) => {
		const ia = FLOW.indexOf(a as FlowColumn);
		const ic = FLOW.indexOf(c as FlowColumn);
		return (ia < 0 ? FLOW.length : ia) - (ic < 0 ? FLOW.length : ic);
	});
	const out = order.map((column) => ({ column, items: b.items.filter((i) => i.status === column) }));
	const orphans = b.items.filter((i) => !i.status || !order.includes(i.status));
	if (orphans.length) out.push({ column: "(no status)", items: orphans });
	return out;
}

// ============================================================================
// Writes
// ============================================================================

/** Move one card to one column. **COST: 1 point** — plus the 1 of the `readBoard()`
 *  the caller already paid to resolve the item and the option id.
 *
 *  `updateProjectV2ItemFieldValue` touches ONE item and no option definition, which is
 *  what makes it safe where `updateProjectV2Field` is not. */
export function setStatus(b: RemoteBoard, itemId: string, column: string): RemoteColumn {
	const opt = columnByName(b, column);
	if (!opt) throw new Error(`no column \`${column}\` on ${refToString(b.ref)} — it has: ${b.columns.map((c) => c.name).join(", ")}`);
	graphql(
		`mutation($project:ID!, $item:ID!, $field:ID!, $option:String!){
  updateProjectV2ItemFieldValue(input:{projectId:$project, itemId:$item, fieldId:$field, value:{singleSelectOptionId:$option}}){ projectV2Item { id } }
}`,
		{ project: b.project_id, item: itemId, field: b.status_field_id, option: opt.id },
	);
	return opt;
}

/** An issue as GitHub knows it, from `owner/repo#57` or from its URL. **COST: 1 point.**
 *  Reads `parent` in the same breath, because an issue that has one must never be put
 *  on a board — see `addIssue`. */
export function issueByAddress(address: string): { id: string; number: number; title: string; url: string; parent?: number } {
	const m =
		/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/.exec(address.trim()) ??
		/^([^/\s]+)\/([^#\s]+)#(\d+)$/.exec(address.trim());
	if (!m) throw new Error(`not an issue address: \`${address}\` — use \`owner/repo#57\` or the full issue URL`);
	const raw = graphql(
		`query($owner:String!, $repo:String!, $number:Int!){ repository(owner:$owner, name:$repo){ issue(number:$number){ id number title url parent { number } } } }`,
		{ owner: m[1]!, repo: m[2]!, number: Number(m[3]) },
	) as { data?: { repository?: { issue?: any } } };
	const i = raw.data?.repository?.issue;
	if (!i) throw new Error(`no issue ${address}`);
	return { id: i.id, number: i.number, title: i.title, url: i.url, parent: i.parent?.number };
}

/** Put an issue on the board, landing in `Inbox`. **COST: 3 points** — 1 to resolve the
 *  issue (and its parent), 1 for `addProjectV2ItemById`, 1 for the Status.
 *
 *  REFUSES A SUB-ISSUE. GitHub nests it under its parent and it renders in NO column;
 *  three items disappeared from view that way on 21/08. Items stay FLAT here. */
export function addIssue(b: RemoteBoard, address: string, column: string = INTAKE): { item: string; issue: number; column: RemoteColumn } {
	const issue = issueByAddress(address);
	if (issue.parent)
		throw new Error(`#${issue.number} is a SUB-ISSUE of #${issue.parent} — on a board it nests under the parent and shows in no column at all. Detach it first, or put #${issue.parent} on the board instead.`);
	const existing = itemByIssue(b, issue.number);
	if (existing) throw new Error(`#${issue.number} is already on ${refToString(b.ref)}, in \`${existing.status ?? "(no status)"}\` — \`my kanban move ${refToString(b.ref)}#${issue.number} <column>\``);
	const raw = graphql(
		`mutation($project:ID!, $content:ID!){ addProjectV2ItemById(input:{projectId:$project, contentId:$content}){ item { id } } }`,
		{ project: b.project_id, content: issue.id },
	) as { data?: { addProjectV2ItemById?: { item?: { id: string } } } };
	const item = raw.data?.addProjectV2ItemById?.item?.id;
	if (!item) throw new Error(`the board accepted nothing for ${address}`);
	return { item, issue: issue.number, column: setStatus(b, item, column) };
}

// ============================================================================
// The snapshot — the only thing that survives the field being recreated
// ============================================================================
//
// WHY EVERY READ WRITES IT, instead of a `--snapshot` flag. The wipe is silent and
// instantaneous: the moment somebody edits the Status field in the web UI, the mapping
// from item to column is gone from GitHub AND from every screen. A snapshot you have
// to remember to take is not there on the one day it matters. Writing it is a local
// file write on a read that already happened — no extra call, no extra point.
//
// It lives in `~/.me/kanban/` and NOT in the repo: it is a cache of somebody else's
// state, and a stale copy committed into the house would become the second truth this
// module exists to avoid. It is never read to answer "which column is this card in" —
// only to answer "which column did this card USED to be in", which is a different
// question and the only one GitHub can no longer answer after a wipe.

export type SnapshotEntry = { column: string; issue?: number; title: string; seen_at: string };
export type Snapshot = { ref: RemoteRef; at: string; status: Record<string, SnapshotEntry> };

const snapshotFile = (ref: RemoteRef) => join(store("kanban"), `${ref.owner}-${ref.number}.json`);

/** MERGES, never overwrites — and that is the whole point. A plain overwrite would
 *  destroy the evidence one read after the wipe: the first `list` run after somebody
 *  recreated the field would save "these 26 items have no column" over the only record
 *  of where they were. So an item that still exists on the board KEEPS its last known
 *  column, and only an item deleted from the board is dropped. */
export function saveSnapshot(b: RemoteBoard): void {
	const previous = readSnapshot(b.ref)?.status ?? {};
	const live = new Set(b.items.map((i) => i.id));
	const status: Snapshot["status"] = {};
	for (const [id, e] of Object.entries(previous)) if (live.has(id)) status[id] = e;
	const at = new Date().toISOString();
	for (const i of b.items) if (i.status) status[i.id] = { column: i.status, issue: i.number, title: i.title, seen_at: at };
	const snap: Snapshot = { ref: b.ref, at, status };
	try {
		mkdirSync(store("kanban"), { recursive: true });
		writeFileSync(snapshotFile(b.ref), JSON.stringify(snap, null, 2));
	} catch {
		// A snapshot that cannot be written must never fail the read that produced it —
		// the same rule `today.ts` took for its usage log. The loss shows up as a missing
		// snapshot in `check`, which is exactly where it should be visible.
	}
}

export function readSnapshot(ref: RemoteRef): Snapshot | undefined {
	const f = snapshotFile(ref);
	if (!existsSync(f)) return undefined;
	try {
		return JSON.parse(readFileSync(f, "utf8")) as Snapshot;
	} catch {
		return undefined;
	}
}
