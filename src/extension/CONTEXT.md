---
type: context
---

# extension — a árvore `my` no Explorer do VS Code

Uma extensão de verdade, instalada por symlink em `~/.vscode/extensions/`, e ela
mora AQUI e não em `01_projects/` porque não é experimento: é a casa se olhando.
Nasceu dentro do `vscode-terminal-automation` (o experimento de panes) e saiu de
lá inteira em 17/08 — lá ficou só o que é sobre terminal.

**`extension/` não é verbo do CLI.** `src/cli/core/scan.ts` a exclui pelo nome,
junto com `cli/`: aqui é TypeScript que roda no extension host, com
`package.json` e `out/` próprios, e nada disto se executa por `my …`.

## O GOAL, declarado em 17/08

**Cada elemento ganha a VIEW dele.** Uma linha na árvore responde "onde isto está"; a
view responde "o que isto é". Hoje existem duas — issue e PR — e o alvo é uma por
elemento que faça sentido, todas sobre a mesma casca e as mesmas peças (Tailwind +
daisyUI), nunca com HTML solto dentro do pane.

```
webview/
├── shell.ts          a casca: CSP, tema, nonce, a ponte dos botões — decidido UMA vez
├── issue.ts          ✅ a view da issue
├── pr.ts             ✅ a view do PR (checks com nome, diff, branch)
├── run.ts            ✅ o ROTEADOR: o main decide qual view o run recebe
├── run_product.ts    ✅ o plano: sprint · task · proof · coverage
├── run_coding.ts     ✅ o lote: coluna por unidade, recusadas e parqueadas
├── run_qa.ts         ✅ o veredito: o controle em cima, o repro/ clicável
├── unit.ts           ○ a unidade como aba própria
├── commit.ts         ○ o commit: mensagem, arquivos, o trailer Task
└── parts/            as peças que TODA view usa
    ├── state_pill.ts     OPEN · MERGED · CLOSED · DRAFT, na semântica do GitHub
    ├── label_chip.ts     a label na cor que o GitHub deu, tinta por luminância
    ├── gh_body.ts        o `body_html` que o GitHub já renderizou
    ├── comment_card.ts   um comentário
    ├── meta_side.ts      a coluna da direita, que empilha embaixo de `lg`
    └── when.ts           a data no locale de quem lê
```

`ui_rows/` e `webview/` são espelhos de propósito: `ui_rows/issue.ts` é a LINHA,
`webview/issue.ts` é a VIEW, e as duas leem o mesmo dado de `disk/` e `gh/`.

## Como isto é organizado

**Uma linha da árvore é uma COMPOSIÇÃO de widgets.** É por isso que existem duas
pastas no topo, e são as duas que se abre pra mexer na aparência:

```
ui_rows/            uma ROW por arquivo — `run` `unit` `issue` `commit`
ui_row_widgets/     as PEÇAS de uma row — relógio, ícone, contagem, tag, e o `compose`
```

Uma row não monta string: ela declara as peças.

```ts
compose({
  label: runName(run),                              // ui_row_widgets/run_name.ts
  parts: [countdownTimer(run, style)],              // ui_row_widgets/countdown_timer.ts
  icon: rowTypeIcon(run.main, runState(run)),       // ui_row_widgets/row_type_icon.ts
  hover: [...],
})
```

`compose` sabe os quatro slots que um `TreeItem` tem — label, texto esmaecido,
ícone, hover — e some com toda peça que devolve `undefined`. Nenhum widget precisa
saber se é o último da linha.

Isso paga porque **toda mudança de desenho até aqui foi mudança de UMA peça**: o
relógio ganhou segundos, `draft` substituiu a ampulheta, o status saiu da linha e
foi pro hover. Cada uma tocou um arquivo.

`ui_rows/issue.ts` é a issue **como o plano declara** (`issue: 284` no yaml, número e
título do sprint). O que o GitHub acha dela — estado, label, comentário — só chega
quando a aba abre (`gh/pane.ts`). São duas coisas, e é por isso que são dois nomes.

