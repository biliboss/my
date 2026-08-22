---
type: template
---

<!--
TEMPLATE — `01_projects/<projeto>/sprints/NNN_<sprint>/NNN_<nome>/CONTEXT.md`.
Escrito por `my kanban capture <board> "<título>"`, que preenche o front matter e o `#`.

A TASK MORA DENTRO DA SPRINT (desde 18/08). A sprint conta pra BAIXO desde 999 —
mais nova em cima —, e a task conta pra CIMA desde 001 dentro dela, porque aí o
número É a ordem de execução: 001 roda antes de 002. O número não é reusado nem
renumerado: ele é o ENDEREÇO, e citação a ele tem que continuar valendo. Nome da
pasta e do título: `my resources task_naming`.

Este arquivo é o PEDIDO, e pedido não muda porque o trabalho andou. O resultado
mora no `output.md` ao lado, e é `my kanban move|done` que escreve nele.

A TASK NÃO DECLARA A SPRINT: sem `sprint:`, sem `run:`, sem `issue:`. A PASTA que
a contém já diz de quem ela é — campo pra isso seria a segunda fonte, e é sempre
ela que envelhece. O que ela declara é o que é dela: título, porquê, prova,
duração, worktree.

A DURAÇÃO É O QUE A SPRINT SOMA, e o teto da sprint é 10 minutos
(#sprint_order_and_size). `my sprints list` soma e acusa quem passou — e acusa
também quem não declarou, porque sem `duration` o teto não é verificável.

AS QUATRO SEÇÕES SÃO OBRIGATÓRIAS, e a ordem é a que responde na sequência em que
alguém pergunta: o que é isso → por que estou fazendo → como sei que acabou → o
que não é meu. `## Why` faltando é o erro mais caro: task sem porquê é executada
ao pé da letra e entrega a coisa errada com a prova passando.

SE APARECE UM SUBSTANTIVO QUE NÃO É ÓBVIO, a primeira frase o define. Quem abre
esta pasta não leu o projeto, e "instala o zot" não diz o que zot é nem por que
ele resolve algo.

`refs/` é opcional: symlink pro arquivo real (nunca cópia — cópia envelhece sem
avisar), nota, print, o trecho de log que decidiu.
-->
---
worktree: <caminho>     # onde o trabalho acontece — `~/.me/worktrees/<proj>__<sprint>_<pasta>`
branch: <task/…>        # o branch que a worktree carrega
duration: <n> min       # quanto ela custa; quem soma é a SPRINT — #sprint_order_and_size
proof: |                # o comando que prova ESTA task — #proof_per_task
  <rg | test | wc -l>
references:             # ancorado, nunca linha — #anchored_references
  - <caminho#ancora>
---

# <o RESULTADO, no presente, até 7 palavras>

<O QUE é isto, em um parágrafo, definindo o termo que não é óbvio. Quem abre esta
pasta não leu o projeto.>

## Why

<POR QUE esta task existe, e por que AGORA: o que ela desbloqueia, ou o que
acontece se ela não for feita. Se a escolha é contra-intuitiva, o porquê da
escolha — e o que foi medido que a sustenta. "Porque está no plano" não é why.>

## Como se prova

<O `proof` do front matter, dito em uma linha: o que exatamente ele mede, e o que
um exit 1 significa. Prova que passa com a task pela metade não é prova.>

## Fora desta task

<O que alguém abriria esta pasta esperando encontrar e NÃO está aqui — com o
número da task que cobre, quando existir.>
