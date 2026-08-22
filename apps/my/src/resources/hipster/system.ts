#!/usr/bin/env bun
//! O sistema de design: de que uma tela e um documento são MONTADOS.
//!
//!   my resources hipster system
//!
//! São duas coisas nesta casa, e as duas são composição: os corpos atômicos do cockpit
//! (`templates/cockpit`) e a NOTAÇÃO que os documentos daqui seguem (`rules/design` —
//! call stack, outline, system design). Um sistema de design que só cobre pixel deixa
//! metade do que esta casa desenha sem forma.
//!
//! depends_on: src/resources/store.ts · src/interfaces/resources.ts

import { printNames, store } from "../store.ts";

export function main(_argv: string[]): number {
	return printNames(store.hipster.system());
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
