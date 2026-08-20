---
type: reference
---

# compor: `usa:` pra apontar, e o 50/50 sem tocar no cockpit

Saiu do [`../CONTEXT.md`](../CONTEXT.md) em 19/08: ele é o MAPA — o que um
template é e onde cada peça mora — e isto aqui é o manual.

## `usa:`: o template que aponta em vez de repetir

Arranjo que se repete não precisa ser copiado de template em template: registra
uma vez, com nome e versão, e o outro template aponta. Dois curls, porque são
dois assuntos — o corpo atômico é o vocabulário, a folha é a tela:

```bash
curl -X POST localhost:5173/templates -d @03_resources/templates/ui/templates.json
curl -X POST localhost:5173/api/panel -d @03_resources/templates/cockpit/templates.json
```

O nó vira `{ "id": "resumo", "column": 0, "usa": "templates_resumo@1" }` — sem
`componentProperties`, porque o corpo dele já está gravado. **`column` é o único
campo que vale a pena mandar no nó do `usa`**: os outros saem por composição
(um `Box` em volta), e `column` sairia com uma div a mais no meio do layout.

Quem expande é o SERVIDOR, na publicação: a surface guarda as primitivas, e
`tag` sem `@versao` congela na maior versão de ENTÃO. Apontar pra tag ou versão
que não existe é **400 na publicação** — tipo desconhecido vira `? Nome` porque
vem de fora, template inexistente é erro de quem escreveu.

O `{path}` continua sendo do data model da SURFACE: o template é layout e
ligação, o número é sempre de quem usa. Por isso o `templates.json` traz o
`updateDataModel` com o retrato de agora — e por isso ele fica velho sozinho.
Pra atualizar sem editar o arquivo:

```bash
curl -s localhost:5173/templates | python3 -c "
import json,sys
e=json.load(sys.stdin)['templates']
print(json.dumps({'updateDataModel':{'surfaceId':'templates','contents':{
 'tags':len({x['tag'] for x in e}),'versoes':len(e),
 'orfas':sum(1 for x in e if not x['usos']),
 'linhas':[f\"{x['tag']}@{x['versao']} · {', '.join(x['surfaces']) or 'ninguém'}\" for x in e]}}}))
" | curl -s -X POST localhost:5173/api/panel -d @-
```

O `retratos` (as abas) não sai daí de propósito: a URL de cada retrato carrega o
data model de EXEMPLO do template (`/templates/templates_resumo@1/shot?tags=3`),
e exemplo é escolha de quem escreve o template, não coisa que se deriva do banco.

## Meio a meio: como se faz 50/50 sem tocar no cockpit

`createSurface.columns: 2` **não** dá duas colunas iguais: o canvas fixa a primeira
em `minmax(0, 20rem)` — ela é a lateral de resumo, de propósito. Pedir 50/50 por ali
é pedir mudança no Svelte, e o cockpit é canvas em branco: o que a gente manda é
mensagem, não CSS dele.

O 50/50 sai de `columns: 1` + **um `Box`** com o grid inteiro no `style`. Com uma
coluna só, o canvas desenha os componentes direto num flex column, então o Box vira
o layout — e `auto-fit` faz a responsividade sozinha: duas colunas quando cabe
`24rem` de cada lado, uma coluna empilhada quando não cabe.

```json
{ "id": "split",
  "style": { "flex": "1", "min-height": "0", "display": "grid",
             "grid-template-columns": "repeat(auto-fit, minmax(24rem, 1fr))",
             "gap": "0.75rem" },
  "componentProperties": { "Box": {} },
  "children": [ { "id": "resumo", "...": "métricas, lista" },
                { "id": "tabs", "...": "as abas" } ] }
```

Duas regras que vieram de ver a tela feia: filho que tem iframe precisa de
`min-height: 0` e `overflow: hidden` no `style` — sem isso ele empurra a altura pra
fora em vez de caber. E **um documento por surface**: o `Frame` de "última feature"
mais as abas mostravam a mesma coisa duas vezes e comiam metade da tela; ficaram só
as abas.
