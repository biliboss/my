//! THE MEASUREMENT, RUNNABLE: `bun run probe.ts`.
//!
//! `@biliboss/resources` had ZERO consumers on 21/08 (note 002, "Medido em 21/08"). A
//! package with no consumer is a package whose contract has never been tested by
//! anything but its author, so the first thing this scene owes is proof that the
//! two halves fit: a real `index()` over the real house, through `adapt()`, into
//! the counts the scene draws.
//!
//! It is the only file here that imports `@biliboss/resources`, which is why that
//! package is a devDependency and not a dependency: the SCENE does not read.
//!
//! Nothing is asserted and nothing is mocked — it prints what it found. A number
//! that changes tomorrow is the point; a number that comes back 0 is the finding.

import { index } from "@biliboss/resources";
import { adapt } from "./adapt.ts";
import { LENS_NAMES, inLens, offeredLenses, unlabelled } from "./lens.ts";

const raw = await index();
const rs = adapt(raw);

console.log(`index()            ${rs.length} resources`);
console.log(`offeredLenses()    ${offeredLenses(rs).join(" · ") || "(none)"}`);
for (const lens of LENS_NAMES) {
	const claimed = rs.filter((r) => r.lens === lens).length;
	const count = inLens(rs, lens).length;
	console.log(`  ${lens.padEnd(16)} ${String(count).padStart(3)} labelled   (store says ${claimed})`);
}
const loose = unlabelled(rs);
console.log(`  ${"no lens".padEnd(16)} ${String(loose.length).padStart(3)} defaulted`);
console.log(`undated            ${rs.filter((r) => !r.at).length}`);
