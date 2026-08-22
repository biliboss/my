#!/usr/bin/env bun
//! `my` — a CLI desta casa. Este arquivo é o ROTEADOR e a legenda; a máquina
//! mora em [`core/`](core).
//!
//! **A ÁRVORE DE DIRETÓRIOS É A CLI.** Pasta é verbo, arquivo é subverbo, igual
//! ao git:
//!
//!     src/vscode/set.ts          →  my vscode set <pasta>...
//!     src/workflows/show.ts      →  my workflows show <nome>
//!     src/herdr/panes/read.ts    →  my herdr panes read w3K:p2
//!     src/check/rules.ts         →  my check rules
//!
//! Nenhum comando é declarado aqui: `core/scan.ts` varre `src/`, `core/router.ts`
//! monta o commander. Mover um arquivo muda a CLI — é pra ser assim, e é o que
//! impede um comando de existir sem código atrás.
//!
//! O que a classe abaixo faz é DESCREVER, não declarar. Um verbo é uma pasta, e
//! pasta não tem onde guardar a própria frase — sem os decorators o help dizia
//! "6 subcomandos", que é contagem, não descrição. Pasta sem `@verb` continua
//! aparecendo; `@verb` sem pasta não vira comando nenhum.
//!
//! Foi o que matou o `justfile`: lá cada receita era declarada à mão e o nome
//! nascia solto do código — era assim que se chegava em `workspace-close`.
//!
//! INTERPRETADO, e isso é decisão. `bun build --compile` quebra o desenho:
//! dentro do binário `import.meta.dir` resolve pro filesystem embutido e a
//! varredura não acha nada. Assar a árvore no build faria a CLI mentir entre um
//! build e outro — justo a propriedade que "pasta é verbo" comprou. Preço
//! medido em 17/08: 41ms de fora do repo.
//!
//! depends_on: src/cli/core/scan.ts · src/cli/core/router.ts · src/cli/core/verbs.ts
//! impacts:    src/CONTEXT.md · CONTEXT.md

import { Command } from "commander";
import { attach, stripRemote } from "./core/router.ts";
import { scan } from "./core/scan.ts";
import { verb } from "./core/verbs.ts";

/** A CLI, em uma tela. O corpo de cada método é vazio de propósito: quem
 *  executa é o subverbo, achado no disco. */
class My {
  @verb("o pedido vira item na página, e a resposta vira nota em archive/") inbox() {}
  @verb("o projeto: cria com resultado e prazo, e acusa o que nasceu torto") projects() {}
  @verb("a sprint é PASTA: cria, soma os minutos, e acusa quem passou do teto") sprints() {}
  @verb("a task é PASTA dentro da sprint: nasce, começa numa worktree, fecha provando") tasks() {}
  @verb("desenha antes de codar: a pasta docs/, o grafo e a árvore") system_design() {}
  @verb("tudo que esta casa sabe: as páginas, os kinds, e as três lentes") resources() {}
  @verb("os workflows da casa: as categorias, a árvore, o contrato de um") workflows() {}
  @verb("a pergunta que sobe numa tela e BLOQUEIA até alguém decidir") askuser() {}
  @verb("a frota: despacha trabalho endereçado e lê o que voltou") agents() {}
  @verb("onde as coisas ficam: as três raízes, as env, e quem escreve onde") home() {}
  @verb("o plantão: sobe um workspace por time, e ele PUXA da própria fila") teams() {}
  @verb("o multiplexador: workspaces, abas, panes, agentes") herdr() {}
  @verb("a barra lateral do VS Code: que pasta, em que ordem, com que rótulo") vscode() {}
  @verb("o GitHub por fora: issue e PR, com o link que o ciclo cita") gh() {}
  @verb("as portas: uma rota por fatia de público, servidas de um domínio só") lp() {}
  @verb("os programas de fora: o grafo, os hooks do Claude Code, e se ainda respondem") tools() {}
  @verb("o Claude Code por fora: os hooks que uma sessão ganha, e qual arquivo os deu") claude() {}
  @verb("o que apodreceu: citação pro vazio, CONTEXT.md, regra fora do lugar") check() {}
  @verb("o sistema cuidando de si: os checks, os hooks, as métricas") system() {}
  @verb("o que os scripts compartilham — sem comando próprio") shared() {}
}
void My;

// `--remote <host>` é a ÚNICA flag global desta CLI, e ela sai do argv aqui —
// antes de qualquer commander existir. O porquê, com o que custou, está em
// `core/router.ts#stripRemote`.
let argv: string[];
try {
  argv = stripRemote(process.argv.slice(2));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
}

(
  await attach(
    new Command("my")
      .description("a CLI desta casa — pasta é verbo, arquivo é subverbo")
      .showHelpAfterError()
      .addHelpText("after", "\nGlobal:\n  --remote <host>  roda o comando no herdr da outra caixa (ex.: fonseca-vps)\n"),
    scan(),
  )
).parse(argv, { from: "user" });
