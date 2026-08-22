---
type: context
depends_on: src/herdr/panes/read.ts
---

# src/herdr/panes

Ler um terminal, e digitar nele. Dois verbos, e a assimetria entre eles é o
assunto desta pasta.

| arquivo | verbo | cercado? |
|---|---|---|
| [`read.ts`](read.ts) | `bun run src/herdr/panes/read.ts <id> [--lines N]` | **não** |
| [`send.ts`](send.ts) | `bun run src/herdr/panes/send.ts <id> "<texto>"` | **sim** |

## `send` é a chamada mais poderosa da casa

Um pane parado num prompt de shell **roda o que cair nele**. A cerca do
workspace ([`../policy.ts`](../CONTEXT.md#block-é-cerca-hide-é-cortina)) é a única
contenção que existe, e é por isso que ela está aqui e não no `read`.

`--no-enter` digita SEM submeter — engatilha o comando pra um humano ler antes
de rodar. É a metade segura deste verbo, e existe porque o herdr separa
`send-text` (string literal) de `send-keys` (NOME de tecla): `send-keys <pane>
"echo oi" enter` responde `unsupported key echo oi`, que é a primeira coisa que
todo mundo tenta.

## `read` não é cercado, e isso é a política

Ler não muda nada, e um workspace bloqueado é exatamente aquele que alguém quer
acompanhar sem tocar. Cercar a leitura transformaria a cerca em cegueira.

## `--lines` implica um snapshot

Medido em 17/08: `--lines N` contra a fonte padrão (`recent`) imprime **NADA** e
sai 0 — leitura vazia silenciosa, com cara de pane morto. Só funciona com
`--source` explícito, então pedir contagem de linhas assume `visible` a menos
que o chamador diga outra coisa. O conserto mora em
[`../run.ts`](../CONTEXT.md), num lugar só.

## Texto puro, não JSON

A saída de `read` é saída de terminal. Embrulhar num campo de string só põe uma
camada de escape entre quem chama e o que ele veio ler.

## Verify

```bash
bun run src/herdr/panes/read.ts <pane-id> --lines 20
bun run src/herdr/panes/send.ts <pane-id> "echo oi" --no-enter    # engatilha, não roda
```
