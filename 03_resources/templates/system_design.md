---
type: template
---

<!--
TEMPLATE — a pasta `docs/` de um projeto, na forma `system_design`. Copie o
pedaço que serve; não copie o arquivo. A regra de QUANDO e POR QUÊ está em
`my meta resources system_design`; aqui é só a FORMA.
-->

# system_design — a forma

```
docs/
├── 00_system_design_big_picture.md
├── 01_system_design_layers.md
└── 02_system_design_<fluxo>.md      # 0..N, um por fluxo que merece desenho
```

## 00_system_design_big_picture.md — título, grafo, parágrafo. Nada mais.

```markdown
# system design — do que o <sistema> é feito

\`\`\`mermaid
flowchart LR
    NoA((Peça A))
    NoB((Peça B))
    NoC((Peça C · fora — governo/terceiro exige))

    NoA --- NoB
    NoB -.->|precisa de X| NoC
\`\`\`

Grafo de relação: <o que cada cluster representa, uma frase>. Fluxo de
chamada fica no callstack — isso é `01_system_design_layers.md` mais os
`NN_system_design_<fluxo>.md`.
```

Regras:
- Nós REDONDOS (`((Nome))`), não retângulos — é estilo grafo (Obsidian),
  não fluxo de chamada.
- Um `subgraph` por CLUSTER de origem diferente (o que o sistema já faz vs. o
  que um terceiro exige vs. o que é gestão interna) quando o número de nós
  passar de ~9 — declarado, não escondido: "passou de N nós de propósito,
  porque X" vai no PRÓPRIO grafo como comentário `%%` ou fica fora do
  arquivo, nunca em prosa ao lado (a prosa é o parágrafo, curto).
- O parágrafo abaixo do diagrama tem teto de ~30 palavras. Passou disso, o
  excesso é seção de `01_system_design_layers.md`, não deste arquivo.

## 01_system_design_layers.md — a árvore, por camada

```markdown
# system design — por camada

<contexto de uma frase: o que este outline cobre, e que não cobre `NN_fluxo.md`>

\`\`\`mermaid
flowchart TD
    Sistema(["🏢 Sistema"])

    subgraph API["🌐 API"]
        Rota["🌐 NomeDaRota · caminho/no/repo"]
    end

    subgraph Domain["🧠 Domain"]
        Modulo["📦 NomeDoModulo · packages/modulo"]
    end

    Sistema --> API
    Sistema --> Domain
\`\`\`

## O que cada camada é

- **\`🌐 API\`** — <uma frase por camada, o papel dela>

## O que está sem filho, e por quê

- **\`🎯 CasoDeUso\`** — <por que a forma interna não está aqui>

## O que a árvore NÃO cobre (teto conhecido)

- <o que ficou de fora, e por quê — não é decisão de esconder, é trabalho que falta>

## References

- [\`00_system_design_big_picture.md\`](00_system_design_big_picture.md)
- [\`../callstack.md\`](../callstack.md) — se o projeto ainda tiver um, na forma antiga
```

Glifos: `my meta resources outline_notation` (o vocabulário inteiro,
`03_resources/templates/outline.md`). Se o projeto renderiza em mermaid em
vez de YAML puro, é DESVIO da notação padrão — anota o porquê no topo do
arquivo, porque `outline_notation` está `drafted` e pede isso.

## NN_system_design_<fluxo>.md — um fluxo, sequência + peças

```markdown
# system design — <nome do fluxo>

<contexto de uma frase, VISÃO ou retrospectivo, e por quê este fluxo merece seção própria>

\`\`\`mermaid
sequenceDiagram
    autonumber
    actor Usuario as quem usa · de fora
    participant Componente as caminho/do/componente

    Usuario->>Componente: ação
    Componente-->>Usuario: fato
\`\`\`

\`\`\`yaml
🏢 NomeDoFluxo:
  🖥️ UI:
    📄 Template:
      🧩 Widget:
        🔹 campo: Tipo
\`\`\`
```

O outline aqui é um RECORTE — só os elementos que a sequência acima toca, não
o sistema inteiro (isso é `01_system_design_layers.md`). Repetir a lista
completa de tools/rotas seria a segunda fonte que a casa evita.

## Numeração

`00_` e `01_` são fixos (sempre existem, sempre nesses dois nomes). `NN_` de
`02` em diante conta pra CIMA, na ordem em que os fluxos foram desenhados —
não é prioridade, é histórico. Fluxo removido não libera o número pros
próximos; número ocupado nunca é reciclado (mesma regra de sprint/task).

## References

- `my meta resources system_design` — o porquê, e como normalizar projeto antigo
- `my meta resources callstack_notation` · `my meta resources outline_notation`
- @01_projects/_parked/cannabr-v1/docs/ — o exemplo vivo
