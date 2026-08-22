---
type: reference
---

# delegar um workflow a um agente do herdr

**Experimental**: rodou duas vezes em 17/08 com o `03_qa` — a segunda entregou
quatro fotos e derrubou uma afirmação de issue publicada. Os agentes de
`01_coding` e `02_product` subiram no mesmo dia e **ainda não receberam tarefa
de verdade**.

O que ESTE arquivo guarda é o experimento. O que graduou virou contrato e mora em
`my workflows show 03_agents` — a família nasceu daqui no fim do mesmo dia. O que está aqui foi
medido nessa rodada; o que não foi, está marcado como não medido.

A ideia é simples e a economia é grande: em vez de a sessão principal executar um
workflow inteiro — gastando o contexto dela com 20 comandos de shell e 100k
tokens de leitura de código — ela **abre um agente, entrega o contrato, e volta a
conversar**. O trabalho acontece num pane ao lado, e a sessão só volta lá quando o
arquivo nasce.

## As três chamadas

```bash
my herdr workspaces create workflows --cwd ~/src/me --restart

my herdr agents start qa-workflows --pane <ws>:p1 \
  --system @03_resources/00_company/02_deliver_what_sell/03_validate/qa_and_merge/references/qa_issue_proof.md \
  --prompt "Afira a issue #178 do <org>/<repo>. …"

my herdr panes read <ws>:p1          # o que ele está fazendo agora
```

**O workspace `workflows` é PERMANENTE, e o agente fica nele.** Não se fecha ao
fim de uma rodada: um agente vivo guarda o que já leu — o contrato, o repo, o
ambiente — e a próxima tarefa começa de onde a anterior parou, em vez de pagar
tudo de novo. Fechar ao fim de cada tarefa foi o erro de 17/08, e ele custou
reabrir e reensinar o mesmo contexto minutos depois.

Continuar o trabalho é `panes send`, não `agents start`:

```bash
my herdr panes send <ws>:p1 "agora afira a #179, mesmo contrato"
```

O `--restart` é o que torna isso repetível: sem ele, recomeçar exige fechar à mão
e lembrar do `--cwd`, e foi por esse atrito que a primeira tentativa de 17/08
subiu na pasta de outro projeto.

## O que virou contrato, e não mora mais aqui

Três coisas graduaram no mesmo dia e viraram a família `03_agents`. Ficam
citadas, não repetidas:

- **o barramento** (`my references cc_bus`) — despachar é `my agents send`, e
  não criar pasta. A primeira versão era cada agente contando diretórios no
  próprio `output/`; pasta REMOVIDA baixa a contagem e o laço nunca mais dispara.
- **o modo ocioso** (`my references cc_idle_monitor`) — Monitor persistente, não
  shell bloqueante. O shell mantém o turno aberto e queima token dormindo: 947
  em 2m19s, medido.
- **`start system`** — o prompt de partida tem duas palavras, porque o system
  prompt já carrega tudo. Se a partida precisasse de instrução, o append não
  estaria fazendo o trabalho dele. Provado: os três subiram, leram os dois
  contratos, armaram Monitor e se anunciaram, sem mais nenhuma palavra.

## O system prompt vai por ARQUIVO, e isso mudou duas vezes no mesmo dia

Primeiro veio colado no argv, e o herdr recusou as 77 linhas do `qa_issue_proof`
com `agent arguments cannot be encoded safely for the target shell` — o mesmo
pane aceitou um prompt curto no segundo seguinte, então era tamanho, não flag.

Depois virou PONTEIRO: uma frase pedindo pro agente ler tal caminho. Funcionava,
e era pior do que parecia — dependia de instrução de USUÁRIO pra carregar o que
devia ser instrução de SISTEMA.

O certo apareceu no `claude --help`… não aparecendo: **`--append-system-prompt-file`
existe e não está documentada lá**. Medida com
`claude --append-system-prompt-file /dev/null -p "responda ok"`, que respondeu
`ok`, e confirmada no `ps` depois de subir a frota — a flag está no processo, com
o caminho absoluto certo.

## O pedido é obrigatório, e na partida tem duas palavras

`--prompt` é exigido pelo comando: agente sem pedido fica num prompt vazio, e
pane parado é indistinguível de pane que terminou. Na PARTIDA ele é
`start system`; numa tarefa, diz o alvo, o arquivo a escrever e as proibições —
o COMO já está no system prompt.

As proibições importam mais do que parecem. Sem "não comente no GitHub, não
conserte, não commite, não escreva outro arquivo", o agente com
`--dangerously-skip-permissions` faz tudo isso, e faz bem — que é o problema.

E a identidade não vai no pedido: `MY_AGENT` entra no AMBIENTE do pane, porque o
primeiro agente da frota respondeu no barramento assinando `gabriel`. Identidade
que depende do agente lembrar de uma flag é identidade errada.

## Saber que terminou: o ARQUIVO, nunca o `status`

O `state.yaml` do run é o **pedido**: alvo, artefatos esperados, ponteiro pro run
anterior. Ele NÃO é o sinal de fim.

O fim se lê pelo `artifacts.*` existindo em disco. `status:` é relato — o agente
escreve `done` e pode ter escrito antes de gravar, ou ter morrido no meio com o
campo já trocado. É a mesma regra do `006_monitor_agent`: saber que o agente
terminou pelo arquivo que nasceu, não pelo relato dele.

```bash
ls 03_resources/00_company/02_deliver_what_sell/03_validate/qa_and_merge/output/998_meta_ads_afericao/repro/
```

## Desligar: raro, e não existe `agents stop`

Desligar é exceção — o agente do `workflows` fica de pé. Quando for mesmo o caso
(o contrato dele mudou, ele travou, o modelo tem que trocar), medido em 17/08: o
`my herdr agents` tem `start`, `list` e `cli` e mais nada, então encerrar é
fechar o container.

```bash
my herdr tabs close <ws>:t1                          # uma aba
my herdr workspaces create workflows --cwd ~/src/me --restart   # o jeito bom: recria
```

**`--restart` no lugar de `close`**, porque o que se quer quase sempre é um
agente limpo, não a ausência dele. Fechar e esquecer de reabrir é como o
workspace some do fluxo.

A cerca do `policy.ts` vale, e é o único freio: workspace bloqueado recusa fechar.
Se o agente estiver escrevendo, fechar mata a escrita — por isso o `ls` do
artefato vem ANTES, sempre.

## O que ainda não foi medido

- **Dois agentes trabalhando em paralelo** no mesmo workspace. Os três já
  acordaram e responderam, mas nunca dois ao mesmo tempo fazendo trabalho real.
- **Sobreviver a um restart.** Monitor morre com a sessão, e não existe verbo que
  cruze a frota viva com quem deveria estar de pé: pane que morre sozinho não
  aparece pra ninguém.
- **Delegar uma ENTREVISTA.** Ela roda na sessão principal por desenho
  (`my references askuser`), e o que falta pra delegar não é permissão — é
  um jeito de conduzir várias rodadas sem cada uma custar um ciclo de sono.
- **Agente que trava ou entra em loop.** Não há timeout: quem descobre é humano
  lendo o pane.
- **Custo de crédito.** O pane mostrou `You've used 100% of your usage credits`
  numa das tentativas, e o efeito disso num agente no meio do trabalho é
  desconhecido.
- **Os outros workflows.** Só o `03_qa` rodou assim. `01_coding` e `02_product`
  são o próximo experimento, e o `02_product` é o mais provável de quebrar: ele
  faz fan-out de subagentes, e um agente do herdr abrindo subagentes é uma
  camada a mais que ninguém testou.