**O resto é o que alimenta as rows:**

| pasta | responde |
|---|---|
| `disk/` | O QUE EXISTE — `runs` acha as pastas, `branches` lê as unidades no repo de trabalho, `commits` lê o git daqui, `issues` lê os números publicados, `eta` faz a conta, `fixtures` é o sandbox |
| `gh/` | o que vem do GitHub: `api` (fetch por `gh`, HTML já renderizado) e `pane` (os painéis) |
| `webview/` | uma VIEW por elemento, sobre `shell` + `parts` — Tailwind + daisyUI compilados em `media/` |
| `tree/` | `provider` (nós → rows, cache, sandbox), `tick` (os dois relógios), `drag` (o caminho da pasta) |
| `log.ts` | o canal de log do editor, sem dependência |

**`disk/` e `ui_row_widgets/` não importam `vscode`** — é isso que deixa `node --test`
alcançar 26 checks, incluindo o scanner contra a casa real.

```bash
cd src/extension && npm test
```

## O laço de DESENHO: as views no browser

Recarregar a janela do VS Code pra olhar uma cor é a forma mais lenta de desenhar, e
custa o estado inteiro da árvore a cada vez. Então:

```bash
cd src/extension
npm run watch     # tsc -w, num pane
npm run dev       # http://localhost:5177, noutro
```

O servidor serve as MESMAS funções que a extensão chama, lendo os runs REAIS da casa —
view desenhada contra fixture é view que quebra na primeira pasta de verdade. Ele observa
`out/` e `media/` e empurra reload por SSE; a página pisca sozinha.

**macOS claro é o default lá**, e por um motivo mecânico: dentro do editor toda cor vem de
uma variável `--vscode-*` que o VS Code injeta no webview, e um browser não injeta
nenhuma. `dev/macos.css` fornece o jogo claro do sistema (Sonoma), e `?theme=dark` troca
pelo escuro — desenho que fica bom nos dois fica bom no tema de verdade de qualquer um.

## O sandbox

O botão 🧪 na toolbar troca o disco por `disk/fixtures.ts`: um run por FORMA que a
árvore real pode ter, escrito à mão e estável — leque rodando, cronômetro no
meio, plano estourado, sem `t0`, sem nada, e o branch que o yaml nomeia e o git
não tem. O título da view passa a dizer `sandbox`, porque dado falso em silêncio
é armadilha. Forma que falta neste arquivo é forma que ninguém desenhou.

Um run do sandbox é REAL de propósito: `978_mkt_funnel_asks` aponta pra
`mktvirtual/mukutu-mono` com os números abertos lá agora (178–182), então clicar numa
issue dele sai no `gh` e renderiza corpo e comentários de verdade. Fixture prova o
LAYOUT; só issue real prova o RENDER — cabeçalho que alguém escreveu, checklist meio
marcada, quatro labels, thread de comentário. Medido em 17/08: a #178 rende 111 linhas
de markdown pela `gh/markdown.ts`.

## A linha: o nome e UM relógio

`via_share_external   11:42`. Nada mais — e o cronômetro conta em SEGUNDOS, porque a
estimativa é boa o bastante pra gastá-los: número que só mexe a cada minuto se lê como
rótulo velho, e o mesmo número descendo se lê como cronômetro sem ninguém explicar.
Passa de uma hora, os segundos saem (`1h04`). Sem plano, ele conta pra frente (`↑33m`).
Sem `t0`, o ciclo não começou e a linha diz **`draft`**, em cinza — verde ao lado de
`draft` leria como "tudo bem, rodando". `batchSettled 3/4u 6c` do lado do nome fazia
de cada linha uma frase pra interpretar, e sidebar se lê de lado. Passo, unidades e
commits estão a um hover, e os filhos já os mostram como linha.

O RAIZ É UM RUN — um plano, um ciclo de código ou um gate de QA — e o ícone diz qual:
`lightbulb` decide, `code` escreve, `verified` aprova. Não existe nível de assunto por
cima deles: ele gastava uma linha inteira com um nome que os filhos já carregam.

