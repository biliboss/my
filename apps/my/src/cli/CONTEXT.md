---
type: context
---

# src/cli — o `my`

A CLI desta casa.

[`my.ts`](my.ts) é o ROTEADOR e a legenda — cabe numa tela. A máquina mora em
[`core/`](core): `scan.ts` varre o disco, `router.ts` monta o commander,
`rec.ts` roda o arquivo como processo, `verbs.ts` é o decorator.

## A árvore de diretórios É a CLI

**Pasta é verbo, arquivo é subverbo** — igual ao git. E um verbo responde uma
PERGUNTA, nunca roda um processo: a regra e a tabela de qual verbo responde o quê
estão em #house_verbs.

```
src/vscode/set.ts          →  my vscode set <pasta>...
src/workflows/show.ts      →  my workflows show <nome>
src/herdr/panes/read.ts    →  my herdr panes read w3K:p2
src/check/rules.ts         →  my check rules
```

Nada declara comando. O `my.ts` **varre `src/`** e monta o commander do que
achou; mover um arquivo muda a CLI. É pra ser assim, e é o que impede um comando
de existir sem código atrás — ou código de existir sem porta.

A descrição de cada subverbo é a **primeira linha `//!`** do arquivo. Script sem
docstring aparece sem descrição, e o vazio na tela é o lembrete.

Verbo sem subverbo imprime o próprio help em vez de morrer calado. `.test.ts`
não vira comando.

**`index.ts` é o verbo respondido PELADO.** `src/resources/index.ts` atende
`my resources -g askuser` e `my resources mkt_funnel`; `my resources read x` cai
no `read.ts` ao lado. Ele fica escondido do help — o que `my resources -h` lista
são os subverbos, e a gramática pelada entra ali como `Examples:` do docstring
dele.

Existe desde 20/08, quando `resources` virou pasta: "pasta é verbo, arquivo é
subverbo" não tinha resposta pra um verbo que já respondia sozinho ANTES de ganhar
subverbos, e `my resources <assunto>` está escrito às dezenas nesta casa. Sem
isto, virar pasta quebrava toda essa citação.

## `my apropos` é a vista PLANA dos 158

**A árvore que dá escopo ao verbo é a mesma que esconde o verbo.** `my --help`
lista 36; o resto mora um ou dois níveis abaixo, e ver tudo custava uma
invocação por pasta. [`../apropos.ts`](../apropos.ts) achata a mesma `scan()` e
casa o termo contra o ENDEREÇO e a descrição, sem acento e sem caixa.

```
my apropos kanban card     dois termos é AND, nunca OR
my apropos --json evento   o mesmo, pra outro programa ler
```

A unidade de resposta é a LINHA, não a página — é o que faz `| grep`, `| wc -l`
e `| fzf` funcionarem. Corta na largura do terminal e **não corta no pipe**:
truncar no pipe cortaria o que o `grep` do outro lado procura. Sem acerto o
status é `1`, igual ao `grep`.

## Quem declara flag ganha o próprio `-h`

Duas maneiras de um comando ter help, e o DISCO escolhe qual — o gatilho é o
arquivo importar `commander`:

| o arquivo | o help dele é | quem valida a flag |
|---|---|---|
| não importa commander (29 dos 30) | o docstring `//!`, impresso como `Examples:` | ninguém: o router usa `allowUnknownOption` |
| importa e declara `Command` | o que o commander RENDERIZA — `Arguments:`, grupos, quebra na largura do terminal | o commander, incluindo `.conflicts()` |

O segundo caminho existe desde 18/08 (`src/vscode/set.ts` é o primeiro). Duas
pegadinhas medidas ao abrir ele:

- O router precisa **desligar o help dele** (`helpOption(false)` +
  `passThroughOptions()`), senão o commander de FORA responde primeiro e o `-h` do
  script nunca chega — imprimia `Options: -h, --help` e mais nada.
- `passThroughOptions()` exige `enablePositionalOptions()` no PAI, e o commander
  estoura na MONTAGEM da árvore quando falta: derruba `my` inteiro, não só o verbo.

Quando escolher qual: só declare `Command` quando o comando tem GRAMÁTICA — modo,
fonte, posição — porque é aí que combinação inválida existe pra ser recusada. Pro
resto, a primeira linha do docstring já é a descrição. O porquê inteiro, com o
caminho errado que a gente andou primeiro, em
[`../../03_resources/references/clis/001_prototipar_no_commander.md`](../../03_resources/references/clis/001_prototipar_no_commander.md).

## Lib é o que alguém IMPORTA

`src/workflows/tree.ts` não é comando; `src/workflows/show.ts` é. No fonte os
dois são `.ts` com código no topo, então a extensão não separa. O que separa é
um fato do disco: **lib é arquivo que outro arquivo importa.**

