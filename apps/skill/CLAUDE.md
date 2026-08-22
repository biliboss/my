---
type: context
---

# apps/skill — por que ela existe, e por que ela mora AQUI

O `SKILL.md` diz COMO usar o CLI `my`. Este arquivo diz **por que esta skill
existe** e **como ela evolui** — e só quem vai editar a skill precisa dele.

## Por que ela mora no repositório do CÓDIGO

Ela morou em `~/src/me/skills/my/` até 22/08, junto da casa que ela descreve. O
problema era mecânico: **a skill descreve a superfície de comandos, e a
superfície de comandos é `apps/my_cli/src/`.** Verbo novo, verbo renomeado, verbo
morto — tudo isso acontece neste repositório, e uma skill no outro só descobre
depois que alguém se lembra. Aqui ela entra no MESMO diff que a mudou.

O que ela NÃO descreve é o conteúdo da casa: as referências, as regras, os
projetos. Isso continua em `~/src/me`, e a skill chega lá por VERBO
(`my references <nome>`), nunca por caminho — que é o que a deixa funcionar de
qualquer diretório, inclusive de um repositório que não é a casa.

## O papel de produção

A casa é grande e quase tudo nela é derivado do disco: os workflows são pastas,
os comandos são arquivos, as regras são markdown. Uma sessão que começa lendo a
árvore inteira gasta o contexto antes de fazer trabalho, e uma que não lê nada
improvisa processo.

A skill é o atalho entre os dois: **a menor coisa que faz um agente rotear certo
na primeira tentativa.** Por isso ela é curta, por isso ela cita VERBO e não
caminho, e por isso ela nunca copia uma lista que o disco já responde — tabela de
nomes escrita à mão apodrece na direção que ninguém olha.

**O topo dela é o PORQUÊ, e isso é deliberado.** A skill é escolhida por um
agente que ainda não sabe que ela existe pra este pedido; se as primeiras linhas
forem gramática de comando, ele não a invoca. As primeiras linhas dizem o que o
`my` GERE — nota, dia, pedido, projeto, sprint, frota — porque é isso que casa
com um pedido em linguagem de gente.

## O papel de sandbox, e é o que `references/experimental/` é

Uma prática nova não nasce sabendo se presta. Escrevê-la direto como referência
de workflow na casa a torna contrato — e contrato errado é pior que nenhum,
porque agente obedece.

Então ela nasce aqui, com o rótulo dizendo a verdade: **rodou N vezes, e pode
morrer.** É relato, não contrato. A skill é o lugar certo porque ela já é lida
por toda sessão que mexe na casa: o experimento fica visível pra quem poderia
usá-lo, sem virar regra pra quem não pediu.

**Sandbox aqui é um ESTÁGIO, não um comando.** Não existe verbo `my sandbox`, e
não deve passar a existir com esse nome: a palavra já nomeia um grau de
maturidade nesta escada.

## A escada da graduação

Um experimento sobe conforme prova, e cada degrau custa mais que o anterior:

| onde está | o que significa | o que é preciso pra subir |
|---|---|---|
| `references/experimental/` | rodou, foi medido, pode morrer | — |
| referência de workflow na casa | é o jeito de fazer aquilo | rodou em mais de um caso, e o contrato de um main aponta pra ela |
| referência de sistema (`references/system/`) | é um conceito da casa | vale além de um workflow, e tem cicatriz que explica o porquê |
| verbo do CLI (`apps/my_cli/src/<pasta>/<verbo>.ts`) | é mecânico e repetido | alguém ia digitar a mesma sequência de novo |

A descida também existe e é saudável: experimento que não foi usado em duas
semanas **se apaga**, e o commit que apaga diz por quê. Pasta de experimento que
só cresce é cemitério com outro nome.

## O que faz um arquivo de `experimental/` prestar

**O que NÃO foi medido é escrito junto, e com o mesmo destaque** — é a parte que
separa relato de propaganda. E **cada afirmação carrega o que custou**: "o
contrato vai por ponteiro" é opinião; "inlinar 77 linhas fez o herdr recusar com
`arguments cannot be encoded safely`, e o mesmo pane aceitou um prompt curto no
segundo seguinte" é medição.

## O que esta skill NÃO é

Não é documentação da casa — isso é o `CONTEXT.md` da raiz dela e os `CONTEXT.md`
de cada pasta. Não é a lista de referências — isso é `my references` sem
argumento. Não é o META.

Quando algo aqui começa a duplicar um desses, o certo é apagar daqui e apontar.
Regra escrita em dois lugares diverge na primeira correção, e a que diverge
silenciosamente é sempre a cópia.

## Instalação

Symlink global, alvo ABSOLUTO — `~/.claude/skills/` não é versionado junto:

```bash
ln -s ~/src/my/apps/skill ~/.claude/skills/my
```

Symlink e não cópia pelo motivo de sempre: cópia diverge na primeira correção.
E é global e não de projeto porque quem lê esta skill quase sempre está FORA da
casa — um agente que commita em outro repositório enquanto grava o registro aqui.
