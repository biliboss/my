import { expect, test } from "bun:test";
import type { Grammar as ContractGrammar, Shared } from "../../01_projects/my-teams-v1/interfaces/shared.ts";
import {
  GrammarViolation,
  grammar,
  type SingleParagraph,
  type Words,
} from "./grammar.ts";

const contract: ContractGrammar = grammar;
void contract;

test("word and paragraph validators compose without a cast", () => {
  const title = grammar.paragraphs(grammar.words("move camera with api", 5), 1);
  const typed: Words<5> & SingleParagraph = title;
  const contractTyped: Shared.ValueObjects.GrammarStyle.Words<5> &
    Shared.ValueObjects.GrammarStyle.SingleParagraph = title;

  expect(typed).toBe("move camera with api");
  expect(contractTyped).toBe(typed);
});

test("words refuses runtime input over the limit", () => {
  expect(() => grammar.words("one two three four five six", 5)).toThrow(GrammarViolation);
  expect(() => grammar.words("one two three four five six", 5)).toThrow("expected at most 5, got 6");
});

test("paragraphs handles CRLF and rejects empty titles", () => {
  expect(grammar.paragraphs("first\r\n\r\nsecond", 2)).toContain("second");
  expect(() => grammar.paragraphs("", 1)).toThrow("expected 1, got 0");
});

test("sections validate each body and refuse a preamble", () => {
  const seen: string[] = [];
  const document = grammar.inSections("# One\nalpha beta\n\n## Two\ngamma", (body) => {
    seen.push(body);
    return grammar.words(body, 2);
  });

  expect(document).toStartWith("# One");
  expect(seen).toEqual(["alpha beta", "gamma"]);
  expect(() => grammar.inSections("before\n# One\nbody", String)).toThrow("no content before");
});
