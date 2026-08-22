//! THE REMOTE HALF OF `kanban/model.ts`: the `Human Review` policy, the card address,
//! the link a board declares, and what `check --remote` calls rotten.
//!
//! NO NETWORK. `guardMove`, `parseCardAddress` and `remoteFindings` are pure by
//! construction — that is exactly why the policy lives in `model.ts` and the popup
//! lives in `move.ts`. A rule that can only be proved by spending a GraphQL point and
//! opening a window on somebody's screen is a rule nobody re-proves after a refactor.

import { afterEach, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { store } from "../home/paths.ts";
import { HUMAN_REVIEW, guardMove, linkOf, parseCardAddress, refOf, remoteFindings } from "./model.ts";
import type { RemoteBoard, RemoteItem } from "./remote.ts";
import { FLOW, saveSnapshot } from "./remote.ts";

const REF = { owner: "zz-test-model", number: 998 };
const SNAP = join(store("kanban"), `${REF.owner}-${REF.number}.json`);

afterEach(() => {
	if (existsSync(SNAP)) rmSync(SNAP);
});

const item = (n: number, status?: string, extra: Partial<RemoteItem> = {}): RemoteItem => ({
	id: `PVTI_${n}`,
	status,
	kind: "Issue",
	number: n,
	title: `issue ${n}`,
	updated_at: "2026-08-21T10:00:00Z",
	...extra,
});

const board = (items: RemoteItem[]): RemoteBoard => ({
	ref: REF,
	project_id: "PVT_x",
	title: "test",
	url: "https://example.invalid",
	status_field_id: "PVTSSF_x",
	columns: FLOW.map((name, i) => ({ id: `opt${i}`, name })),
	items,
	truncated: false,
});

const says = (fs: { says: string }[], needle: string) => fs.filter((f) => f.says.includes(needle));

// ---------------------------------------------------------------------------
// `Human Review` — the column only Gabriel moves a card out of
// ---------------------------------------------------------------------------

test("moving INTO Human Review is free — it is what an agent does when it is done", () => {
	expect(guardMove("In Progress", HUMAN_REVIEW)).toEqual({ ok: true });
	expect(guardMove("Inbox", HUMAN_REVIEW)).toEqual({ ok: true });
});

test("moving OUT of Human Review is never `ok` — it is always a human gate", () => {
	for (const to of ["Inbox", "Todo", "In Progress", "Done"]) {
		const v = guardMove(HUMAN_REVIEW, to);
		expect(v).toHaveProperty("gate");
		expect(v).not.toHaveProperty("ok");
		// The gate is not a refusal: Gabriel may do it. It is `move.ts` that turns this
		// into a real question on a real screen, and an agent cannot answer it.
		expect((v as { gate: string }).gate).toContain("Gabriel");
	}
});

test("nothing reaches Done without passing Human Review", () => {
	expect(guardMove("Human Review", "Done")).toHaveProperty("gate");
	for (const from of ["Inbox", "Todo", "In Progress", undefined]) {
		const v = guardMove(from, "Done");
		expect(v).toHaveProperty("refuse");
		expect((v as { refuse: string }).refuse).toContain(HUMAN_REVIEW);
	}
});

test("the rest of the flow moves freely, and a move to where it already is is refused", () => {
	expect(guardMove("Inbox", "Todo")).toEqual({ ok: true });
	expect(guardMove("Todo", "In Progress")).toEqual({ ok: true });
	expect(guardMove("In Progress", "Todo")).toEqual({ ok: true });
	expect(guardMove(undefined, "Inbox")).toEqual({ ok: true });
	expect(guardMove("Todo", "Todo")).toHaveProperty("refuse");
});

// ---------------------------------------------------------------------------
// Addressing
// ---------------------------------------------------------------------------

test("a remote card is `<board>#<issue>`, and a local task label never looks like one", () => {
	expect(parseCardAddress("soulperuibe#57")).toEqual({ board: "soulperuibe", issue: 57 });
	expect(parseCardAddress("gh:biliboss/24#57")).toEqual({ board: "gh:biliboss/24", issue: 57 });
	expect(parseCardAddress("999_001_slug")).toBeUndefined();
	expect(parseCardAddress("#57")).toBeUndefined();
	expect(parseCardAddress("soulperuibe#abc")).toBeUndefined();
});

test("a local board name is remote ONLY when it declares a link and the caller asks", () => {
	// No fallback: answering a question about GitHub with the contents of a folder is
	// the silent wrong answer this returns `undefined` to avoid.
	expect(refOf("zz-board-that-does-not-exist", { remote: true })).toBeUndefined();
	expect(refOf("gh:biliboss/24")).toEqual({ owner: "biliboss", number: 24 });
	// `linkOf` reads the board's own config; an unlinked or missing board has none.
	expect(linkOf("zz-board-that-does-not-exist")).toBeUndefined();
});

// ---------------------------------------------------------------------------
// What is rotten
// ---------------------------------------------------------------------------

test("a card in Human Review is a finding — it is the queue in front of Gabriel", () => {
	const fs = remoteFindings(board([item(1, HUMAN_REVIEW), item(2, "Todo")]));
	expect(says(fs, "HUMAN REVIEW")).toHaveLength(1);
	expect(says(fs, "HUMAN REVIEW")[0]!.says).toContain("waiting on Gabriel");
});

test("a sub-issue is a finding: it nests under the parent and shows in no column", () => {
	const fs = remoteFindings(board([item(1, "Todo", { parent: 93 })]));
	expect(says(fs, "SUB-ISSUE")[0]!.says).toContain("#93");
});

test("STATUS LOST is the wipe, and the finding carries the command that undoes it", () => {
	saveSnapshot(board([item(1, "In Progress")]));
	// The Status field was recreated: the item is still there, pointing at an option id
	// that no longer exists, so GitHub reports no status at all and says nothing.
	const fs = remoteFindings(board([item(1)]));
	const lost = says(fs, "STATUS LOST");
	expect(lost).toHaveLength(1);
	expect(lost[0]!.says).toContain("In Progress");
	expect(lost[0]!.says).toContain(`my kanban move gh:${REF.owner}/${REF.number}#1 "In Progress"`);
});

test("a card that never had a status is NO STATUS, not a wipe", () => {
	const fs = remoteFindings(board([item(1)]));
	expect(says(fs, "NO STATUS")).toHaveLength(1);
	expect(says(fs, "STATUS LOST")).toHaveLength(0);
});

test("a card closed on GitHub outside Done never passed Human Review", () => {
	const fs = remoteFindings(board([item(1, "Inbox", { state: "CLOSED" }), item(2, "Done", { state: "CLOSED" })]));
	expect(says(fs, "never passed")).toHaveLength(1);
});

test("a board over one page says so instead of reporting a prefix as the whole", () => {
	const fs = remoteFindings({ ...board([item(1, "Todo")]), truncated: true });
	expect(says(fs, "TRUNCATED")).toHaveLength(1);
});