O `.test.ts` não conta na varredura — o teste de um comando importa o comando, e
sem essa linha todo script testado sumia da CLI (`my meta` sumiu, medido).

Isto é PONTE. O destino é o arquivo dizer ele mesmo que é comando:

```ts
export function main(argv: string[]): number | Promise<number>
```

Quem exporta `main` a CLI **chama** — sem processo filho, e testável sem CLI
nenhuma. Quem não exporta ainda roda por `bun run`, e é o único lugar da CLI que
sabe que `bun` existe. Quando o último dos 30 migrar, tanto o `spawn` quanto a
heurística de import saem juntos.

## `@verb` DESCREVE; nunca declara

Um subverbo tem a docstring do arquivo. Um verbo é uma PASTA, e pasta não tem
onde guardar a própria frase — sem isso o help dizia `6 subcomandos`, que é
contagem, não descrição.

```ts
class My {
  @verb("o pedido que chega vira arquivo, com a hora") inbox() {}
  @verb("a barra lateral do VS Code, desenhada do disco") ws() {}
  @verb("os agentes vivos NESTA caixa") "herdr/agents"() {}   // aninhado
}
```

A chave é o **ENDEREÇO** da pasta, e o nome do método entre aspas é onde a barra
cabe. Chavear pelo nome nu fazia `my herdr --help` imprimir a frase do
`my agents` do TOPO no `herdr/agents`, porque as duas pastas se chamam igual
(medido 22/08) — e descrição errada é pior que ausente: ela não parece faltar.

O corpo do método é vazio de propósito: quem executa é o subverbo, achado no
disco. **Pasta sem `@verb` continua aparecendo**, só que sem a frase; **`@verb`
sem pasta não vira comando nenhum.** A CLI continua sendo o disco — isto é a
legenda dela, e a legenda não pode inventar comando.

Pasta ANINHADA pode ficar sem frase — o help dela abre depois de já se saber o
que se procura. A de TOPO não, e [`my.test.ts`](my.test.ts) trava as duas
pontas: nenhum verbo de topo cai em `N subcomandos`, e nenhuma frase aponta pra
pasta que não existe (foi o que achou as legendas órfãs de `tasks` e `claude`).

Decorator LEGADO, que é o que o bun implementa: assinatura `(target, key)`, e o
nome do verbo é o `key`. Medido em 17/08 — na forma TC39 o `ctx.name` chega
`undefined`.

## Por que o `just` morreu

No `justfile` cada receita era uma declaração à mão, e o nome nascia solto do
código: era assim que se chegava em `workspace-close`. O `mod` conseguia trazer
o escopo de volta, mas ao preço de um `cli.just` por pasta — cinco arquivos que
diziam o que o `ls` já dizia.

Aqui o escopo vem da pasta, de graça, e a única coisa que precisa estar certa é
onde o arquivo mora.

**Os três `.just` saíram do disco em 19/08**, depois que os dois últimos
consumidores ganharam verbo: `my check all` e `my system hooks install`. Não
ganharam nada `target`, `pendente` e `minuta-gaps` (uma linha de shell, zero
chamadores) nem `interview`/`sprints`/`do-sprints`, que já apontavam pra verbos
que o `meta.ts` não tem — receita viva pra código morto é o que o runner escondia.

## Interpretado, não compilado — e isso é a decisão, não a preguiça

O `my` global é um shim de três linhas em `~/.bun/bin/my` que roda o FONTE.

`bun build --compile` foi considerado e **quebra o desenho**: dentro do binário,
`import.meta.dir` resolve pro sistema de arquivos embutido, então a varredura de
`src/` não acha nada. Pra compilar, a árvore teria que ser assada em tempo de
build — e aí a CLI passa a mentir entre um build e outro, que é exatamente a
propriedade que o "pasta é verbo" comprou.

O preço medido em 17/08: **41ms** de fora do repo, `my workflows list`. Um build
no pre-commit economizaria uns 30ms e cobraria uma dependência nova, um passo de
build e uma janela de staleness. Não vale.

## O que a execução deixa: um COMMIT, e mais nada

[`core/rec.ts`](core/rec.ts) escrevia uma pasta em `_events/` por execução, e
`_events/` morreu em 17/08. Hoje ele só roda o arquivo como processo, pro script
que ainda não exporta `main`; o que substituiu é `#commit_is_the_report`.

## Nos arquivos, referencie o comando

Documento desta casa cita o verbo, nunca o caminho do script:

```
`my resources worktree_and_staging`   ✓
`bun run src/meta.ts resources …`     ✗
```

O caminho muda quando o arquivo se move; o verbo não. E o verbo é o que alguém
consegue colar no terminal sem traduzir.

## References

- @03_resources/references/system/001_steps.md — o run que uma execução deixa em `output/NNN_<slug>/`
- [`../CONTEXT.md`](../CONTEXT.md) — o mapa de `src/`
