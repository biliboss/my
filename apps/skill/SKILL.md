---
type: skill
name: my
description: "O CLI `my` — a interface do sistema pessoal do Gabriel: notas e zettels, notas diárias, inbox, projetos, sprints e tasks, kanban, workflows, recursos, e a ORQUESTRAÇÃO DE AGENTES (frota no herdr, times de plantão, canais de chat). Use quando o pedido for gerir esse sistema em vez de escrever código de produto: anotar uma ideia, registrar o dia, capturar um pedido, abrir projeto/sprint/task, ler o processo que roda um pedido, subir ou despachar agente, perguntar pro humano numa tela que bloqueia, desenhar antes de codar, ou provar que nada apodreceu. A regra que ela existe pra impedir: editar à mão o que já tem verbo. Dispara em \"anota isso\", \"nota do dia\", \"joga na inbox\", \"cria um projeto\", \"abre uma sprint\", \"que processo roda isso\", \"lê a referência\", \"sobe um agente\", \"manda pro agente\", \"pergunta pro Gabriel\", \"roda o check\", \"desenha o call stack\", \"cria o system design\", \"que comando usa\", \"onde ficou o registro\"."
---

# my — o comando, nunca o caminho

## Por que esta skill existe

`my` é o CLI de um sistema pessoal inteiro — **a casa `~/src/me`**, onde ideia,
dia, pedido, projeto, sprint, task, processo, recurso e frota de agentes são
pasta e arquivo em disco. Quase tudo ali é DERIVADO do disco, então há dois jeitos
de uma sessão se perder: ler a árvore inteira e gastar o contexto antes de
trabalhar, ou não ler nada e improvisar processo.

Esta skill é o atalho entre os dois: **a menor coisa que faz um agente rotear
certo na primeira tentativa.** Rodar `my --help` descobre os verbos; o que ela
adiciona é o que o help não conta — qual verbo responde qual PEDIDO, o que a
casa recusa fazer à mão, e o gosto que separa um comando certo de um comando que
sai 0 sem ter acontecido.

Chame-a sempre que o pedido for **gerir o sistema** em vez de escrever código de
produto: anotar, registrar o dia, capturar um pedido, abrir trabalho, ler o
processo, despachar agente, perguntar ao humano, validar.

Três coisas que ela existe pra impedir:

1. **Editar à mão o que tem verbo.** `my projects new` recusa projeto sem
   resultado/prazo/área; `mkdir` não recusa nada, e o projeto nasce quebrado.
2. **Abrir `META.md` pra ler.** 2000+ linhas quando se precisa de uma. `my meta`
   resolve por NOME, e o nome sobrevive a toda edição acima dele.
3. **Improvisar processo na sessão.** Todo pedido roteia pra um workflow ANTES de
   qualquer trabalho. Pedido que não cabe em nenhum é pedido pra construir um.

## A regra que economiza o resto: pasta é verbo, arquivo é subverbo

Nada declara comando. `apps/my_cli/src/cli/my.ts` varre `src/` na abertura e monta
o commander do que achou — mover um arquivo MUDA a CLI, e é esse o ponto: é o que
impede um comando de existir sem código atrás.

Consequência prática: **`my <verbo>` sem argumento é sempre a legenda daquele
verbo**, e é mais barato que adivinhar. `my` sozinho lista os 28 verbos.

**Sem verbo pra isso? É pedido pra construir um.** Arquivo novo em
`apps/my_cli/src/<pasta>/` com um `//!` na primeira linha JÁ é o comando — a
docstring vira a descrição no help. `.test.ts` não vira comando.

## Do pedido ao verbo

