//! A árvore vira commander, e a CLI IMPORTA o comando em vez de rodar `bun run`.
//!
//! O contrato é uma função só, e é tudo que um script precisa saber da CLI:
//!
//!     export function main(argv: string[]): number | Promise<number>
//!
//! Quem exporta `main` é COMANDO. Quem não exporta é LIB, e some da CLI — é o
//! que tira `my shared file`, `my workflows tree` e `my herdr policy` do help,
//! três coisas que nunca foram comando de ninguém e apareciam só porque a
//! varredura olhava a extensão do arquivo.
//!
//! O script não conhece commander, não conhece `my`, não sabe que existe uma
//! CLI: recebe um array de strings e devolve um código. Testar é chamar a
//! função; a lib de verdade (`tree.ts`, `file.ts`) fica um degrau abaixo, sem
//! nem isso.
//!
//! depends_on: src/cli/core/scan.ts · src/cli/core/verbs.ts
//! impacts:    src/cli/my.ts · src/CONTEXT.md

import type { Command } from "commander";
import { readFileSync } from "node:fs";
import { spawn } from "./rec.ts";
import { SRC, summary, usage, type Node } from "./scan.ts";
import { VERBS } from "./verbs.ts";
import { close as closeDb } from "../../home/db.ts";

type Main = (argv: string[]) => number | Promise<number>;

/** O arquivo se declara EXECUTÁVEL? Duas formas valem, e o disco responde as
 *  duas sem importar nada: `export function main` (a interface, pra quem já
 *  migrou) e `import.meta.main` (o guard que todo script desta casa tem).
 *
 *  Lido do FONTE, nunca importando: módulo com efeito no topo RODA ao ser
 *  importado, e montar o help não pode disparar um check. Medido em 17/08 —
 *  `my --help` executou `src/check/context.ts` inteiro.
 *
 *  Lib não tem nenhum dos dois, e é o que tira `my shared file`,
 *  `my workflows tree` e `my herdr policy` do help. */
const RUNNABLE = /^export\s+(?:async\s+)?function\s+main\b|import\.meta\.main/m;

/** Exporta a interface? Então a CLI CHAMA a função. Senão roda o arquivo como
 *  processo — o degrau de migração, e o único lugar que ainda sabe de `bun`. */
const EXPORTS_MAIN = /^export\s+(?:async\s+)?function\s+main\b/m;

/** O script declara as PRÓPRIAS flags em commander? Então o `-h` é dele.
 *
 *  Sem isto o commander de fora responde primeiro e o help do script nunca
 *  aparece: o de fora não conhece flag nenhuma (`allowUnknownOption`), então
 *  imprimia `Options: -h, --help` e mais nada. Quem não importa commander segue
 *  com o help do router, que é o docstring. */
/** As duas aspas: metade dos arquivos desta casa usa `'`, e o regex só via `"`
 *  — `my references -h` caiu no help de fora por causa de uma aspa. */
