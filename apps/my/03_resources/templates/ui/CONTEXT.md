---
type: template
---

# 03_resources/templates/ui

Os corpos **atômicos** — o pedaço que mais de uma tela usa. Um arquivo por
PREFIXO de tag, porque é o prefixo que organiza (a API não tem pasta nem
descrição: `GET /templates` devolve `tag`, `versao`, `corpo`, `usos`, e nada que
diga pra que serve).

| arquivo | tags | pra que servem |
|---|---|---|
| [`hud.json`](hud.json) | `hud_agente`, `ids_do_agente` | o HUD de execução: estado, tempo, previsão, e os ids da sessão |
| [`templates.json`](templates.json) | `templates_resumo`, `templates_tags`, `templates_retratos` | a tela que mostra os próprios templates guardados |

## A diferença que decide a porta

Isto aqui vai pro `POST /templates` — é vocabulário, fica GUARDADO com tag e
versão, e não desenha nada sozinho. O `../cockpit/` vai pro `POST /api/panel` —
é tela, tem `surfaceId`, célula e dado, e some se ninguém publicar.

```bash
curl -X POST http://cockpit.localhost/templates -d @03_resources/templates/ui/hud.json
curl -X POST http://cockpit.localhost/api/panel -d @03_resources/templates/cockpit/run.json
```

Uma tela aponta pro vocabulário com `{"id": "hud", "column": 0, "usa": "hud_agente@1"}`
— e é a mesma coisa nos dois sentidos: um corpo guardado também pode `usa:` outro.
É por isso que existe **uma palavra só**; o porquê está no cabeçalho de
`~/src/cockpit/src/lib/server/templates.ts`.

## Versão é append-only

Re-postar a mesma `tag` cria `@2`; a `@1` fica onde está, porque alguém pode
estar desenhando com ela. `usa: tag` sem `@versao` congela na maior de ENTÃO —
a expansão acontece na publicação, então o ponteiro não anda depois.

Quem publica `@2` e esquece de repontar aparece na própria tela de templates,
na conta de "versões que ninguém usa".

## Quando promover pra cá

- **arranjo que já apareceu em DUAS folhas** → registra
- **arranjo que é o assunto da folha** → deixa inline lá
- **na dúvida** → inline; promover depois é um `POST /templates` e trocar três
  linhas por uma