| o pedido é | rode |
|---|---|
| **tive uma ideia, anota** | `my notes new` · `my notes` lista, `-g <termo>` procura |
| **registra isso no dia de hoje** | `my daily_notes add` (append-only; o dia congela) |
| **chegou um pedido** | `my inbox capture "<verbatim>"` · `list` · `pull` · `process` · `drop` |
| que labels existem, e quantos | `my labels` (derivado das notas e dos dias, nunca guardado) |
| **qual processo roda este pedido** | `my meta` · `my meta resources <nome>` |
| que workflow roda, e qual o contrato dele | `my workflows list` · `my workflows show <nome>` |
| **ler N instruções de uma vez** | `my references <nome1> <nomeN>` (apelido de `my resources read`) |
| onde este assunto aparece na casa | `my resources -g <termo>` · `my resources search <termo>` |
| a forma pra copiar (landing, outline, call stack) | `my resources templates` |
| **criar um projeto** | `my projects new --resultado … --prazo … --area …` |
| que projeto nasceu torto | `my projects check` (`--json/--jsonl/--tsv/--watch`) |
| **abrir uma sprint** | `my sprints new "<título>" [-P <proj>] [-n <nnn>]` |
| criar a task DELA | `my tasks new "<título>" [-S <nnn>] -d <min> -p "<prova>"` |
| ver sprints com a SOMA dos minutos | `my sprints list [-P <proj>]` (exit 1 acima do teto) |
| começar / fechar uma task | `my tasks start <sprint>/<nnn>` · `my tasks done <nnn>` |
| a fila em movimento | `my tasks monitor` (uma linha por mudança de estado) |
| **um board, cards, WIP** | `my kanban open|capture|add|move|tag|limit|close|list|check|metrics` |
| o plano de um ciclo, com o link de cada issue | `my runs <run>` · `my runs` lista |
| **desenhar um projeto novo** | `my system_design new <slug>` |
| projeto antigo com `callstack.md`/`outline.md` soltos | `my system_design normalize <slug>` |
| **perguntar pro humano e BLOQUEAR** | `my askuser ask` |
| **subir um agente** · ver a frota | `my agents start …` · `my agents list` |
| despachar trabalho endereçado · ler o que voltou | `my agents send <agente> "<texto>"` · `my agents read` |
| entregar UM stage a um agente que roda e termina | `my agents delegate` |
| **montar um time de plantão** | `my teams up` · `watch` · `claim` · `list` · `down` |
| falar/ler num canal | `my chat say <canal> "<texto>"` · `my chat read <canal>` · `my chat listen` |
| workspace, aba, pane do multiplexador | `my herdr workspaces|tabs|panes …` |
| **digitar num pane** (a chamada mais poderosa da casa) | `my herdr panes send <pane> "<texto>"` |
| ver o que um pane mostra | `my herdr panes read <pane>` (ex.: `w3K:p2`) |
| issue/PR do GitHub, com o link que o ciclo cita | `my gh issues` · `my gh prs` |
| a sidebar do VS Code | `my vscode set` (`-p <n> <path>` põe na POSIÇÃO; `-n` só imprime) |
| **provar que nada apodreceu** | `my check all` (16 subverbos; sai 1 quando acha) |
| onde as coisas ficam, e quem decidiu | `my home paths` · `my home env` · `my home check` |
| o que esta casa mede sobre si | `my system metrics` |

Rodar o comando no herdr da OUTRA caixa: `--remote <host>` é global.

## As três raízes, e por que confundi-las quebra tudo

```
root      ~/src/me     a CASA — o que o CLI lê e escreve      file:~/.me/home
code      ~/src/my     o CÓDIGO — este monorepo               anchor:package.json
machine   ~/.me        ESTADO DE MÁQUINA — db, worktrees      default:~/.me
```

**Nunca hardcode nenhuma das três**: `$(my home)` resolve a casa, e ela é
trocável (`my home <caminho>`). Estado de máquina vai pro sqlite em `~/.me/me.db`
(drizzle, `bun:sqlite`, migra na abertura); markdown e YAML seguem sendo o banco
do que é DECIDIDO e versionado.

## O que o `--help` não conta

### Rotear antes de trabalhar

**Todo pedido sobe pela rampa primordial — `my workflows show route_request`** —
antes de virar trabalho. Improvisar o processo na sessão é o que faz sprint
nascer sobre suposição.

Os workflows são agrupados por FAMÍLIA, e a família é a pergunta que ela responde:

```
my workflows list                       as famílias, com a contagem de cada uma
my workflows list <família>             os workflows dela, com a primeira linha do contrato
my workflows show <nome>                o CONTEXT.md de um, inteiro — o nome BARE, sem o caminho
```

| família | a pergunta dela |
|---|---|
| `01_sell_what_deliver` | de onde vem demanda |
| `02_deliver_what_sell` | planejar → construir → validar (é onde mora quase todo trabalho de código) |
| `03_make_people_love_it` | o cliente já tem, e fala com a gente |
| `shared_workflows` | o que as três herdam — rotear, delegar, monitorar, pesquisar, gerar output |

**Não copie essa árvore pra lugar nenhum**: `my workflows list` é a fonte, e uma
tabela de nomes escrita à mão apodrece na direção que ninguém olha. A tabela
acima nomeia as FAMÍLIAS porque elas mudam em ano; os workflows dentro delas
mudam em semana.

