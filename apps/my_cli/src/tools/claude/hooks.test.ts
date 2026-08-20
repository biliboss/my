import { expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { files, hooksOf } from "./hooks.ts";

// Os DOIS níveis: um evento tem N matchers, e um matcher tem N comandos. Achatar
// um deles é como um hook declarado some da lista sem ninguém notar.
test("achata matcher e comando, e ignora o que não é `command`", () => {
	const file = join(tmpdir(), "my-tools-hooks.test.json");
	writeFileSync(
		file,
		JSON.stringify({
			hooks: {
				PreToolUse: [
					{ matcher: "Bash", hooks: [{ type: "command", command: "a" }, { type: "command", command: "b" }] },
					{ matcher: "*", hooks: [{ type: "prompt", prompt: "não é comando" }] },
				],
				SessionStart: [{ hooks: [{ type: "command", command: "c" }] }],
			},
		}),
	);
	expect(hooksOf(file).map((h) => `${h.event}:${h.command}`)).toEqual(["PreToolUse:a", "PreToolUse:b", "SessionStart:c"]);
});

test("a pilha vai do mais geral pro mais específico", () => {
	expect(files("/repo").map((f) => f.split("/").slice(-2).join("/"))).toEqual([
		"ClaudeCode/managed-settings.json",
		".claude/settings.json",
		".claude/settings.json",
		".claude/settings.local.json",
	]);
});
