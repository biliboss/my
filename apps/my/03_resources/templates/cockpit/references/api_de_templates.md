---
type: reference
---

# a API de templates: escrever um, e usá-la bem

Saiu do [`../CONTEXT.md`](../CONTEXT.md) em 19/08: ele é o MAPA — o que um
template é e onde cada peça mora — e isto aqui é o manual.

## `{{variavel}}`: o template que o cockpit publica sozinho

`run.json` é o primeiro template com **buraco**: `{{slug}}`. Ele existe porque um
`pane_hook` publica ESTE arquivo quando o Gabriel abre um arquivo de
`_step_runs/<slug>/` no editor — a regra captura o slug com `*` e manda
`entao: { publica: cockpit/run, com: { slug: "$1" } }`. O servidor troca
`{{slug}}` pelo valor e aplica; ele não sabe o que é uma run, e é isso que o
mantém fora da base (pergunta 2 do
[`design_docs`](../../../../01_projects/_parked/cockpit/design_docs/CONTEXT.md)).

À mão continua funcionando igual, e é assim que se testa a tela sem depender do
editor:

```bash
sed 's/{{slug}}/2026-08-14T0924Z-pane-hooks/g' 03_resources/templates/cockpit/run.json \
  | curl -s -X POST localhost:5173/api/panel -d @-
```

Chave de `com` é identificador (`[A-Za-z_][A-Za-z0-9_]*`) e valor é texto — o
valor entra ESCAPADO como string JSON, porque ele vem de fora (um pedaço do
caminho do editor) e o texto em que ele entra é JSON. Buraco que ninguém
preencheu fica literal na tela (`{{slug}}`) em vez de sumir: tela que mostra o
próprio buraco se conserta sem debugger.

## Usar bem a API de templates

Os templates guardados **são** a camada de UI desta casa. Não existe pasta de componentes ao
lado dele, e não deve existir: seria um segundo lugar guardando a mesma coisa, e
o de fora nunca sabe qual dos dois está valendo.

### Componente DINÂMICO é o caso normal, não a exceção

A pergunta que aparece é se dá pra registrar componente com dado vivo. Dá — e é
o único jeito que faz sentido. O corpo do template guarda **layout e ligação**;
o número é sempre de quem usa:

```json
{"tag": "hud_agente", "corpo": [
  {"componentProperties": {"Metric": {"value": {"path": "estado"},
                                      "label": {"path": "label"}, "linha": true}}},
  {"componentProperties": {"Timer":  {"since": {"path": "subiu_em"}}}}
]}
```

`{"path": "estado"}` resolve contra o data model da **surface**, na hora de
desenhar. O mesmo `hud_agente@1` serve dois agentes ao mesmo tempo porque cada
folha tem o data model dela. Elemento com valor cravado dentro seria template
com outro nome.

### O contrato implícito, que é onde se erra

`hud_agente@1` precisa de `estado`, `label`, `subiu_em`, `barra` e `previsao`.
**Nada declara isso, e faltar não dá erro** — a folha publica com 200 e o
componente desenha vazio. Antes de usar um template, leia o `corpo` dele e
confira os `path` contra o seu `updateDataModel`.

É buraco conhecido, com conserto desenhado em
[`cockpit/issues/003`](../../../01_projects/_parked/cockpit/issues/003_o_template_so_guarda_o_miolo.md):
um campo `espera: [...]` no template e 400 na publicação quando faltar.

### Organizar por PREFIXO de tag

Não há pasta, namespace nem descrição na API — `GET /templates` devolve `tag`,
`versao`, `corpo`, `criado_em`, `usos`, `surfaces`, e nada que diga pra que
serve. Então o **prefixo é a organização**, e ele agrupa sozinho:

| prefixo | o que mora nele |
|---|---|
| `hud_*` | pedaços do HUD de execução: estado, progresso, ids |
| `templates_*` | a tela que mostra os próprios templates |
| `pane_*` | reservado pra FORMA de folha, quando a issue 003 sair |

E o "pra que serve" mora aqui, neste arquivo, porque a API não tem onde guardar.
Com cinco templates isso é suficiente; com cinquenta, quem escolhe vai ler
`corpo` e adivinhar — é o segundo buraco da issue 003.

### Quando registrar, e quando deixar inline

Registrar cedo demais enche a loja de tag com um uso só, e tag órfã é o que
a tela dos próprios templates conta (`versoes que ninguém usa`). O corte:

- **arranjo que já apareceu em DUAS folhas** → registra
- **arranjo que é o assunto da folha** (as abas de um doc específico) → inline
- **na dúvida** → inline; promover depois é `POST /templates` e trocar três
  linhas por uma, e ninguém perde nada no caminho

Versão: re-postar a mesma `tag` cria `@2`; `usa: tag` sem `@versao` congela na
maior de ENTÃO. Apontar pra versão que não existe é **400 na publicação** — erro
de quem escreveu, e por isso não é silencioso como tipo desconhecido, que vira
`? Nome` porque vem de fora.
