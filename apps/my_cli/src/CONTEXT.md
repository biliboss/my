---
type: context
---

# scripts

O que esta casa **não** conseguiu resolver escrevendo markdown melhor. A regra do
@CLAUDE.md continua de pé — sem script no PROCESSO — e cada arquivo existe por um
motivo apontável: `wx` atômico porque `NNN_` não desempata duas sessões, `fstat` no
fd 0 porque `!isTTY` trava pra sempre, `pbcopy` porque clipboard não se escreve.

## O caminho É a capacidade

O nome não é etiqueta, é a interface: `ls src/*/` responde o que esta casa sabe
fazer, sem abrir arquivo e sem registry. É o critério do @CONTEXT.md (*navegável por
pasta*) aplicado a código — se precisa ler o corpo do script pra descobrir a
capacidade, o nome está errado, não o leitor. Uma forma de nome por camada:

| camada | o nome é | responde | exemplo |
|---|---|---|---|
| `<contexto>/<caso_de_uso>.ts` | o **verbo** do que se faz | *o que eu consigo fazer?* | `inbox/capture` — captura pra inbox |
| `shared/<coisa>.ts` | o **substantivo** da primitiva | *onde mora o pedaço reusado?* | `shared/file` — mexer em arquivo |
| `check/<pergunta>.ts` | a **pergunta** que ele prova | *o que está garantido?* | `citations` — todo caminho citado abre? |
| `system/metrics.ts <o_que_se_mede>` | o **substantivo medido**, como subcomando | *o que de fato aconteceu?* | `task-runtime` — quanto leva uma tarefa |

Contexto é onde o trabalho acontece; `system/` e `check/` são o sistema falando sobre
si mesmo — o único lugar onde script olha pro repositório em vez de pro mundo. A
fronteira paga: `inbox/capture` errado custa uma captura perdida, `check/citations`
errado deixa o mapa inteiro mentir. O que o nome não couber, o `//!` do arquivo cobre.

## A árvore, que É a CLI

```
src/
  cli/             a CLI — varre esta árvore e monta o commander do que achou
  check/           um arquivo por PERGUNTA · 15 deles · `my check all` roda todos
  herdr/           o ÚNICO lugar que shella `herdr` · workspaces · tabs · panes
  agents/          os agentes da frota, do lado de cá do herdr
  askuser/         o popup binário — a pergunta que bloqueia até ter resposta
  gh/              o que fala com o GitHub
  inbox/           capture.ts — um caso de uso, um arquivo, `capture.test.ts` ao lado
  projects/        um projeto novo, e ele RECUSA sem resultado/prazo/área
  tasks/ sprints/  a menor unidade, e o lote dela
  workflows/       list · show — os verbos da casa, lidos do disco
  system_design/   big picture · layers · um doc por fluxo
  vscode/          set decide o que a barra lateral mostra
  system/          hooks · metrics — o sistema medindo a si mesmo
  shared/          primitiva com DOIS chamadores · `schema.ts`+`db.ts`: o banco
  resources/       tudo que a casa SABE · `index.ts` é o verbo pelado · 3 lentes
  meta.ts · runs.ts   soltos: o META e o run
  references.ts    APELIDO de `my resources read` — a chamada velha, sem o verbo velho
```

Um arquivo por caso de uso, nome é o VERBO — nunca o domínio repetido
(`inbox/inbox.ts`); contexto com mais de um verbo ganha `CONTEXT.md` próprio.

**A CLI É o espelho da árvore — e o que NÃO é espelho é o atalho.** Ninguém declara
comando: `cli/core/scan.ts` varre o disco. Mas o herdr tem UM verbo que fala nome,
`my herdr agents cli :ab alice +bruno`, porque a forma espelhada custava cinco
comandos e quatro ids decorados pra subir dois agentes. A árvore é o índice de
CAPACIDADE; a CLI é a superfície pra USAR — onde discordam, manda o uso.

`shared/` só recebe o que **já** tem dois chamadores — o `slug` do `notificar` NÃO
subiu com os outros três: separa com `_` e não corta em seis palavras, então é outra
política, não a mesma primitiva.

## `check/`: o nome do arquivo é a PERGUNTA

`citations` — todo caminho citado abre? `reciprocal` — toda aresta tem a volta? A
navegação é o `ls`, sem runner e sem registry; `pre-commit` é o hook versionado, e
entra por `my system hooks install`. **O contrato de um check** — nível, saída,
`--fix`, e como escrever um novo — mora em
@03_resources/references/scripts/system/CONTEXT.md: a regra tem um dono, e escrita em
dois lugares é como as duas versões divergem na primeira correção.

## `system/metrics.ts`: um subcomando por COISA MEDIDA

**Três**, e quem lista é o comando — `task-runtime` · `claude-session` · `askuser`,
impressos ao rodar sem argumento. Aqui é frase e não tabela porque esta já listou
cinco: dois morreram com o `_events/` e ninguém notou.

## O porquê, quando ele não cabe num mapa

- por que bun e nada mais, e por que `.ts` é em inglês —
  @03_resources/references/scripts/002_bun_e_ingles.md
- qual script virou verbo, por qual medição, e o que morreu junto —
  @03_resources/references/scripts/001_o_que_subiu_de_nivel.md
- o estado de UMA MÁQUINA (`~/.me/me.db`), a fronteira `check/` × `metrics/`, e por que
  a suíte não roda inteira — @03_resources/references/scripts/003_estado_de_maquina_no_sqlite.md

## Verify

```bash
bun test ./src/<pasta>/<arquivo>.test.ts   # UM ARQUIVO POR VEZ — ver abaixo
bun src/cli/my.ts --help                   # os verbos, lidos do disco (sem `--help` sai 1)
```

**Nunca rode a suíte inteira:** `bun test src/` mente (sai 0 com teste falhando) e
`bun test ./src/` escreve no `~/.me/me.db` REAL — medições e causa em
@03_resources/references/scripts/003_estado_de_maquina_no_sqlite.md.
