---
type: reference
---

# a parede: tempo real, painel que não fica feio, e o teto

Saiu do [`../CONTEXT.md`](../CONTEXT.md) em 19/08: ele é o MAPA — o que um
template é e onde cada peça mora — e isto aqui é o manual.

## O que é "tempo real" aqui

Não é polling. Um `updateDataModel` de uma linha (`{"contents":{"n":7}}`) troca o
número sem reenviar tela nenhuma, e o `<iframe>` de `Frame`/`Tabs` recarrega pelo
`?v=<selo>`. **Quem move o selo é assunto do cockpit, não do template** — está em
[`03_resources/references/cockpit/CONTEXT.md`](../../../references/cockpit/CONTEXT.md), que é o dono
dessa regra e já mudou uma vez (era toda publicação; hoje é o foco da janela).
Repetir o mecanismo aqui é ter duas verdades e uma delas apodrecendo.

Quem tem que republicar é quem mexeu no disco: o agente que escreveu a feature
publica o `updateDataModel` no fim do turno. É a mesma disciplina do resto da casa
— quem muda o estado avisa —, e é por isso que aqui não entra watcher: watcher
seria um segundo lugar sabendo o que mudou.

## As três regras que evitam painel feio

**Coluna é dado, não regra.** `column: 0` é a faixa que atravessa a folha inteira
(resumo de uma linha); `1..n` são as colunas de `createSurface.columns`. O canvas
não adivinha que um `Frame` "costuma ir à direita" — quem publica decide.

**`Frame` é nu de propósito.** Sem moldura e sem legenda, porque o documento
dentro já É o conteúdo. Título de seção fica num `Heading` acima, não numa caixa
em volta.

**Endereço é do publicador — e endereço ocupado NÃO dá erro.** `x`/`y` no
`createSurface` colocam a folha na parede (`{x:0,y:0}` é onde o canvas abre), e
duas surfaces no mesmo `(x,y)` desenham UMA SOBRE A OUTRA: a API responde 200, o
`GET` mostra as duas certinhas, e o estrago só aparece na tela, com dois títulos
embaralhados. Aconteceu em 14/08/2026 — `features` caiu em cima de
`algodoeiro-bloco-4-ap-201`, `doc` em cima de `agents` e `agentes` em cima de
`steps`, tudo de uma vez.

O conserto certo não é conferir ocupação na mão: é **pedir andar pro servidor**, que
sempre entrega o de baixo — andar que não existe não colide com nada.

```bash
curl -s -X POST localhost:5173/panes/new    # → {"id":"pane-1","x":0,"y":2,...}
# use o x/y devolvido no createSurface do template
```

Coordenada cravada no template só quando a linha já é sua. Os três daqui moram na
linha `y: 1` (`features` x0, `doc` x1, `agentes` x2) porque essa linha nasceu
inteira deles — assim `pan left/right` anda entre os três sem passar por tela de
outro assunto.

## O teto conhecido

Dois agentes publicando na MESMA surface é último-escreve-vence, sem aviso: o
SQLite dá atomicidade por escrita, não resolve intenção concorrente. Enquanto for
uma pessoa numa máquina, tanto faz; se virar caso real, o conserto está desenhado
no cabeçalho de `src/lib/server/panel.ts` do cockpit (`rev` + `If-Match` + 409).

O que o cockpit É — e por que ele existe em vez de um HTML solto por proposta —
mora em [`03_resources/references/cockpit/CONTEXT.md`](../../../references/cockpit/CONTEXT.md).

## A parede não tem mapa: cada template carrega a célula dele

**`createSurface` ZERA componentes e dado.** Medido em 14/08: uma surface com um
componente, recriada com o mesmo id na mesma célula, volta com zero. É por isso
que republicar um template funciona — ele traz o `updateComponents` logo atrás —
e é exatamente por isso que **não existe um "recria a parede inteira"**.

Existiu um `parede.json` por meio dia: um mapa de quem mora em cada célula.
Morreu em 15/08 por duas razões medidas. A primeira é que o `x`/`y` dele já
vivia dentro do template de mesmo nome — dois lugares pra mesma coordenada, e o
`catalog` **já tinha divergido** em 24h (o mapa dizia `columns: 3`, o template
dizia 2). A segunda é que aplicar o mapa esvaziou `parados`, `branco`, `run`,
`doc` e `features` — recriar sem o conteúdo logo atrás é apagar.

Então redesenhar a parede é aplicar os templates, que é o que já se fazia pra
recuperar uma surface:

```bash
C=http://cockpit.localhost/api/panel
curl -X POST http://cockpit.localhost/templates -d @03_resources/templates/ui/templates.json
curl -X POST $C -d @03_resources/templates/cockpit/templates.json
curl -X POST $C -d @03_resources/templates/cockpit/doc.json
```

**O que não tem template aqui, e de propósito:** `herdr`, `herdr-debug` e
`vscode` nascem com o servidor (`hooks.server.ts`) — um template seria dois
donos pro mesmo desenho. E as surfaces de sessão (`exec-sandbox`, `mapa-forks`,
os `pane-N`) não têm porque **o conteúdo delas só existe no banco**. Se uma
delas merece sobreviver a um reset, o caminho é ela ganhar um template — o
template É a garantia de voltar, e não existe outra.
