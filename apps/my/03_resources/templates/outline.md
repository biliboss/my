---
type: template
---

<!--
TEMPLATE — a NOTAÇÃO DE OUTLINE inteira, com o vocabulário e um exemplo real de
cada coisa que esta casa constrói. Copie o pedaço que serve; não copie o arquivo.

A regra de QUANDO se alcança um outline é `my meta resources outline_notation`.
Aqui está a FORMA, e só ela.

Uma linha de comentário por grupo, e o mínimo possível — o outline é legível
porque é curto, e comentário é o primeiro lugar onde ele deixa de ser.
-->

# outline

Uma árvore. Cada linha é `<glifo> <Nome>:` e, quando tem tipo, `: <Tipo>`. A
indentação é a única sintaxe. **A mesma linguagem vai de campo até arquitetura** —
é isso que deixa desenhar uma tela e desenhar um sistema serem o mesmo gesto.

## O vocabulário

| glifo | é | exemplo |
|---|---|---|
| 🔹 | campo / estado | `🔹 runId: RunId` |
| ⚙️ | método / ação | `⚙️ cancel:` |
| 🧩 | componente / widget | `🧩 RunsWidget:` |
| 📄 | template de tela | `📄 EvalsTemplate:` |
| 🖥️ | a camada de UI | `🖥️ UI:` |
| 📖 | stories | `📖 ButtonStories:` |
| 🧪 | testes | `🧪 RunsServiceTests:` |
| 🌐 | API / endpoint | `🌐 RunsAPI:` |
| 🎯 | caso de uso | `🎯 CreateRun:` |
| 📦 | serviço / entidade de domínio | `📦 RunsService:` |
| 🗄️ | repositório | `🗄️ RunRepository:` |
| 🗃️ | store / cache | `🗃️ RunsStore:` |
| 🧵 | worker / workflow durável | `🧵 RunWorker:` |
| 📨 | consumer de evento | `📨 RunCreatedConsumer:` |
| ⏱️ | scheduler | `⏱️ CleanupScheduler:` |
| 🤖 | agente | `🤖 EvalAgent:` |
| ⌨️ | CLI | `⌨️ inspect:` |
| 🏗️ | feature — uma fatia inteira | `🏗️ RunsFeature:` |
| 🏢 | sistema | `🏢 EvalsSystem:` |
| 🧠 💾 ⚡ | as camadas: domínio, dados, background | `🧠 Domain:` |

`[]` no nome do campo é lista: `🔹 runs[]: Run`.

## As primitivas

```yaml
# Um valor composto — campo com tipo, e nada mais.
🧩 Duration:
  🔹 startedAt: DateTime
  🔹 finishedAt: DateTime

# Ação junto do estado que ela precisa: o que o componente PODE fazer.
🧩 Actions:
  🔹 runId: RunId
  ⚙️ open:
  ⚙️ cancel:
```

## Uma tela

```yaml
# Template é a página; widget é o pedaço reusável. O campo diz o que ele CONSOME.
📄 EvalsTemplate:
  🧩 RunViewWidget:
    🔹 runId: RunId
  🧩 RunsWidget:
    🔹 runs[]: Run
```

## Stories e testes

```yaml
# Story é o ESTADO relevante do componente, e a lista deles é a superfície visual.
📖 ButtonStories:
  🧩 Default:
  🧩 Primary:
  🧩 Loading:
  🧩 Disabled:

# Teste é o comportamento GARANTIDO — o outline vira o inventário legível deles.
🧪 RunsServiceTests:
  ⚙️ createsRun:
  ⚙️ returnsExistingRun:
  ⚙️ rejectsInvalidInput:
  ⚙️ cancelsPendingRun:
```

## Uma API, e o caso de uso atrás dela

```yaml
# O endpoint não tem lógica: ele traduz HTTP no caso de uso, e o caso de uso decide.
🌐 RunsAPI:
  ⚙️ POST /runs:      🎯 CreateRun
  ⚙️ GET /runs/{id}:  🎯 ReadRun
  ⚙️ POST /runs/{id}/cancel: 🎯 CancelRun

🎯 CreateRun:
  🔹 input: CreateRunInput
  🔹 output: RunId
  ⚙️ execute:
```

## Repository e store — o que PERSISTE e o que só guarda

```yaml
# Repositório fala a linguagem do domínio; o SQL não vaza dele pra fora.
🗄️ RunRepository:
  ⚙️ save:      📦 Run
  ⚙️ byId:      RunId → 📦 Run
  ⚙️ pending[]: 📦 Run

# Store é estado volátil com dono — cache, sessão, lock. Perder não corrompe nada.
🗃️ RunsStore:
  🔹 ttl: Duration
  ⚙️ put:
  ⚙️ get:
```

## Um worker: DBOS quando o passo não pode se perder, Redis quando pode

```yaml
# Workflow durável: cada passo é retomável, e o estado mora no Postgres do DBOS.
🧵 ImportWorkflow:
  ⚙️ fetchSource:    # step
  ⚙️ normalize:      # step
  ⚙️ persist:        # step — retoma daqui se o processo morrer no meio
  🔹 idempotencyKey: RunId

# Fila tradicional: trabalho barato de refazer, e o custo de perder um é zero.
🧵 ThumbnailWorker:
  🔹 queue: runs:thumbnails
  ⚙️ handle:

# Consumer reage a um FATO que já aconteceu; scheduler reage ao relógio.
📨 RunCreatedConsumer:
  ⚙️ on: RunCreated
⏱️ CleanupScheduler:
  🔹 cron: "0 3 * * *"
  ⚙️ run:
```

## Um agente

```yaml
# Agente é skills + tools + um verbo. O que ele NÃO tem é estado escondido.
🤖 EvalAgent:
  🔹 skills[]: Skill
  🔹 tools[]: Tool
  ⚙️ run:
```

## Uma CLI

```yaml
# Verbo por linha, na gramática do CLI. Sub-verbo indenta.
⌨️ evals:
  ⌨️ run:
  ⌨️ inspect:
  ⌨️ list:
```

## Uma feature — a fatia inteira, entendida pelas peças

```yaml
# Uma feature atravessa as camadas; o outline dela é o que se lê antes de cortar task.
🏗️ RunsFeature:
  🌐 RunsAPI:
  🎯 CreateRun:
  📦 RunsService:
  🗄️ RunRepository:
  🧵 RunWorker:
  🖥️ EvalsScreen:
```

## Um sistema

```yaml
# A mesma linguagem escala de variável até arquitetura: só muda a altura da árvore.
🏢 EvalsSystem:
  🌐 API:
    🌐 RunsAPI:
    🌐 EvalsAPI:

  🧠 Domain:
    📦 Run:
    📦 Eval:
    🎯 CreateRun:
    🎯 ExecuteEval:

  💾 Data:
    🗄️ RunRepository:
    🗄️ EvalRepository:
    🗃️ RunsStore:

  ⚡ Background:
    🧵 RunWorker:
    🧵 ImportWorkflow:
    📨 RunCreatedConsumer:
    ⏱️ CleanupScheduler:

  🤖 Agents:
    🤖 EvalAgent:
      🔹 skills[]: Skill
      🔹 tools[]: Tool
      ⚙️ run:

  🖥️ UI:
    📄 EvalsTemplate:
      🧩 RunViewWidget:
        🔹 runId: RunId
      🧩 RunsWidget:
        🔹 runs[]: Run

  ⌨️ CLI:
    ⌨️ run:
    ⌨️ inspect:
    ⌨️ list:
```
