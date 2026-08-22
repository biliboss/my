//! A árvore de `src/` lida do DISCO, no formato de comando.
//!
//! É a peça que sustenta "pasta é verbo, arquivo é subverbo": ninguém declara
//! comando, este arquivo acha. Separado do router de propósito — varrer disco e
//! montar commander são dois trabalhos, e só o primeiro é testável sem CLI.
//!
//! depends_on: src/
//! impacts:    src/cli/core/router.ts · src/cli/CONTEXT.md

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const SRC = join(import.meta.dir, "../..");

/** Pastas que não são verbo: a própria CLI não se expõe como comando.
 *
 *  `extension` SAIU DESTA LISTA em 20/08, junto com a pasta. Ela era a exceção
 *  original — TypeScript que roda no extension host, com `package.json` e `out/`
 *  próprios, e sem a linha virava `my extension` com "6 subcomandos" que ninguém
 *  podia executar. A extensão foi removida; exceção sem alvo é regra que o próximo
 *  leitor tenta entender e não consegue. */
const NOT_A_VERB = new Set(["cli", "node_modules"]);

/** `path` é o ENDEREÇO do comando dentro de `src/` — `herdr/agents`, não
 *  `agents`. O nome nu não identifica: `agents` existe no topo E dentro de
 *  `herdr`, e quem chaveia pelo nome confunde os dois. */
export type Node = { name: string; path: string; file?: string; children: Node[] };

/** COMANDO é quem se declara comando: `export function main` (a interface) ou
 *  `import.meta.main` (o guard que todo script desta casa tem). Lido do FONTE,
 *  nunca importando — módulo com efeito no topo RODA ao ser importado, e montar o
 *  help não pode disparar um check.
 *
 *  ISTO SUBSTITUIU a heurística "lib é o que alguém importa", e a substituição foi
 *  medida em 17/08: `sprints.ts` passou a importar `runs.ts`, e `my runs`
 *  DESAPARECEU do CLI — a heurística não sabia que um comando pode ser lib de
 *  outro. Ela era ponte pro dia em que todo script se declarasse; o dia chegou
 *  pelo caminho ruim, com um comando sumindo calado. */
const RUNNABLE = /^export\s+(?:async\s+)?function\s+main\b|import\.meta\.main/m;

const runnable = (file: string) => RUNNABLE.test(readFileSync(file, "utf8"));

/** O FALLBACK, pros scripts que ainda não se declaram: todo arquivo que alguém em
 *  `src/` importa é lib. Ele era a REGRA até 17/08 e virou fallback porque errava
 *  no caso novo — comando que outro comando importa. Invertida a ordem, os dois
 *  casos passam: quem se declara é comando mesmo que importado, e quem não se
 *  declara ainda funciona se ninguém o importa.
 *
 *  `.test.ts` NÃO conta: o teste de um comando importa o comando, e sem esta
 *  linha todo script testado sumia — foi o que aconteceu com `my meta`. */
function imported(dir: string, into = new Set<string>()): Set<string> {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      imported(path, into);
      continue;
    }
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
    for (const [, spec] of readFileSync(path, "utf8").matchAll(/from\s+["'](\.[^"']+)["']/g))
      into.add(resolve(dirname(path), spec.replace(/\.ts$/, "") + ".ts"));
  }
  return into;
}

const LIBS = imported(SRC);

/** A primeira linha `//!` do arquivo — a descrição do subverbo. Sem docstring
 *  o comando aparece sem descrição, e o vazio na tela é o lembrete. */
export function summary(file: string): string {
  const first = readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.startsWith("//!") && l.slice(3).trim());
  return first ? first.slice(3).trim() : "";
}

/** As linhas de EXEMPLO do docstring — as indentadas dentro do bloco `//!`,
 *  até a primeira linha de PROSA (não indentada) depois delas.
 *
 *  Linha em branco NO MEIO do bloco é preservada, e a indentação de dentro
 *  também: help de comando com seção e coluna alinhada (`my vscode set`) só se
 *  lê se as duas sobreviverem. O `trim()` que estava aqui achatava as colunas, e
 *  a linha em branco encerrava o bloco no primeiro parágrafo.
 *
 *  O router não declara as flags do script de propósito (`allowUnknownOption`):
 *  flag declarada em dois lugares diverge na primeira mudança. O preço disso era
 *  `--help` imprimindo só `-h, --help`, e em 17/08 isso custou um agente aberto
 *  no cwd errado — `workspaces create` aceita `--cwd` desde sempre, o comando
 *  simplesmente não contava.
 *
 *  O exemplo do docstring é a fonte certa porque envelhece junto do código: ele
 *  está no mesmo arquivo, e quem muda a flag está lendo estas linhas. */
export function usage(file: string): string[] {
  const lines = readFileSync(file, "utf8").split("\n");
  // O SHEBANG não encerra o docstring, e a versão que encerrava engolia os exemplos
  // de 33 comandos: todo script que abre com `#!/usr/bin/env bun` (`my check okf`,
  // `my check maps`, `my kanban move`, `my meta`…) caía no `break` da PRIMEIRA linha
  // e ficava com `Examples:` vazio no `--help`. Medido 20/08, e o sintoma era mudo —
  // o help imprimia o resumo normalmente, então parecia um comando sem exemplo.
  //
  // `summary()` logo acima já lê o docstring por `find`, ignorando o que vem antes;
  // esta função discordava dele sobre onde o bloco começa.
  const doc: string[] = [];
  for (const l of lines) {
    if (!l.startsWith("//!")) {
      if (doc.length) break; // acabou o bloco
      continue; // ainda não começou — shebang, linha em branco
    }
    doc.push(l.slice(3));
  }
  const out: string[] = [];
  for (const l of doc) {
    if (/^\s{3,}\S/.test(l) || (out.length && !l.trim())) out.push(l.trimEnd());
    else if (out.length) break;
  }
  while (out.length && !out[out.length - 1]!.trim()) out.pop();
  // Dedenta pela MENOR indentação do bloco: o docstring indenta pra caber no
  // `//!`, e o router já prefixa dois espaços na hora de imprimir.
  const pad = Math.min(...out.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
  return out.map((l) => l.slice(pad));
}

/** `src/` → a árvore. `.test.ts` e pasta vazia ficam de fora: teste não é
 *  comando, e verbo sem subverbo nenhum seria um menu que não abre nada. */
export function scan(dir: string = SRC, prefix = ""): Node[] {
  return readdirSync(dir)
    .filter((e) => !e.startsWith(".") && !e.startsWith("_") && !NOT_A_VERB.has(e))
    .flatMap((entry) => {
      const disk = join(dir, entry);
      if (statSync(disk).isDirectory()) {
        const path = prefix ? `${prefix}/${entry}` : entry;
        const children = scan(disk, path);
        return children.length ? [{ name: entry, path, children }] : [];
      }
      if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) return [];
      // Se declara comando? é comando. Senão, só é comando se ninguém o importa.
      if (!runnable(disk) && LIBS.has(disk)) return [];
      const name = entry.slice(0, -3);
      return [{ name, path: prefix ? `${prefix}/${name}` : name, file: disk, children: [] }];
    });
}
