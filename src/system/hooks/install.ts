#!/usr/bin/env bun
//! Aponta `.git/hooks/pre-commit` pro script versionado. Idempotente.
//!
//!   my system hooks install
//!
//! O hook mora em `src/check/pre-commit` porque um `git clone` não traz
//! `.git/hooks/` — o que o repo versiona é o script, e o symlink é o que cada
//! checkout instala uma vez. Era a receita `just hooks`.
//!
//! depends_on: src/check/pre-commit
//! impacts:    src/check/pre-commit

import { mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../../shared/file.ts";

const ROOT = repoRoot();

export function main(): number {
	const link = join(ROOT, ".git/hooks/pre-commit");
	mkdirSync(join(ROOT, ".git/hooks"), { recursive: true });
	// `unlink` antes: `symlinkSync` não sobrescreve, e a receita anterior (`ln -sf`)
	// sobrescrevia — instalar duas vezes tem que ser a mesma coisa que instalar uma.
	try {
		unlinkSync(link);
	} catch {}
	// Relativo a `.git/hooks/`, como era no `ln -sf`: symlink absoluto quebra no
	// dia em que o repo é clonado noutro caminho.
	symlinkSync("../../src/check/pre-commit", link);
	console.log(`pre-commit → ${link}`);
	return 0;
}

if (import.meta.main) process.exit(main());
