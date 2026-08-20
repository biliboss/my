---
type: context
depends_on: src/herdr/workspaces/focus.ts · src/herdr/workspaces/block.ts · src/herdr/workspaces/create.ts · src/herdr/workspaces/resolve.ts · src/herdr/workspaces/close.ts · src/herdr/policy.ts
---

# src/herdr/workspaces

Os workspaces do herdr **mais as duas opiniões que são nossas**. O herdr é dono
deles; aqui mora o que ele não tem.

| arquivo | o caso de uso |
|---|---|
| [`list.ts`](list.ts) | os workspaces, com as marcas desta casa |
| [`resolve.ts`](resolve.ts) | achar um por id **ou** por label |
| [`create.ts`](create.ts) | abrir um, recusando label repetido |
| [`focus.ts`](focus.ts) | trazer pra frente |
| [`close.ts`](close.ts) | fechar um, ou varrer todos os não cercados |
| [`block.ts`](block.ts) | cercar / descercar, esconder / mostrar |


## `block` é cerca, `hide` é cortina — e por que são DUAS

Nenhuma das duas chega no herdr. O workspace continua funcionando perfeitamente
no terminal; é este código que se recusa a tocar nele.

- **`block`** recusa toda ação naquele workspace até um `unblock`.
- **`hide`** só some da listagem; `--hidden` traz de volta.

Esconder pra parar de tocar tornaria a cerca INVISÍVEL — e o valor inteiro de uma
cerca é poder ser vista. Por isso a listagem mostra o bloqueado, marcado com `⊘`.

Os três que um bloqueado ainda aceita: `unblock` (é o próprio portão), `hide` e
`unhide` (filtro de listagem — recusar significava uma cerca que não dá pra
arrumar).

## A cerca é herdada, e é aí que ela vale

A cerca mora em [`../policy.ts`](../policy.ts), um nível acima, porque ela vale
pra aba e pane também. `fence(id)` corta no `:` e pergunta pelo workspace. Sem isso, bloquear `w3K` e
fechar `w3K:t1`, `w3K:t2`… esvazia o mesmo workspace uma aba por vez — a cerca
ficaria a um id de distância de não valer nada. É o único check em
[`../policy.test.ts`](../policy.test.ts), com controle negativo: `w3K2:t1` **não**
herda, porque o corte é no `:` e não por prefixo.

## Label ambíguo volta, nunca é chutado

`resolve` tenta o **id primeiro**, então label parecido com id nunca sombreia o
real. Dois workspaces com o mesmo label devolvem `reason: 'ambiguous'` com os
ids — escolher um no chute é como o pane errado morre.

E é por isso que `create` recusa label repetido: dedup na CRIAÇÃO, nunca depois.

## Persistido, e isso não é prematuro

`_data/workspaces.json`. Guarda que evapora no restart é pior que guarda nenhuma:
quem levantou não tem motivo pra levantar de novo, e a primeira chamada depois
passa direto pela cerca que ele achava que estava de pé.

## `closeAll` é sequencial de propósito

O herdr renumera os workspaces conforme eles fecham. Oito fechamentos
concorrentes contra uma lista que se move é como o pane errado morre — de novo.

## Verify

```bash
bun test src/workspaces/
bun run src/workspaces/list.ts --hidden
```