**Nenhuma etapa é obrigatória** — escopo fechado pula entrevista, disco medido
pula research. Etapa pulada vira `#declared_deviation` escrito ANTES de rodar;
pular calado é o que faz o resto herdar uma suposição. E **nenhum workflow faz
merge**: integrar é decisão de gente.

### Confiança abaixo de 95 não escolhe: pergunta

Mas o disco responde primeiro: `ls`, `my resources -g <termo>`, `wc -l`. Pergunta
que um comando responderia gasta rodada do humano.

**E todo turno substantivo FECHA num popup, não num parágrafo.** Pergunta em
prosa no fim da resposta some no scroll e obriga o dono a escrever de volta; o
popup é uma tecla. `my askuser ask` sobe a janela na frente do que ele estiver
fazendo e BLOQUEIA — e **as quatro saídas são contrato**:

```
0 escolheu   2 PULOU   3 EXPIROU   1 não consegui perguntar
```

Tratar `2` ou `3` como `0` é seguir com uma decisão que ninguém tomou. A opção
carrega o **tempo esperado**, medido ou estimado, porque é o número que decide se
agora é o momento:

```
"Disparo as 4 unidades?"
  faz    — 4 agentes em paralelo · ~10 min cada · ~12 min de parede
  espera — primeiro decido a S5 e as duas decisões da S6
```

A rodada vira `output/NNN_<slug>/interview.yaml` com `confianca:` em TODA opção,
não só na escolhida — é o metadado que depois diz onde o agente erra mais. O
contrato inteiro (grid de até 9 previews, `--spec`, stdin): `my references 015_askuser`.

### A frota executa; o humano decide

Três agentes permanentes vivem no workspace `workflows`, um por main, e recebem
trabalho endereçado pelo barramento de chat (`.my_agents_chat.tsv`, append-only).
Subir é `my workflows show delegate_agents`; saber que terminou é
`my workflows show monitor_agent`; o porquê do barramento é `my references 016_agent_bus`.

**A AUTORIDADE fica na sessão principal** — a entrevista, o portão dos 95%,
publicar issue, promover `staging`→`main`, falar com cliente. Um agente pode
PERGUNTAR de onde estiver; o que ele não pode é DECIDIR no lugar de gente.

**O workspace é PERMANENTE, e o agente fica nele.** Agente vivo guarda o que já
leu — contrato, repo, ambiente — e a próxima tarefa começa de onde a anterior
parou. Continuar trabalho é `panes send`, não `agents start`.

### A instrução vem por NOME, nunca por caminho

O `CONTEXT.md` de um main ROTEIA; a instrução mora em `references/` e chega por
`my references <nome1> <nomeN>` — N de uma vez, inteiras. **O nome é ÚNICO na
casa inteira**, e é isso que deixa um main citar a referência do outro sem
caminho relativo.

**`my references` sem argumento LISTA todas** — não copie essa lista pra lugar
nenhum. Tabela de nomes escrita à mão é derivada do disco e apodrece na direção
que ninguém vê. **Errou o nome? o comando ensina**: ele imprime as que existem.

**Nome AMBÍGUO não resolve** — `system_design` existe como regra e como template,
e `my references system_design` recusa. Estreite (`my resources <assunto> <arquivo>`)
ou use o índice do META (`my meta resources system_design`).

**A forma do nome:** o prefixo é o contexto (`git_` `gh_` `cc_` `in_` `out_`
`doc_` `qa_`) e o nome depois dele diz o que o arquivo FAZ. Prefixo novo só
quando o assunto tem DOIS arquivos. Referência que dois workflows copiaram nasceu
no lugar errado — o lugar dela é o contrato compartilhado, `00_shared`
(`my workflows show _contract`), e é de lá que vêm as quatro que todo mundo
herda: `git_always_clean` · `git_main` · `gh_general` · `git_merge_staging`.

**A referência que o contrato pede e o disco não tem** é o caso mais valioso:
ponteiro pro vazio não é motivo pra improvisar a instrução na sessão — **é pedido
pra escrever a referência que falta.** Proponha criá-la com `my askuser ask`.

### Desenhar antes de codar

Feature nova ou processo novo **não vira código antes de virar desenho**. O padrão
de projeto é `system_design` (`my meta resources system_design`): uma pasta
`docs/` com `00_system_design_big_picture.md` (grafo + parágrafo curto, sempre) e
`01_system_design_layers.md` (a árvore por camada), mais um
`NN_system_design_<fluxo>.md` por fluxo que mereça sequência própria.
`normalize` PROPÕE o split, não corta fluxo sozinho — corte de seção é julgamento.

