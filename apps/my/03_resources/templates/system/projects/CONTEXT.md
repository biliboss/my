---
type: template
---

<!--
TEMPLATE — copie para `01_projects/<project_slug>/<project_slug>.md`.
Escrito pelo 002_scope, aprovado no gate do sub-verbo, e só então publicado.
-->

---
projeto: <slug>
area: NN-<slug>
dono: <nome>
state: ativo            # ativo | pausado | entregue | descartado
tasks: tasks/           # a menor unidade mora lá — `my kanban capture`
issues: issues/         # OPCIONAL: as issues do GitHub que este projeto acompanha,
                        # uma pasta por issue, e as fechadas em `issues/done/`.
                        # Só quando existe repo de fora — `my resources project issues`.
repo: <owner>/<name>    # o repo onde as issues vivem; sem ele, `issues/` não faz
                        # sentido e o check acusa
prazo: <YYYY-MM-DD>     # OPCIONAL: projeto sem data é o que a casa chama de área.
                        # Fica de fora quando o fim é um ESTADO ("o registry
                        # responde"), e não uma data — e aí `state:` é o que diz
                        # se ainda está de pé.
---

# <O projeto, dito como resultado e não como assunto>

**Resultado:** <o que existe no mundo quando isto acabar>
**Serve a área:** [<area>](../../02_areas/NN-<slug>/<slug>.md)

``mermaid
flowchart LR
  A[<estado hoje>] --> B[<o trabalho>]
  B --> C[<resultado>]
``

## Por que este projeto e não outro

<Uma coisa que só este projeto resolve. Se serve pra qualquer projeto, apague.>

## O estado, medido

<O que foi VERIFICADO no research — número, data, fonte. Sem isto o escopo é
chute com formatação bonita.>

| achado | número |
|---|---|
| <o que foi medido> | <valor> |

## Escopo

<O que o projeto faz. Cada item é entregável, não atividade.>

1. <item>

## Fora de escopo

<O que alguém razoavelmente esperaria aqui e NÃO vem — com o porquê. Escopo
sem esta seção é escopo que cresce sozinho.>

## Pronto quando

<O teste que decide, sem discussão. Se duas pessoas podem discordar do
resultado do teste, não é um teste.>

## Aberto

- <o que ninguém sabe ainda, e o que trava se continuar sem resposta>

## References

- [`tasks.md`](tasks.md) — o trabalho, sempre atualizado
- @02_areas/NN-<slug>/<slug>.md — a área que este projeto serve
- [[<YYYY-MM-DDTHHMMZ>_<slug>]] — a nota que originou
