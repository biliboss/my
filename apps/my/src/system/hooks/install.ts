#!/usr/bin/env bun
//! Aponta o `pre-commit` de um checkout pro script versionado. Idempotente.
//!
//!   my system hooks install              a CASA (`MY_HOME`)
//!   my system hooks install --code       este checkout de código
//!   my system hooks install --into ~/src/outro
//!
//! O hook mora em `src/check/pre-commit` porque um `git clone` não traz
//! `.git/hooks/` — o que o repo versiona é o script, e o symlink é o que cada
//! checkout instala uma vez.
//!
//! DOIS CHECKOUTS PRECISAM DELE AGORA, e é por isso que o alvo virou argumento: o
//! código saiu da casa em 20/08, então `my` guarda o SCRIPT e `me` guarda o
//! CONTEÚDO que ele checa. Antes disto o instalador escrevia sempre um relativo
//! (`../../src/check/pre-commit`) porque as duas coisas eram a mesma pasta.
//!
//! RELATIVO QUANDO DÁ, ABSOLUTO QUANDO PRECISA. Um symlink relativo sobrevive ao
//! repo ser clonado noutro caminho, e é o certo enquanto o script está DENTRO do
//! checkout que o usa. Instalando na casa, o alvo está noutra árvore e não existe
//! relativo estável entre elas: absoluto é a única forma honesta, e a mensagem
//! impressa diz qual das duas saiu — um symlink quebrado que ninguém viu é um
//! commit sem gate que ninguém viu.
//!
//! depends_on: src/check/pre-commit · src/home/paths.ts
//! impacts:    src/check/pre-commit

import { existsSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";
import { has, value } from "@my/shared/argv";
import { code, root } from "../../home/paths.ts";

export function install(into: string): { link: string; target: string } | { erro: string } {
	if (!existsSync(join(into, ".git"))) return { erro: `${into} não é um checkout — não tem \`.git\`` };

	const script = join(code(), "apps/my/src/check/pre-commit");
	if (!existsSync(script)) return { erro: `o script não existe: ${script}` };

	const hooks = join(into, ".git/hooks");
	const link = join(hooks, "pre-commit");
	mkdirSync(hooks, { recursive: true });

	// Dentro do mesmo checkout, relativo — é o que sobrevive a um clone noutro
	// caminho. Fora dele, absoluto: não existe relativo estável entre duas árvores
	// que a pessoa pode mover independentemente.
	const target = into === code() ? relative(hooks, script) : script;

	// `unlink` antes: `symlinkSync` não sobrescreve, e instalar duas vezes tem que
	// ser a mesma coisa que instalar uma.
	try {
		unlinkSync(link);
	} catch {}
	symlinkSync(target, link);
	return { link, target };
}

export function main(argv: string[] = Bun.argv.slice(2)): number {
	const into = value("into") ?? (has("code") ? code() : root());
	const out = install(into);
	if ("erro" in out) return console.error(`✗ ${out.erro}`), 1;
	console.log(`pre-commit → ${out.link}\n  aponta pra ${out.target}`);
	return 0;
}

if (import.meta.main) process.exit(main());
