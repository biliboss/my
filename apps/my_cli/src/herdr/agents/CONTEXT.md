---
type: context
---

# src/herdr/agents

Os agentes que o **herdr** vê, e subir um novo.

| arquivo | verbo |
|---|---|
| [`list.ts`](list.ts) | `my herdr agents list` — os panes com agente rodando |
| [`start.ts`](start.ts) | `bun run src/herdr/agents/start.ts <nome> --workspace <k>` |

## "Agente" aqui é o do herdr

Um pane com um agente interativo rodando dentro — `claude`, `codex`, o que for.
Uma palavra, um significado: ela já era do herdr em toda outra ferramenta desta
máquina, e inventar um segundo sentido seria trocar a linguagem ubíqua por
sinônimo.

## `start` são dois passos porque o herdr separa

Abre a aba no workspace, depois starta o binário no pane dela — `agent start`
precisa de um pane já parado no prompt do shell. A aba volta COM o pane
justamente pra não precisar de um segundo round-trip (e de uma segunda chance de
corrida).

Quem resolve o workspace e checa a cerca é [`../tabs/create.ts`](../tabs/CONTEXT.md);
nada disso se repete aqui.

## A aba fica de pé quando o binário morre

De propósito. Ela segura o que o binário imprimiu antes de morrer, que é a única
evidência do PORQUÊ. Limpar seria apagar a mensagem de erro.

E o modo de falha mais comum é timeout: o herdr **verifica** — espera até
detectar aquele agente pronto pra input. Argv errado é indistinguível de start
lento, porque binário que morre numa flag desconhecida nunca chega a ser
detectado.

## Duas metades da frota

Aqui é a metade VIVA. A outra — o que os runs declaram em `agentes[]` — ficou
SEM LEITOR quando `src/sandbox/` foi deletado em 17/08. A diferença entre as duas
é o número que importa (agente vivo sem linha em run nenhum é ÓRFÃO), e hoje
ninguém a calcula. Quando doer, ela nasce aqui.

## Verify

```bash
my herdr agents list      # os panes com agente rodando
my herdr agents cli       # o mesmo, pela porta que fala NOME
```
