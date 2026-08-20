---
type: template
---

<!--
TEMPLATE — `01_projects/<projeto>/sprints/NNN_<sprint>/NNN_<task_name>/output.md`.
Nasce junto com a task, em `state: draft`, e é PREENCHIDO QUANDO A TASK ACABA.

Nasce vazio de propósito: arquivo que já existe em draft é preenchido; arquivo
que precisa ser criado no fim não é criado.

A FORMA É UM TETO, e o teto é o que faz isto ser lido: um parágrafo de resumo,
depois 3 a 5 seções, UM parágrafo cada. Passou de cinco seções, ou uma seção
virou duas frases soltas com bullet, era outra task — não outra seção.

O que vem do git NÃO se escreve à mão em prosa: `commit_start` e `commit_end`
delimitam o diff, e `git log <start>..<end>` é o relatório de verdade.
-->
---
state: draft            # draft | done | blocked | dropped
claude_session: <url ou id da sessão que executou>
commit_start: <sha do HEAD ANTES do primeiro commit da task>
commit_end: <sha do último commit da task>
---

# Output — <o título da task>

<UM parágrafo: o que ficou diferente no mundo, medido. Sem "foi implementado
com sucesso" — o que mudou, e o número que mostra que mudou.>

## <a decisão que o trabalho obrigou a tomar>

<Um parágrafo.>

## <o que a prova mediu>

<Um parágrafo: o comando, e o que ele devolveu.>

## <o que NÃO virou, e por quê>

<Um parágrafo. Seção que fica vazia sai do arquivo; seção inventada pra ter
cinco é ruído.>
