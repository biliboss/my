---
type: template
---

<!--
TEMPLATE — o texto que se manda pro agente delegado. Escreva num arquivo do
scratchpad e mande com:

  herdr agent prompt <label> "$(cat <arquivo>)"
  herdr agent send-keys <label> enter      # o prompt só DIGITA; falta o Enter

Regra do brief: PONTEIRO, nunca cópia. Papel, processo e formato já estão em
arquivo — reescrever aqui cria uma segunda verdade que diverge na primeira
mudança. Medido: um brief à mão de 3.109 caracteres contra 45 da forma mínima,
e foi o longo que pulou um passo obrigatório.
-->

You are the delegated agent `<label>` for run `<run-id-slug>`.

Read, in order:

  ~/src/me/CONTEXT.md                                          — the house, and the no-script rule
  ~/src/me/02_areas/00_workflows/<família>/<step>/CONTEXT.md   — your step: role, process, output
  ~/.claude/skills/harakiri/SKILL.md                           — how you end
  ~/src/me/02_areas/00_workflows/00_main/<main>/output/<run>/  — state.yaml and prior artifacts
  <os arquivos do assunto — projeto, repo, o que for>

Os dois caminhos do meio ESTAVAM ERRADOS até 19/08: mandavam `~/src/me/steps/` e
`~/src/me/_step_runs/`, e nenhum dos dois existe em disco — o step virou pasta em
`02_areas/00_workflows/` e a run saiu do bucket `_meta/` pro `output/` do processo
que a abriu, em 17/08. Um brief é PONTEIRO, e ponteiro pro vazio manda o agente
procurar ou seguir cego, que é o modo de falha que não estoura.

Everything about how to work is in those files. Do not re-derive it.

<A TAREFA, em uma frase. O que tem que existir no mundo quando você terminar.>

Deliver, in this order:

1. <artefato>
2. <artefato>
3. `<caminho>/output.yaml` — **LAST**, with the `origem` block
   (`gerado_por: agente <label>`, `pane: $HERDR_PANE_ID`). Its birth is the
   completion signal a monitor outside is waiting for, so nothing may be
   written after it.

Then end yourself: `herdr pane close "$HERDR_PANE_ID"` — but only after reading
your own output back and confirming every file above exists. If anything is
missing, do NOT close: write it into `nao_virou`/`pendente` with the reason and
stop. A dead agent with an incomplete delivery takes the explanation with it.

**Execute every task. Do not ask.** No confirmation questions, no "should I
proceed", no handing a decision back. Uncertain about something that does not
block the work? Assume the most likely reading, say which assumption you took
in the output, and keep going. Genuinely blocked? That is a `pendente` line,
not a question — there is nobody at this pane to answer it.

Report facts, never orders: what you verified vs what you assumed, counts of
what worked and what failed, and anything that changes the scope. Prefix every
message with your pane id.