A COR é o estado, e o ícone PULSA entre dois azuis enquanto trabalho anda. Medido:
`~spin` NÃO anima ícone de tree item, e não existe API de degradê — a cor de um
`ThemeIcon` é um id de tema. O que se move é a árvore: re-disparar
`onDidChangeTreeData` com outra cor repinta o mesmo glifo, então dois ids alternando
num compasso de 1s é o pulso. Dois azuis, nunca azul→laranja: pulso que empresta a
cor de aviso lê como aviso a cada segundo.

O pulso lê o CACHE, nunca o disco (8s de validade) — é isso que faz um ícone animado
custar zero em vez de um `git log` por segundo.

## O que a árvore responde

O grupo `my` no Explorer (`my.runs`) responde UMA pergunta: **que ciclo da casa
está aberto, e quanto falta?** A fonte é a PASTA do run — `state.yaml` enriquece
quando existe, e run sem recibo aparece igual, marcado. Ficar visível é o que faz
alguém escrever o arquivo; esconder é o que deixa `01_coding` invisível
(0 `state.yaml` em 2 runs, medido 17/08).

A pesquisa que decidiu isto está em
@02_areas/00_workflows/00_main/02_product/output/980_my_no_explorer/.

## Macro view

| # | fase | quem faz | o fato no fim | artefato |
|---|---|---|---|---|
| 1 | registrar a view | `vta` | `vta:MyViewRegistered` | — |
| 2 | varrer os runs | `vta` | `vta:RunsScanned { run[] }` | — |
| 3 | achar o `t0` | `vta` | `vta:T0Resolved { t0, fonte }` | — |
| 4 | estimar o que falta | `eta` | `eta:EtaEstimated { p50, p90 }` | — |
| 5 | desenhar a linha | `vta` | `vta:LineRendered` | a árvore |
| 6 | contar pra trás | `vta` | `vta:TickFired` | — |
| 7 | abrir o run | `vta` | `vta:RunOpened { state.yaml }` | o editor |

## Call stack

```
vta: activate                                                    ON vscode:Activate
├─ createTreeView('vta.my', { treeDataProvider })                → vta:MyViewRegistered
│     createTreeView, nunca registerTreeDataProvider: só o objeto view tem `badge`
├─ scanRuns()                                                    → vta:RunsScanned { run[] }
│  ├─ glob 02_areas/00_workflows/00_main/*/output/[0-9]*_*/       a pasta É a fonte
│  ├─ parse state.yaml                                           opcional: `at`, `next`, `files`
│  └─ resolveT0(run)                                             → vta:T0Resolved { t0, fonte }
│     ├─ state.yaml started_at                                   1ª escolha
│     ├─ _events/*__<assunto>/result.yaml origem.em               2ª: o recibo já existe
│     └─ null                                                    3ª: "sem t0", nunca mtime
├─ eta: estimate(sprints, at, t0)                                → eta:EtaEstimated { p50, p90 }
│  ├─ remainingTasks(sprints.yaml, at)                            duration declarado
│  └─ sample(n)                                                  Monte Carlo, prior de erro
├─ getTreeItem(node)                                             → vta:LineRendered
│  ├─ label = run · description = format(style, eta)              3 estilos, 1 modelo
│  └─ iconPath = ThemeIcon(icon, ThemeColor)                      cor É a urgência
├─ ON view:onDidChangeVisibility                                 → vta:TickFired
│  └─ setInterval(refresh, 60_000)                               só visível ticka
└─ vta.my.openRun                                                → vta:RunOpened { state.yaml }
```

`ON eta:EtaEstimated` não tem consumidor além do `getTreeItem`, e é de propósito:
o Monte Carlo é função pura em `src/my_eta.ts`, testável sem VS Code.

## O que ele NÃO faz

Não escreve nada — nem `state.yaml`, nem `actual_duration`. Enquanto ninguém
escrever o real de volta, o cronômetro sorteia do prior pra sempre; o F2 do run
980 registra isso como o `wrong_when` da feature, não como bug da árvore.

