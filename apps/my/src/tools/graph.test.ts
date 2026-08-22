import { expect, test } from "bun:test";
import { url } from "./graph.ts";

// O QUE QUEBRA EM SILÊNCIO: um parâmetro escrito no valor default. A URL abre
// igual hoje e congela o default de LÁ no dia em que ele mudar.
test("campo no default sai da URL", () => {
	expect(url()).toBe("http://my-graph.localhost/");
	expect(url({ density: "comfortable", theme: "monokai", externals: false, hideHub: false, open: [], selected: "" })).toBe(
		"http://my-graph.localhost/",
	);
});

test("o que não é default vira hash, e o hub é hub=0", () => {
	expect(url({ open: ["shared", "tools"], selected: "kanban", density: "compact", externals: true, hideHub: true, theme: "aura" })).toBe(
		"http://my-graph.localhost/#open=shared%2Ctools&sel=kanban&d=compact&ext=1&hub=0&t=aura",
	);
});
