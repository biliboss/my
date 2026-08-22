#!/usr/bin/env bun
//! Procura o termo na descrição de todo comando — uma linha por acerto.
//!
//!   my apropos worktree
//!   my apropos kanban card         dois termos: só quem casa os DOIS
//!   my apropos --json evento       o mesmo, pra outro programa ler
//!
//! Existe porque a superfície não cabe em folhear: são 158 comandos em três
//! níveis, e `my --help` mostra 36 — ver o resto custava uma invocação por
//! verbo. Medido em 22/08, contra tmux e Neovim: `lscm` e `:helpgrep` são a
//! resposta dos dois, e o `my` não tinha nenhuma das duas.
//!
//! A unidade de resposta é a LINHA, não a página — é o que deixa `| grep`,
//! `| wc -l` e `| fzf` funcionarem sem nada a mais.
//!
//! DERIVADO do disco, igual ao help: quem responde é `scan()` e a primeira
//! linha `//!` de cada arquivo. Índice nenhum é mantido aqui, então nada tem
//! como divergir do que a CLI de fato expõe.
//!
//! O termo casa contra o ENDEREÇO e contra a descrição, sem acento e sem caixa:
//! quem procura "sessao" acha "sessão", e quem procura "kanban" acha os doze
//! subverbos sem saber a frase de nenhum.
//!
//! depends_on: src/cli/core/scan.ts
//! impacts:    src/cli/CONTEXT.md

import { scan, summary, type Node } from "./cli/core/scan.ts";

/** O subverbo `index.ts` é o verbo respondido PELADO — `my chat`, nunca
 *  `my chat index`. Endereçar pelo arquivo imprimiria um comando que não
 *  existe. */
const DEFAULT_SUBVERB = "index";

export type Entry = { command: string; summary: string };

/** A árvore vira lista: um item por arquivo executável, endereçado como se
 *  digita. */
export function flatten(nodes: Node[], into: Entry[] = []): Entry[] {
  for (const node of nodes) {
    if (node.file) {
      const command = node.name === DEFAULT_SUBVERB ? node.path.slice(0, -(DEFAULT_SUBVERB.length + 1)) : node.path;
      if (command) into.push({ command: command.replace(/\//g, " "), summary: summary(node.file) });
      continue;
    }
    flatten(node.children, into);
  }
  return into;
}

/** Sem acento e sem caixa: a casa escreve "sessão", "início" e "código", e
 *  quem digita no terminal quase nunca escreve o acento. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** TODOS os termos, nunca qualquer um: dois termos é alguém estreitando a
 *  busca, e o `OR` devolveria mais resultado a cada palavra a mais. */
export function search(entries: Entry[], terms: string[]): Entry[] {
  const needles = terms.map(fold);
  return entries.filter((e) => {
    const hay = fold(`${e.command} ${e.summary}`);
    return needles.every((n) => hay.includes(n));
  });
}

/** Uma linha física por comando quando a saída é um terminal; inteira quando é
 *  um pipe. Cortar no pipe cortaria o que o `grep` do outro lado procura. */
function render(entries: Entry[], width?: number): string[] {
  const pad = Math.max(...entries.map((e) => e.command.length));
  return entries.map((e) => {
    const line = `my ${e.command.padEnd(pad)}  ${e.summary}`.trimEnd();
    return width && line.length > width ? `${line.slice(0, width - 1)}…` : line;
  });
}

export function main(argv: string[]): number {
  const json = argv.includes("--json");
  // Termo VAZIO não é termo: casaria com a CLI inteira e pareceria busca.
  const terms = argv.filter((a) => !a.startsWith("-") && a.trim());
  if (!terms.length) {
    console.error("uso: my apropos <termo>...   (ex.: `my apropos worktree`)");
    return 2;
  }
  const hits = search(flatten(scan()), terms);
  if (json) {
    console.log(JSON.stringify(hits, null, 2));
    return hits.length ? 0 : 1;
  }
  // Sem acerto o status é 1, igual ao `grep`: quem chama isto de dentro de um
  // script precisa distinguir "não achei" de "achei".
  if (!hits.length) {
    console.error(`nada casa com ${terms.map((t) => `\`${t}\``).join(" + ")}`);
    return 1;
  }
  for (const line of render(hits, process.stdout.isTTY ? process.stdout.columns : undefined)) console.log(line);
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
