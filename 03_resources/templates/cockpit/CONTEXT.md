---
type: template
---

# 03_resources/templates/cockpit

Painel do cockpit é **mensagem**, não documento: `createSurface` desenha a folha,
`updateComponents` põe o layout, `updateDataModel` troca só o dado, e
`focusSurface` manda a aba olhar pra lá. Escrever isso de cabeça a cada vez é como
o mesmo painel sai diferente duas vezes — daí estes templates: cada um é um
`.json` pronto pra `curl -d @arquivo`, com o esqueleto certo e os nomes de campo
que o canvas realmente lê.

O que muda por template é o CONTEÚDO; a mecânica é sempre a mesma:

```bash
curl -X POST localhost:5173/api/panel -d @03_resources/templates/cockpit/features.json
curl -X POST localhost:5173/api/panel -d '{"focusSurface":{"surfaceId":"features"}}'
```

| template | pra que serve |
|---|---|
| [`showcase_features_of_project.json`](showcase_features_of_project.json) | a pasta `features/` de um projeto: resumo à esquerda, as features em abas à direita, meio a meio |
| [`doc.json`](doc.json) | um documento do repo em foco, e abas pra comparar dois |
| [`agentes.json`](agentes.json) | quem está rodando AGORA: label, tempo de vida, e o que se espera dele |
| [`run.json`](run.json) | UMA run: faixa com estado/node/projeto e as abas dos artefatos — o hook dá o `{{slug}}`, o `me` resolve o resto |
| [`parados.json`](parados.json) | os runs `em_execucao` **sem agente vivo**: o que cada um espera de decisão, e de quem |
| [`templates.json`](templates.json) | a tela dos templates guardados: quantos, quem usa cada versão, e o retrato de cada um |
| [`project_feature_execution_realtime.json`](project_feature_execution_realtime.json) | UMA feature sendo executada por um agente: o contrato à esquerda, o progresso e o HUD à direita. Todo de buraco — ver abaixo |
| [`agent_me_run.json`](agent_me_run.json) | o run atual/último do `agent-me`: estado, contagem de eventos, última ação, e abas pro `stream.jsonl`/`output.md`/`input.txt`. Buraco `{{run}}`; quem publica é o próprio `agent.py`, a cada evento — surface fixa `agent-me`, então o painel mostra sempre o run mais recente |
| [`grid_layout`](../../templates/cockpit — POST /templates, `usa: grid_layout@1`) | só o LAYOUT pra comparar variações lado a lado — 12 slots (`slot1`..`slot12`, 4 colunas × 3 linhas), cada um um `Html`. **UM só, tag `layout`, evolui por versão** (`@2`, `@3`...) em vez de virar arquivo novo a cada tamanho — pra 2×2, `createSurface columns:2` e só preenche `slot1..4`; `slot5..12` ficam com `html` vazio (inofensivo, não colide). `slot1..12` é chave rasa (não array indexado — `path` do cockpit não aceita `items[3]`), então cada slot é campo próprio no `updateDataModel` |
| [`menu_two_line_meta`](../../templates/cockpit — POST /templates) | o `Menu` (organismo: `Label` + `List`) vencedor da comparação de 14/08 — item + subtítulo de contexto. Guardado como corpo atômico (`usa: menu_two_line_meta@1`), não como `.json` daqui — é vocabulário, não tela |
| [`eval_view.json`](eval_view.json) | 2 colunas: o `Menu` (`usa: menu_two_line_meta@1`) à esquerda, a área de eval à direita (`Html`, buraco `conteudo`). Buraco `{{surfaceId}}` |
| [`../ui/`](../ui/) | os corpos ATÔMICOS (`hud_agente`, `ids_do_agente`, `templates_*`) — vão pro `POST /templates`, não pro `/api/panel` |

## `run.json`: quem preenche o quê

A tela da run tem TRÊS donos, e é isso que a mantém honesta:

| quem | o que preenche | como |
|---|---|---|
| o **template** | o layout: a faixa, as abas, onde cada coisa cai | `run.json`, aqui |
| o **hook** | só o `{{slug}}` | `entao: {publica: "cockpit/run", com: {slug: "$1"}}` |
| o **`me`** | `estado`, `node`, `projeto` e as linhas resolvidas | um `updateDataModel` na surface `run` |

O `me` é o único que pode ler `summary.node` e `metrics.step` de dentro do YAML,
e é por isso que ele preenche essa parte — **o servidor do cockpit não pode**:
verbo que sabe o que é uma run é a base aprendendo o nome de uma coisa
(@01_projects/_parked/cockpit/design_docs/CONTEXT.md, pergunta 2).

Enquanto ninguém preenche, a lista diz isso com todas as letras em vez de
mentir um vazio. E o dado tem que estar no YAML pra sair na tela: em 14/08 a
faixa apareceu com `(sem campo projeto)` e foi assim que se descobriu que dois
runs do dia nasceram sem classificação.

## O manual, quando ele não cabe num mapa

Esta tabela acima é o índice: qual template existe e pra que serve. O COMO mora
ao lado, um arquivo por pergunta:

| pergunta | onde |
|---|---|
| como se escreve um template, e como usar bem a API (componente dinâmico, prefixo de tag, quando registrar) | [`references/api_de_templates.md`](references/api_de_templates.md) |
| acompanhar execução: o contrato de um lado e o `.jsonl` do outro, e o template `estado` | [`references/acompanhar_execucao.md`](references/acompanhar_execucao.md) |
| compor: `usa:` pra apontar em vez de repetir, e o 50/50 sem tocar no cockpit | [`references/composicao.md`](references/composicao.md) |
| a parede: o que é "tempo real" aqui, as três regras que evitam painel feio, o teto conhecido, e por que ela não tem mapa | [`references/a_parede.md`](references/a_parede.md) |
