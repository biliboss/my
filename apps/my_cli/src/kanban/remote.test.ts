//! The parts of the Projects v2 client that are LOGIC, not a round trip.
//!
//! NOTHING HERE TOUCHES THE NETWORK, and that is the point: every GraphQL call costs
//! from a 5000 points/hour budget shared with every other agent, and a suite that
//! spends it is a suite nobody can run twice. The live evidence — one read and one
//! write against project 24 — is in the task's own record, taken by hand.
//!
//! The snapshot store is the REAL one (`~/.me/kanban/`) under an owner nothing else
//! uses, written and swept in the same test. Same reason `teams/model.test.ts` uses
//! the real `~/.me/teams`: a fake path proves the fake path works.

import { afterEach, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { store } from "../home/paths.ts";
import {
	FLOW,
	HUMAN_REVIEW,
	type RemoteBoard,
	type RemoteItem,
	byColumn,
	columnByName,
	itemByIssue,
	parseRef,
	refuseIfDestructive,
	readSnapshot,
	refToString,
	saveSnapshot,
} from "./remote.ts";

const REF = { owner: "zz-test-owner", number: 999 };
const FILE = join(store("kanban"), `${REF.owner}-${REF.number}.json`);

afterEach(() => {
	if (existsSync(FILE)) rmSync(FILE);
});

const item = (n: number, status?: string, extra: Partial<RemoteItem> = {}): RemoteItem => ({
	id: `PVTI_${n}`,
	status,
	kind: "Issue",
	number: n,
	title: `issue ${n}`,
	...extra,
});

const board = (items: RemoteItem[], columns = [...FLOW]): RemoteBoard => ({
	ref: REF,
	project_id: "PVT_x",
	title: "test",
	url: "https://example.invalid",
	status_field_id: "PVTSSF_x",
	columns: columns.map((name, i) => ({ id: `opt${i}`, name })),
	items,
	truncated: false,
});

test("the flow is the measured one, and Human Review sits between the work and Done", () => {
	expect([...FLOW]).toEqual(["Inbox", "Todo", "In Progress", "Human Review", "Done"]);
	expect(FLOW.indexOf(HUMAN_REVIEW)).toBe(FLOW.indexOf("Done") - 1);
});

test("parseRef takes gh:<n> and gh:<owner>/<n>, and refuses anything else", () => {
	expect(parseRef("gh:biliboss/24")).toEqual({ owner: "biliboss", number: 24 });
	// A bare `gh:24` resolves the owner from the authenticated gh, which is a REST call;
	// asserting it here would make this test need the network. The shape is what matters.
	expect(parseRef("soulperuibe")).toBeUndefined();
	expect(parseRef("soulperuibe#57")).toBeUndefined();
	expect(parseRef("gh:abc")).toBeUndefined();
	expect(refToString({ owner: "biliboss", number: 24 })).toBe("gh:biliboss/24");
});

test("byColumn prints the flow in order and never drops a statusless card", () => {
	const b = board([item(1, "Done"), item(2, "Inbox"), item(3), item(4, "Human Review")]);
	expect(byColumn(b).map((g) => g.column)).toEqual(["Inbox", "Todo", "In Progress", "Human Review", "Done", "(no status)"]);
	// A card with no Status is in NO column and is invisible on the real board. Dropping
	// it here is how three items went missing on 21/08.
	expect(byColumn(b).at(-1)!.items.map((i) => i.number)).toEqual([3]);
});

test("a column the board added of its own comes after the flow, not silently dropped", () => {
	const b = board([item(1, "Blocked")], [...FLOW, "Blocked"]);
	const cols = byColumn(b).map((g) => g.column);
	expect(cols.at(-1)).toBe("Blocked");
	expect(byColumn(b).find((g) => g.column === "Blocked")!.items).toHaveLength(1);
});

test("a card is addressed by its ISSUE number, and a column by name, case-insensitively", () => {
	const b = board([item(57, "Todo")]);
	expect(itemByIssue(b, 57)!.id).toBe("PVTI_57");
	expect(itemByIssue(b, 58)).toBeUndefined();
	expect(columnByName(b, "human review")!.name).toBe("Human Review");
	expect(columnByName(b, "nope")).toBeUndefined();
});

test("the snapshot MERGES, so one read after the wipe does not destroy the evidence", () => {
	saveSnapshot(board([item(1, "In Progress"), item(2, "Todo")]));
	expect(readSnapshot(REF)!.status.PVTI_1!.column).toBe("In Progress");

	// `updateProjectV2Field` recreated the options: the items are still on the board and
	// still exist, they just point at ids that are gone. A plain overwrite here would
	// save "no column" over the only record of where they were.
	saveSnapshot(board([item(1), item(2)]));
	expect(readSnapshot(REF)!.status.PVTI_1!.column).toBe("In Progress");
	expect(readSnapshot(REF)!.status.PVTI_2!.column).toBe("Todo");
});

test("an item DELETED from the board is dropped from the snapshot — it was not wiped, it left", () => {
	saveSnapshot(board([item(1, "Todo"), item(2, "Todo")]));
	saveSnapshot(board([item(1, "Todo")]));
	expect(Object.keys(readSnapshot(REF)!.status)).toEqual(["PVTI_1"]);
});

test("the mutation that wiped two boards cannot be sent, and the safe one can", () => {
	// `updateProjectV2Field` RECREATES the single-select options with new ids and every
	// item pointing at the old ones loses its column in silence. Two boards on 21/08.
	expect(refuseIfDestructive("mutation{ updateProjectV2Field(input:{}){ __typename } }")).toContain("wiped two boards");
	expect(refuseIfDestructive("mutation{ deleteProjectV2Field(input:{}){ __typename } }")).toBeString();
	expect(refuseIfDestructive("mutation{ createProjectV2Field(input:{}){ __typename } }")).toBeString();
	// The one this module actually uses touches ONE item and no option definition.
	expect(refuseIfDestructive("mutation{ updateProjectV2ItemFieldValue(input:{}){ __typename } }")).toBeUndefined();
	expect(refuseIfDestructive("query{ viewer { login } }")).toBeUndefined();
});
