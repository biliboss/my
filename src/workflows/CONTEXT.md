---
type: context
---

# src/workflows

Os verbos da casa, resolvidos do **disco**. Era um arquivo só com três modos
escondidos num `if`; virou uma pasta porque os modos são dois casos de uso
diferentes, e um deles é o mapa e o outro é o contrato.

| arquivo | o caso de uso |
|---|---|
| [`tree.ts`](tree.ts) | a árvore em si — categoria, workflow, corpo, descrição |
| [`list.ts`](list.ts) | `my workflows list` · `my workflows list 00_product` |
| [`show.ts`](show.ts) | `my workflows show do_a_drip` — o `CONTEXT.md` inteiro |

## O que a quebra resolveu

O despacho antigo era: sem argumento → categorias, argumento que É categoria →
os workflows dela, senão → tenta como workflow. Três coisas numa `main`, e o
`else` final significava que **errar o nome de uma categoria imprimia o mapa de
workflows** — a mensagem de erro do caso errado.

Agora `my workflows list nao_existe` reclama de CATEGORIA e aponta pro
`my workflows show`; `my workflows show nao_existe` reclama de WORKFLOW e imprime o mapa. Cada
erro carrega a saída do próprio caso.

## O que NÃO se quebrou

`tree.ts` é um arquivo só, e é de propósito: `categories`, `workflows`, `find`,
`body` e `summary` leem a MESMA árvore, e separar cada função num arquivo seria
cinco arquivos de dez linhas com o mesmo `readdirSync`. A regra de
[`../CONTEXT.md`](../CONTEXT.md) é *um arquivo por caso de uso* — `tree` não é
caso de uso, é o substantivo do qual os dois saem.

## O número é a ordem, e ordem muda

`do_a_drip` e `004_do_a_drip` chegam no mesmo lugar, categoria também. Quem
digita não deveria ter que saber a numeração de hoje — ela existe pra dizer a
SEQUÊNCIA, não pra ser decorada.

## Por que isto não é `meta.ts`

`my meta` serve os quatro processos de PRODUTO, e o nome de cada um vem do
`# ` da primeira linha. Os steps de `01_engineering/` e `02_system/` abrem com
frontmatter e não têm esse heading — eles são achados pelo MAPA. Um segundo
leitor de 40 linhas é mais barato que ensinar o de 1600 a falar de duas famílias
com regras diferentes.

## Verify

```bash
bun test src/workflows/
my workflows list 02_system   # a descrição de cada um, tirada da primeira prosa
my workflows show do_a_drip   # verbatim, não resumo
```