const OWN_HELP = /from\s+["']commander["']/;

/** O subverbo `index.ts` é o verbo RESPONDIDO PELADO: `my resources -g askuser` cai
 *  nele, e `my resources read x` cai no `read.ts` ao lado.
 *
 *  Existe porque "pasta é verbo, arquivo é subverbo" não tinha resposta pra um verbo
 *  que já respondia sozinho ANTES de ganhar subverbos — e `my resources <assunto>` é
 *  citado às dezenas nesta casa. Sem isto, virar pasta quebrava toda essa citação, e o
 *  preço de manter o verbo velho vivo ao lado do novo seria o dual-write que
 *  @CLAUDE.md recusa.
 *
 *  Escondido do help de propósito: o que `my resources -h` deve listar são os
 *  subverbos, e a gramática pelada entra ali como `Examples:` do docstring dele. */
const DEFAULT_SUBVERB = "index";

async function call(file: string, args: string[]): Promise<number> {
  const mod = (await import(file)) as { main: Main };
  return mod.main(args);
}

export async function attach(parent: Command, nodes: Node[]): Promise<Command> {
  for (const node of nodes) {
    if (node.file) {
      const src = readFileSync(node.file, "utf8");
      const imported = EXPORTS_MAIN.test(src);
      const ownHelp = OWN_HELP.test(src);
      const rel = node.file.slice(SRC.length + 1);
      const examples = usage(node.file);
      const isDefault = node.name === DEFAULT_SUBVERB;
      const cmd = parent
        .command(node.name, isDefault ? { isDefault: true, hidden: true } : {})
        .description(summary(node.file))
        // A CLI não conhece as flags do script — quem as declara é o script.
        // Validar aqui obrigaria a declarar toda flag em dois lugares.
        .allowUnknownOption();
      // O script que declara as próprias flags também responde o próprio `-h`:
      // desligar o help daqui é o que deixa a flag CHEGAR nele. O
      // `enablePositionalOptions` no PAI é exigência do commander pro
      // `passThroughOptions` — sem ele, `passThroughOptions` lança na montagem.
      if (ownHelp) {
        parent.enablePositionalOptions();
        cmd.helpOption(false).passThroughOptions();
      }
      // Mas NÃO declarar não é motivo pra não MOSTRAR: o exemplo do docstring é
      // a única lista de flags que envelhece junto do código. Sem isto o help
      // dizia só `-h, --help`, e em 17/08 um agente subiu no cwd errado porque
      // `--cwd` existia e o comando não contava.
      if (examples.length) cmd.addHelpText("after", `\nExamples:\n  ${examples.join("\n  ")}\n`);
      cmd
        .argument("[args...]")
        .action(async (args: string[]) => {
          const code = imported ? await call(node.file!, args ?? []) : spawn(rel, args ?? []);
          // NÃO existe recibo. Ele existia até 17/08, gravava uma pasta por
          // execução em `_events/`, e o que se aprendeu com 151 delas foi zero:
          // o `git log` diz o que mudou e a pasta do run diz o que foi decidido.
          // `exitCode`, NUNCA `process.exit()`: com stdout num PIPE o exit mata o
          // processo antes do flush, e `my runs | head` saía vazio — medido em
          // 17/08. O valor dos quatro formatos é justamente o pipe.
          process.exitCode = code;
          // FECHA O QUE O COMANDO ABRIU. O SurrealDB do `home/db.ts` mantém um
          // socket vivo, e socket vivo segura o loop do Bun: `my tasks list`
          // imprimia a lista e FICAVA — 120s de timeout num comando de 300ms
          // (medido 20/08).
          //
          // Fechar, e não `process.exit()`: o comentário acima é da mesma família e
          // vale aqui em dobro. `exit` com stdout num PIPE mata antes do flush, e
          // `my runs | head` saía vazio. Encerrar o recurso deixa o processo morrer
          // sozinho, com o buffer entregue.
          await closeDb();
        });
      continue;
    }
    const folder = parent
      .command(node.name)
      // A frase do `@verb` quando existe; a contagem quando ninguém descreveu.
      .description(VERBS.get(node.name) ?? `${node.children.length} subcomandos`);

    // O verbo que responde PELADO: as flags e os posicionais têm que atravessar o
    // commander da pasta pra chegar no `index.ts`. `enablePositionalOptions` no PAI é
    // exigência do commander pro `passThroughOptions` — sem ele estoura na montagem.
    const def = node.children.find((c) => c.name === DEFAULT_SUBVERB && c.file);
    if (def) {
      parent.enablePositionalOptions();
      folder.allowUnknownOption().passThroughOptions();
      const examples = usage(def.file!);
      if (examples.length) folder.addHelpText("after", `\nExamples:\n  ${examples.join("\n  ")}\n`);
    }

    const children = await attach(folder, node.children);
    // Verbo chamado sem subverbo LISTA o que tem dentro, em vez de morrer calado. Com
    // `index.ts` quem responde é ele, e uma action aqui atropelaria o default.
    if (!def) children.action(() => children.help());
  }
  return parent;
}
