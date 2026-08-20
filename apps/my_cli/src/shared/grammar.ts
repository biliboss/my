//! Grammar-style value objects: raw text enters through validators, and the returned
//! brands compose without a cast.
//!
//! A type-level word counter only works for literals. These validators are the runtime
//! gate for CLI input, files, and every other ordinary string.
//!
//! depends_on: src/interfaces/shared.ts
//! impacts:    —

import type { Grammar, Shared } from "@biliboss/interfaces/shared.ts";

// Os brands são do contrato; estes são apelidos locais pra quem já importa daqui.
export type Words<Max extends number> = Shared.ValueObjects.GrammarStyle.Words<Max>;
export type Paragraphs<Count extends number> = Shared.ValueObjects.GrammarStyle.Paragraphs<Count>;
export type SingleParagraph = Shared.ValueObjects.GrammarStyle.SingleParagraph;
export type InSections<BodyStyle extends string = string> =
  Shared.ValueObjects.GrammarStyle.InSections<BodyStyle>;
export type { Grammar };

export type GrammarRule = "words" | "paragraphs" | "sections";

export class GrammarViolation extends Error {
  readonly rule: GrammarRule;
  readonly expected: number | string;
  readonly actual: number | string;

  constructor(rule: GrammarRule, expected: number | string, actual: number | string) {
    super(`${rule}: expected ${expected}, got ${actual}`);
    this.name = "GrammarViolation";
    this.rule = rule;
    this.expected = expected;
    this.actual = actual;
  }
}

function natural(rule: GrammarRule, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new GrammarViolation(rule, "a non-negative integer", value);
  }
}

function wordsIn(text: string): number {
  const value = text.trim();
  return value === "" ? 0 : value.split(/\s+/u).length;
}

function paragraphsIn(text: string): number {
  const value = text.trim();
  return value === "" ? 0 : value.split(/\r?\n[\t ]*\r?\n+/u).length;
}

function sectionBodies(text: string): string[] {
  const headings = [...text.matchAll(/^#{1,6}[\t ]+\S.*$/gmu)];
  if (headings.length === 0) throw new GrammarViolation("sections", "at least one heading", 0);

  const first = headings[0].index ?? 0;
  if (text.slice(0, first).trim() !== "") {
    throw new GrammarViolation("sections", "no content before the first heading", "preamble");
  }

  return headings.map((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? text.length;
    return text.slice(start, end).replace(/^\r?\n/u, "").trim();
  });
}

export const grammar: Grammar = {
  words(text, max) {
    natural("words", max);
    const actual = wordsIn(text);
    if (actual > max) throw new GrammarViolation("words", `at most ${max}`, actual);
    return text as typeof text & Words<typeof max>;
  },

  paragraphs(text, count) {
    natural("paragraphs", count);
    const actual = paragraphsIn(text);
    if (actual !== count) throw new GrammarViolation("paragraphs", count, actual);
    return text as typeof text & Paragraphs<typeof count>;
  },

  inSections(text, body) {
    for (const section of sectionBodies(text)) body(section);
    return text as typeof text & InSections<ReturnType<typeof body>>;
  },
};
