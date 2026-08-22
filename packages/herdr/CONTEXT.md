---
type: context
depends_on: src/shared/result.ts
impacts: 02_areas/00_workflows/04_experimental/01_review_loop/CONTEXT.md · 02_areas/00_workflows/04_experimental/01_review_loop/run.ts · 02_areas/00_workflows/04_experimental/00_compare/CONTEXT.md · 02_areas/00_workflows/04_experimental/00_compare/run.ts
---

# src/herdr

O multiplexador onde a frota mora, e tudo que esta casa sabe fazer com ele.
Quatro substantivos DELE — workspace, tab, pane, agent — e um arquivo por verbo
dentro de cada um.

```
herdr/
  run.ts          o ÚNICO `Bun.spawn(['herdr', …])` da casa
  policy.ts       a cerca e a cortina — as duas opiniões que o herdr NÃO tem
  agents/cli.ts   `my herdr agents cli` — o único verbo, e ele fala NOME
  agents/roster.ts o mapa nome → pane, em disco
  workspaces/     list · resolve · create · focus · close · block
  tabs/           list · create · rename · focus · close
  panes/          read · send · split · grid
  agents/         list · start
```

## Um verbo na CLI, e ele fala NOME de agente

`my herdr agents cli` é a única porta. Eram quatro — `workspaces`, `tabs`, `panes`,
`agents` — e os três primeiros expunham a dificuldade do multiplexador pra quem só
queria dois agentes lado a lado: criar workspace, criar aba, partir pane, decorar
quatro ids, subir o binário.

```bash
my herdr agents cli                       os vivos, com nome
my herdr agents cli :ab alice +bruno      + ao lado · / embaixo, relativo ao ÚLTIMO pane
my herdr agents cli alice "roda os testes"
my herdr agents cli alice                 lê a tela dele
my herdr agents cli kill :ab
```

O id de pane continua existindo — é o vocabulário do herdr, e todo arquivo abaixo
fala nele. O que mudou é que **trabalhar não exige saber nenhum**. Os módulos
seguem invocáveis direto (`bun run src/herdr/tabs/list.ts`) pra quando a
investigação precisar do recurso cru.

`|` seria o símbolo óbvio pra "ao lado" e está fora da DSL: o shell come o pipe
antes de o `just` ver, e uma DSL que exige aspas deixa de ser uma frase.

## Por que é uma pasta, e não `shared/herdr.ts`

`shared/` é primitiva reusada — o critério de [`../CONTEXT.md`](../CONTEXT.md) é
*substantivo da coisa*. Isto não é uma coisa, é um **sistema externo inteiro**,
com formato de id próprio, envelope próprio e jeito próprio de falhar. Um
arquivo só chegou a 380 linhas e crescia por RECURSO, não por chamador.

A pasta é a fronteira: tudo que sabe o vocabulário do herdr está aqui, e nada
além disso está.

## Uma camada, não duas

A primeira versão tinha `herdr/workspaces.ts` (falava herdr) e
`workspaces/list.ts` (aplicava as marcas) — dois arquivos com o mesmo nome, cada
um com dez linhas. Colapsou: cada verbo faz a própria chamada por
[`run.ts`](run.ts), achata o envelope e aplica a cerca. O que sobra em comum é o
que de fato é comum — o spawn e a política.

## As três coisas que custaram caro

**1. Timeout sempre.** O roteador do `~/src/agency` travou duas vezes em dez
minutos (10/08) porque um filho pendurado congela a thread única do JS. 9000ms
não é chute: amostras de 0,78s a 3,63s, ~2,5x o pior pico. O primeiro valor foi
3000ms, tirado de amostra velha, e virou o próprio incidente.

**2. Exit code não é o veredito.** O herdr responde `exit 0` com envelope de
ERRO — `pane wZZ:p9 not found` sai com sucesso. `result()` olha os dois, num
lugar só.

**3. `send` são duas chamadas.** `send-text` recebe string literal, `send-keys`
recebe NOME de tecla. `send-keys <pane> "echo oi" enter` responde `unsupported
key echo oi` — a primeira coisa que todo mundo tenta.

## O id carrega o pai

`w3K:t2` é aba do `w3K`; `w3K:p2` é pane dele. É esse fato que deixa a
superfície plana: nada precisa ser informado de qual workspace é, e a cerca de
[`policy.ts`](policy.ts) é herdada por prefixo, sem chamada extra.

## O chamador que não migrou: foi deletado

`fleet.ts` fazia `Bun.spawnSync(['herdr','agent','list'])` cru — sem timeout, sem
envelope — e era o segundo chamador que justificava esta pasta. Em 17/08 ele foi
deletado junto com `src/sandbox/` em vez de migrado, e *migração → eliminação
total* fechou pelo outro lado. O que se perdeu junto: o cruzamento entre a frota
VIVA e o `agentes[]` que os runs declaram, que é como órfão aparecia.

## Verify

```bash
bun test src/herdr/            # a herança da cerca, com controle negativo
my herdr agents cli            # o verbo, com nome
bun run src/herdr/workspaces/list.ts   # o recurso cru, quando precisar
```