A forma de CADA doc é `callstack_notation` (sequência) e `outline_notation`
(árvore). O que não se descobre lendo os templates é o GOSTO, e ele é este:

**Uma seção `##` por FRONTEIRA**, cada uma com o seu `sequenceDiagram` — a lista
de `##` já É o índice, sem tabela resumindo por cima. Participante com CAMINHO é
nosso (verificável); ator sem caminho é de fora. `->>` é chamada, `-->>` é FATO
emitido. Um evento só existe quando algo reage a ele: passo que só narra não emite.

**O nó de um CLI nosso é o COMANDO**, na gramática do CLI:

```
my runs: { run }                 verbo sem subverbo   → src/runs.ts
my gh: issues { issue url }      verbo com subverbo   → src/gh/issues.ts
cc: AskUserQuestion { … }        o harness            → PascalCase, é o nome real
my askuser: ask { … }            a pergunta desta casa → o que um agente USA
```

**Helper não é nó.** `my readPlan` não existe: `readPlan` mora dentro de
`my runs`, e desenho que desce até o helper é o código escrito duas vezes.

**Método camelCase, evento PascalCase, e o evento carrega o artefato que deixa** —
`my:SprintsRead { sprints.yaml }` é leitura crua,
`coding:SprintStateJoined { sprints_gh.yaml }` é o disco já cruzado com o de fora.
Dois nomes iguais com artefatos diferentes são dois fatos diferentes.

**Linguagem ubíqua, e ela ganha verbo.** Se a coisa se chama sprint, não escreva
"plano". Termo do domínio sem verbo é termo que vai ser reescrito diferente em
cada arquivo.

**Desenho não carrega medição.** `arquivo:linha`, contagem, teto de config: nada
disso — isso vai pro `summary.md` do run. **Valida antes de implementar:** o
desenho fecha quando todo `ON <comp>:<Event>` tem um emissor.

### A sprint é uma PASTA, e ela tem teto de 10 minutos

```
01_projects/<proj>/sprints/999_<slug_ate_5_palavras>/CONTEXT.md
01_projects/<proj>/sprints/999_<slug>/001_<nome_ate_4_palavras>/CONTEXT.md
```

A sprint conta pra **BAIXO desde 999** — mais nova = número menor = primeiro num
`ls`. A task conta pra **CIMA desde 001** dentro dela, porque ali o número É a
ordem de execução. Os dois são ENDEREÇO: número ocupado RECUSA, nunca empurra o
vizinho. A task **não declara `sprint:`** — a pasta que a contém já diz.

Cada task declara `duration`, a sprint é a SOMA, e acima do teto a alavanca é
PARTIR: outra sprint, depois outro pacote. **Nunca encolher a task pra caber**
(`my meta resources sprint_order_and_size`). Quem acusa: `my sprints list`
(exit 1), `my projects check` (`sprint_over_ceiling`, `sprint_duration_missing`,
`unsprinted_tasks`).

### Um pedido é um workflow; um TRABALHO é uma corrente

A tabela de roteamento serve um pedido. Trabalho de verdade atravessa famílias:

```
suporte / canal        puxa o pedido do cliente   → asks.md
request_to_issue       corta as issues            → o run, com as issues
qa_and_merge           afere se é problema mesmo
                       responde no canal          ← o elo que fecha, e o que mais se esquece
```

- **A saída de um elo é o arquivo que o próximo consome como `context`** — não um
  resumo na sessão.
- **O que não está no arquivo não atravessa.** Cinco subagentes escreveram cinco
  issues sem a citação do cliente porque a linha do `issues.yaml` não a carregava.
- **Cada elo é invocado à mão**, e o `state.yaml` de cada um aponta pro anterior.

O porquê medido, elo a elo: `my references 011_a_corrente`.

### Comando fala QUATRO formatos, e o grão muda com o formato

`--tsv` e `--jsonl` saem na LINHA que alguém vai filtrar (a task, não o run),
`--json` sai inteiro pro `jq`, e sem flag sai alinhado pro humano. Comando que só
fala com humano obriga o próximo a reparsear texto alinhado — e alinhamento muda.

**Comando com GRAMÁTICA nasce declarado em commander, e o corpo vem depois.**
Onde existe combinação inválida, `.option()` e `.conflicts()` recusam sozinhos e
o `-h` sai renderizado. O `main` recusa com exit 1 até a escrita existir —
comando que sai 0 sem fazer nada faz o chamador achar que aconteceu.
`my references 001_prototipar_no_commander`.

