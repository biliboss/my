import { expect, test } from "bun:test";
import type { UsageLogging as ContractUsageLogging } from "../../01_projects/my-teams-v1/interfaces/shared.ts";
import {
  MemorySpanSink,
  Telemetry,
  type TelemetryClock,
} from "./telemetry.ts";

function fixture() {
  let tick = 0;
  let id = 0;
  let day = 20;
  const clock: TelemetryClock & { nextDay(): void } = {
    wall: () => new Date(`2026-08-${String(day).padStart(2, "0")}T10:00:00.000Z`),
    monotonic: () => tick++ * 10,
    id: () => `span-${++id}`,
    nextDay: () => day++,
  };
  const telemetry = new Telemetry(new MemorySpanSink(), clock);
  const contract: ContractUsageLogging = telemetry;
  void contract;
  return { telemetry, clock };
}

test("around preserves a synchronous result and emits one terminal span", () => {
  const { telemetry } = fixture();
  const result = telemetry.around("tasks.new", "human", () => 42);

  expect(result).toBe(42);
  expect(telemetry.spans()).toEqual([{
    id: "span-1",
    verb: "tasks.new",
    at: "2026-08-20T10:00:00.000Z",
    took: 10,
    outcome: "ok",
    by: "human",
  }]);
});

test("around preserves async resolve and rejection semantics", async () => {
  const { telemetry } = fixture();
  await expect(telemetry.around("tasks.done", "alice", async () => "done")).resolves.toBe("done");
  const failure = new Error("proof failed");
  await expect(telemetry.around("tasks.done", "alice", async () => { throw failure; })).rejects.toBe(failure);

  expect(telemetry.spans().map((span) => span.outcome)).toEqual(["ok", "failed"]);
  expect(telemetry.spans().at(-1)?.says).toBe("proof failed");
});

test("outcome classifier records a healthy refusal", () => {
  const { telemetry } = fixture();
  const result = telemetry.around(
    "tasks.claim",
    "bob",
    () => ({ ok: false as const }),
    { outcome: (value) => value.ok ? "ok" : "refused" },
  );

  expect(result.ok).toBeFalse();
  expect(telemetry.spans()[0].outcome).toBe("refused");
});

test("catalogue makes never-called subjects visible and trend buckets by UTC day", () => {
  const { telemetry, clock } = fixture();
  telemetry.catalog([
    { what: "tasks.new", first_seen: "2026-08-01T00:00:00.000Z" },
    { what: "tasks.dead", first_seen: "2026-08-01T00:00:00.000Z" },
  ]);
  telemetry.around("tasks.new", "human", () => undefined);
  clock.nextDay();
  telemetry.around("tasks.new", "alice", () => undefined);

  expect(telemetry.used().map((use) => [use.what, use.calls])).toEqual([
    ["tasks.new", 2],
    ["tasks.dead", 0],
  ]);
  expect(telemetry.dead("2026-08-20T00:00:00.000Z").map((use) => use.what)).toEqual(["tasks.dead"]);
  expect(telemetry.trend("tasks.new")).toEqual({
    days: ["2026-08-20", "2026-08-21"],
    counts: [1, 1],
  });
});

test("a broken diagnostic sink never changes application behavior", () => {
  const errors: unknown[] = [];
  const telemetry = new Telemetry(
    { append: () => { throw new Error("sink down"); }, read: () => [] },
    fixture().clock,
    (error) => errors.push(error),
  );

  expect(telemetry.around("tasks.new", "human", () => "kept")).toBe("kept");
  expect(errors).toHaveLength(1);
});
