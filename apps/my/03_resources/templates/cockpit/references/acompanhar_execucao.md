---
type: reference
---

# acompanhar execução: o contrato, o JSONL, e o template `estado`

Saiu do [`../CONTEXT.md`](../CONTEXT.md) em 19/08: ele é o MAPA — o que um
template é e onde cada peça mora — e isto aqui é o manual.

## Acompanhar execução: o contrato de um lado, o JSONL do outro

`project_feature_execution_realtime.json` responde a pergunta que dá aflição
quando se delega: **o agente está fazendo o que a feature pediu?** À esquerda o
que ele PROMETEU (`CONTEXT.md`, `tasks.md`, o `.md` do projeto); à direita o que
ele está FAZENDO — o transcript `.jsonl` da sessão dele, servido pelo mesmo
`/doc/` do resto.

### O `.jsonl` NÃO passa pelo `/doc/` — medido em 14/08

`/doc/` resolve o caminho e exige que ele continue **dentro de `~/src/me`**,
matando `..` e symlink que aponte pra fora. É trava proposital, escrita no
cabeçalho de `src/routes/doc/[...path]/+page.server.ts` do cockpit, e o
transcript mora em `~/.claude/projects/<slug-do-cwd>/<session>.jsonl` — fora.

| tentativa | resposta |
|---|---|
| `/doc/../.claude/projects/…/<id>.jsonl` | **404** |
| a mesma com `curl --path-as-is` | **404** |
| `/doc/%2e%2e/.claude/…` | **404** |
| `/doc/01_projects/…/CONTEXT.md` (controle) | 200 |

Então a aba "ao vivo" desta folha é **o run**, que está no repo e muda quando o
agente escreve; o caminho do transcript entra na `List` como texto, pra copiar e
abrir no editor. Furar a trava pra ganhar uma aba seria trocar um limite de
segurança por conveniência de tela.

O `agentes.json` carrega esse mesmo caminho morto no `transcript` do data model —
ele nunca foi aberto como iframe, então ninguém tinha visto.

O conserto de verdade é uma rota própria no cockpit (`/agent/<session>.jsonl`),
com allowlist e tail — está registrado em
[`01_projects/_parked/cockpit/issues/002_o_doc_nao_serve_transcript.md`](../../../01_projects/_parked/cockpit/issues/002_o_doc_nao_serve_transcript.md).
Quando ela existir, a aba volta e o buraco `{{transcript}}` volta a ser `src`.

O caminho inteiro é UM buraco (`{{transcript}}`) em vez de dois porque agente em
worktree tem slug de worktree, não do repo — o mesmo detalhe que faz `claude -r`
não achar sessão de lá (@02_areas/00_workflows/02_system/005_delegate_agents/CONTEXT.md).
Derivá-lo aqui erraria justo no caso do worktree; quem delega já tem o valor.

```bash
sed -e 's/{{projeto}}/esteira-mukutu/g' \
    -e 's/{{feature}}/sandbox/g' \
    -e 's/{{label}}/esteira-logos/g' \
    -e 's/{{pane}}/w2C:p1/g' \
    -e 's/{{session_id}}/<uuid>/g' \
    -e 's/{{subiu_em}}/2026-08-14T10:30:00Z/g' \
    -e 's/{{abertas}}/12/g' \
    -e 's/{{run}}/2026-08-14T1024Z-esteira-logos/g' \
    -e 's/{{brief}}/001_brief.md/g' \
    -e 's#{{transcript}}#/doc/../.claude/projects/-Users-billiboss-src-mukutu-mono/<uuid>.jsonl#g' \
    03_resources/templates/cockpit/project_feature_execution_realtime.json \
  | curl -s -X POST localhost:5173/api/panel -d @-
```

`surfaceId` é `exec-{{feature}}` de propósito: duas features em execução ao mesmo
tempo são duas folhas, não uma disputada. Mas o `x`/`y` está cravado em `(0,6)` —
a segunda execução simultânea tem que **pedir andar** (`POST /panes/new`) e usar o
que voltar, senão desenha uma em cima da outra e a API responde 200 mentindo. As
duas chamadas, e por que são duas: #cockpit_new_pane.

Os `{{espera_1..3}}` são o `espera` do `agentes[]` do run — os arquivos que
provam que ele terminou. Buraco que sobrar aparece literal na tela, e é assim que
se descobre que faltou preencher sem abrir debugger.

### O template 1: `estado`, e quem o mantém vivo

O topo-esquerdo é o HUD: **estou vivo?**. O cronômetro sozinho diz há quanto
tempo, não se está andando — em 14/08 o agente ficou `blocked` numa permissão e
a folha continuou mostrando o relógio correndo, como se estivesse trabalhando.

`estado` é UM campo do data model, desenhado por um `Metric` acima do `Timer`.
Os valores vêm do `agent_status` do herdr, e o corte de 10 min sem output é o
mesmo do `ws.ts` na barra lateral:

| `herdr agent list` | na tela |
|---|---|
| `working` | `🏃 WORKING` |
| `blocked` | `⏸ BLOCKED` |
| `done` · `idle` | `✅ DONE` |
| passou de 10 min sem output | soma ` 🚨` — **soma**, não substitui |

**Nada empurra isso sozinho, e é de propósito** — watcher seria um segundo lugar
sabendo o que mudou (a mesma regra de "quem mexeu no disco republica"). Quem
monitora manda uma linha, e ela é barata:

```bash
E=$(herdr agent list | python3 -c "
import json,sys
m={'working':'🏃 WORKING','blocked':'⏸ BLOCKED','done':'✅ DONE','idle':'✅ DONE'}
for a in json.load(sys.stdin)['result']['agents']:
    if a.get('pane_id')=='w2W:p1': print(m.get(a.get('agent_status'),'? '+str(a.get('agent_status'))))
")
curl -s -X POST 'http://[::1]:5173/api/panel' -H 'content-type: application/json' \
  -d "{\"updateDataModel\":{\"surfaceId\":\"exec-sandbox\",\"contents\":{\"estado\":\"$E\"}}}"
```

**Estado velho mente pior que estado ausente.** Se ninguém for atualizar, é
melhor não ter o campo — por isso ele é buraco no template, e buraco não
preenchido aparece literal (`{{estado}}`) em vez de sumir.

Duas coisas medidas em 14/08 que economizam meia hora: o data model volta no
`GET /api/panel` sob a chave **`data`**, não `dataModel`; e `curl -d` **sem**
`-H 'content-type: application/json'` leva *"Cross-site POST form submissions are
forbidden"* do SvelteKit — os exemplos antigos deste arquivo estão sem o header.