## Onde fica o registro

**Uma trilha só: a pasta do run.**

```
03_resources/00_company/<família>/<fase>/<workflow>/output/NNN_<slug>/
  summary.md · interview.yaml · findings.md · sprints.yaml · state.yaml · F<N>_*.md
```

Ex.: `02_deliver_what_sell/01_plan/request_to_issue/output/969_fonte_por_dado/`.
Nem todo workflow tem `output/` — só os que produzem ciclo.

**O número conta pra BAIXO desde 999** — o mais novo tem o menor número e é o
primeiro que um `ls` mostra.

**`_events/` MORREU em 17/08.** Eram 151 pastas e 3,3 MB de recibo por execução,
e o que se aprendeu com elas foi zero. O golpe final foi medido: as 10 tasks de
um lote deviam ter deixado um recibo cada, o contrato pedia, o prompt citava, e
saíram ZERO. Regra que ninguém cumpre e nada verifica não é regra. **O COMMIT é o
relatório**, e a pasta do run é o que foi decidido. `my references 001_steps`.

## Validar antes de dizer que terminou

```bash
my check citations   # citação apontando pro vazio
my check context     # o CONTEXT.md de cada pasta continua MAPA (≤100 linhas)
my check rules       # cada regra na pasta que o TYPE: dela nomeia
my check notes       # o contrato de ID dos zettels
my check ratchet     # a catraca: nenhum número desta casa pode SUBIR
my check all         # todos de uma vez, e é o que o gate roda
```

`my check --help` é a fonte dos 16 subverbos; a lista acima é conveniência, não
contrato. **O buraco conhecido:** ninguém cruza a frota VIVA (`my agents list`)
com o `agentes[]` que os runs declaram, então agente órfão não aparece sozinho.

## Mexer aqui sem quebrar

- **Commit por pathspec: `git commit -- <caminhos>`.** O índice é compartilhado
  com agentes de outro ciclo; um `git commit` pelado já varreu 43 arquivos de
  outra sessão pra dentro (medido em 16/08). `git add` explícito não basta — o
  commit precisa dos caminhos também. Atômico, e `push` no mesmo fôlego.
- **`git stash` é PROIBIDO na casa.** Não tem como ser escopado: leva a árvore
  inteira, inclusive o refactor que outra sessão está escrevendo neste segundo
  (medido em 17/08, nove arquivos). Quer medir contra o HEAD?
  `git worktree add /tmp/x <ref>`.
- **Não monte task list** (`TaskCreate`/`TaskUpdate`) nem lista de afazeres na
  resposta. O estado real já mora em arquivo.
- **Contrato tem teto de 100 linhas.** Passou, o que sai vai pra `references/`.
- **Cite o VERBO, nunca o caminho do script.** `my references worktree_and_staging`
  ✓ · `bun run apps/my_cli/src/meta.ts …` ✗.
- **Escreva enquanto acontece.** Rodada que só viveu na sessão morre com ela.

## Se `my` não estiver no PATH

Shim de três linhas que roda o FONTE, nunca binário compilado (`bun build
--compile` congela a varredura de `src/` no estado do último build):

```bash
exec bun run "$HOME/src/my/apps/my_cli/src/cli/my.ts" "$@"
```

## References

Tudo abaixo abre por NOME, de qualquer diretório — é o ponto do `my references`.

- `my references 001_steps` — o step, o run em `output/NNN_<slug>/`, e por que `_events/` morreu
- `my references 015_askuser` — o contrato inteiro da pergunta que bloqueia
- `my references 016_agent_bus` — o barramento: como agente endereça agente
- `my references 011_a_corrente` — por que um trabalho atravessa famílias, medido elo a elo
- `my references 009_call_stack` — o porquê de cada regra da notação, com o que cada uma custou
- `my references 001_prototipar_no_commander` — comando com gramática nasce declarado
- `my meta resources system_design` — a regra: a pasta `docs/`, os dois fixos, como normalizar
- `my meta resources sprint_order_and_size` — o teto de 10 minutos e a alavanca de PARTIR
- `my resources templates` — as formas pra copiar (`call_stack`, `outline`, `system_design`)

Da própria skill, em `references/experimental/` — **rodou, foi medido, pode
morrer.** Não é contrato; é relato, com o que NÃO foi medido escrito junto:

- `references/experimental/delegar_workflow_ao_herdr.md` — delegar um workflow a
  um agente do herdr: as três chamadas, o system prompt por
  `--append-system-prompt-file`, o `MY_AGENT` no ambiente do pane
