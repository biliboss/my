---
type: template
---

<!--
TEMPLATE — `01_projects/<projeto>/sprints/NNN_<slug>/CONTEXT.md`.
Escrito por `my sprints new "<título>"`, que preenche o front matter e o `#`.

O NNN CONTA PRA BAIXO DESDE 999, e é o ENDEREÇO da sprint. Mais novo = número
menor = primeiro num `ls`, então a sprint que se está planejando agora é a
primeira coisa que aparece na sidebar. Número não é reusado nem renumerado:
citação a ele tem que continuar valendo — `my sprints new -n <ocupado>` RECUSA.

A SPRINT É UM AGENTE, não uma fase — #sprint_package. As tasks dentro dela são
o checklist dele, rodadas na ordem que o número diz (001, 002, …), numa worktree
só. Por isso a sprint custa a SOMA das `duration` das tasks, e o teto é 10
minutos — #sprint_order_and_size. Acima do teto a alavanca é PARTIR em outra
sprint; nunca encolher a task pra caber.

A SPRINT NÃO LISTA AS TASKS DELA. A pasta já lista: `001_<nome>/`, `002_<nome>/`.
Uma lista aqui seria a segunda fonte, e é sempre ela que envelhece.
-->
---
issue: <n>              # a issue que esta sprint virou, quando existir
waits_for:              # a sprint que precisa ter entrado antes; vazio = ela abre em paralelo
  - <NNN_slug>
---

# <o que o dono PODE FAZER quando a sprint entrar, no presente, até 5 palavras>

<O QUE é este pacote, em um parágrafo: a capacidade que a soma das tasks entrega,
e o termo que não é óbvio definido na primeira frase.>

## Why

<POR QUE este pacote existe, e por que AGORA: o que ele desbloqueia, ou o que
acontece se ele não entrar. "Porque está no plano" não é why.>

## Fora desta sprint

<O que alguém abriria esta pasta esperando encontrar e NÃO está aqui — com a
sprint que cobre, quando existir.>
