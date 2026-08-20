//! Application-boundary telemetry: one terminal span per invocation and usage views
//! projected from those spans plus a declared catalogue.
//!
//! The observer does not choose persistence. A sink may target tslog, an OS diagnostic
//! store, SQLite, or a bounded ring; none of those choices enter domain code.
//!
//! depends_on: src/interfaces/shared.ts
//! impacts:    —

import type { Logging, Shared, UsageLogging } from "@biliboss/interfaces/shared.ts";

// O contrato é a fonte; estes são apelidos locais pra quem já importa daqui.
export type Instant = Shared.Instant;
export type Millis = Shared.Millis;
export type Outcome = Shared.Outcome;
export type Span = Shared.Span;
export type UsageDeclaration = Shared.UsageDeclaration;
export type Use = Shared.Use;
export type Series = Shared.Series;
export type { Logging, UsageLogging };

export interface SpanSink {
  append(span: Span): void;
  read(since?: Instant): readonly Span[];
}

export interface TelemetryClock {
  wall(): Date;
  monotonic(): number;
  id(): string;
}

/** Fica LOCAL porque o contrato inline este objeto em `Logging.around` e não lhe dá
 *  nome: é o mesmo shape com um nome pra quem chama, não um segundo tipo. */
export interface AroundOptions<Result> {
  readonly parent?: string;
  readonly outcome?: (result: Awaited<Result>) => Outcome;
}

const systemClock: TelemetryClock = {
  wall: () => new Date(),
  monotonic: () => performance.now(),
  id: () => crypto.randomUUID(),
};

export class MemorySpanSink implements SpanSink {
  readonly #rows: Span[] = [];

  append(span: Span): void {
    this.#rows.push(Object.freeze({ ...span }));
  }

  read(since?: Instant): readonly Span[] {
    return Object.freeze(this.#rows.filter((span) => !since || span.at >= since).slice());
  }
}

function says(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failedOutcome(error: unknown): Outcome {
  return error instanceof Error && error.name === "AbortError" ? "cancelled" : "failed";
}

function promiseLike(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === "object" || typeof value === "function") &&
    value !== null && typeof (value as PromiseLike<unknown>).then === "function";
}

export class Telemetry implements UsageLogging {
  readonly #catalogue = new Map<string, Instant>();

  constructor(
    readonly sink: SpanSink = new MemorySpanSink(),
    readonly clock: TelemetryClock = systemClock,
    readonly onSinkError: (error: unknown) => void = () => {},
  ) {}

  around<Result>(
    verb: string,
    by: string,
    run: () => Result,
    options?: AroundOptions<Result>,
  ): Result {
    const at = this.clock.wall().toISOString();
    const started = this.clock.monotonic();
    let ended = false;

    const finish = (outcome: Outcome, message?: string): void => {
      if (ended) return;
      ended = true;
      const span: Span = {
        id: this.clock.id(),
        verb,
        at,
        took: Math.max(0, this.clock.monotonic() - started),
        outcome,
        by,
        ...(options?.parent ? { parent: options.parent } : {}),
        ...(message ? { says: message } : {}),
      };
      try {
        this.sink.append(span);
      } catch (error) {
        this.onSinkError(error);
      }
    };

    try {
      const result = run();
      if (promiseLike(result)) {
        return Promise.resolve(result).then(
          (value) => {
            try {
              finish(options?.outcome?.(value as Awaited<Result>) ?? "ok");
              return value;
            } catch (error) {
              finish(failedOutcome(error), says(error));
              throw error;
            }
          },
          (error) => {
            finish(failedOutcome(error), says(error));
            throw error;
          },
        ) as Result;
      }
      finish(options?.outcome?.(result as Awaited<Result>) ?? "ok");
      return result;
    } catch (error) {
      finish(failedOutcome(error), says(error));
      throw error;
    }
  }

  spans(since?: Instant): readonly Span[] {
    return Object.freeze([...this.sink.read(since)].sort((a, b) =>
      a.at.localeCompare(b.at) || a.id.localeCompare(b.id)));
  }

  catalog(items: readonly UsageDeclaration[]): void {
    for (const item of items) {
      const current = this.#catalogue.get(item.what);
      if (!current || item.first_seen < current) this.#catalogue.set(item.what, item.first_seen);
    }
  }

  used(): readonly Use[] {
    return this.#usage().sort((a, b) => b.calls - a.calls || a.what.localeCompare(b.what));
  }

  dead(since: Instant): readonly Use[] {
    const called = new Set(this.spans(since).map((span) => span.verb));
    return this.#usage().filter((use) => !called.has(use.what));
  }

  trend(what: string): Series {
    const counts = new Map<string, number>();
    for (const span of this.spans()) {
      if (span.verb !== what) continue;
      const day = span.at.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    const days = [...counts.keys()].sort();
    return Object.freeze({
      days: Object.freeze(days),
      counts: Object.freeze(days.map((day) => counts.get(day)!)),
    });
  }

  #usage(): Use[] {
    const rows = new Map<string, { first: Instant; spans: Span[] }>();
    for (const [what, first] of this.#catalogue) rows.set(what, { first, spans: [] });
    for (const span of this.spans()) {
      const row = rows.get(span.verb) ?? { first: span.at, spans: [] };
      if (span.at < row.first) row.first = span.at;
      row.spans.push(span);
      rows.set(span.verb, row);
    }
    return [...rows].map(([what, row]) => Object.freeze({
      what,
      first_seen: row.first,
      calls: row.spans.length,
      ...(row.spans.length ? { last: row.spans.at(-1)!.at } : {}),
      by: Object.freeze([...new Set(row.spans.map((span) => span.by))].sort()),
      refusals: row.spans.filter((span) => span.outcome === "refused").length,
    }));
  }
}

export const createTelemetry = (
  sink?: SpanSink,
  clock?: TelemetryClock,
  onSinkError?: (error: unknown) => void,
): UsageLogging => new Telemetry(sink, clock, onSinkError);
