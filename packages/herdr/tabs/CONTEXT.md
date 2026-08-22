---
type: context
depends_on: src/herdr/tabs/focus.ts · src/herdr/tabs/rename.ts · src/herdr/tabs/close.ts · src/herdr/tabs/list.ts · src/herdr/policy.ts
---

# src/herdr/tabs

As abas do herdr. Um arquivo por verbo, e `bun run src/herdr/tabs/list.ts <verbo>` é o mesmo nome.

| arquivo | verbo | cercado? |
|---|---|---|
| [`list.ts`](list.ts) | `bun run src/herdr/tabs/list.ts [workspace]` | não — ler não muda nada |
| [`create.ts`](create.ts) | `bun run src/herdr/tabs/create.ts --workspace <k>` | sim |
| [`rename.ts`](rename.ts) | `bun run src/herdr/tabs/rename.ts <id> <label>` | sim |
| [`focus.ts`](focus.ts) | `bun run src/herdr/tabs/focus.ts <id>` | sim |
| [`close.ts`](close.ts) | `bun run src/herdr/tabs/close.ts <id>` | sim |

## Plano, nunca aninhado

O id de uma aba já é `w1R:t2` — ele **carrega o workspace**. Uma superfície
`workspaces/<key>/tabs/<id>` escreveria o pai duas vezes e deixaria os dois
discordarem. Um id, um segmento, e o workspace só aparece onde ele é FILTRO
(`bun run src/herdr/tabs/list.ts w3K`) ou DESTINO (`create --workspace`).

## A cerca é herdada, e é o motivo de ela existir

Todo verbo que muda algo passa por `fence(id)` de
[`../policy.ts`](../CONTEXT.md#block-é-cerca-hide-é-cortina) — que corta o id no `:` e
pergunta pelo workspace. Sem isso, bloquear `w3K` e fechar `w3K:t1`, `w3K:t2`…
esvazia o mesmo workspace uma aba por vez.

`list` não é cercado de propósito: um workspace bloqueado é exatamente o que
alguém quer OLHAR sem tocar.

## `create` resolve antes de agir

`--workspace` aceita id ou label, e a resolução acontece ANTES da cerca — senão
a cerca seria checada contra o que foi digitado e não contra o workspace real.

Sem `--workspace`, o herdr usa o que está em foco. Certo pra um humano no
terminal, errado pra script: passe explícito quando for código.

## Verify

```bash
bun run src/herdr/tabs/list.ts
bun run src/herdr/workspaces/block.ts block <id> "teste" && bun run src/herdr/tabs/close.ts <id>:t9   # recusa
bun run src/herdr/workspaces/block.ts unblock <id>
```
