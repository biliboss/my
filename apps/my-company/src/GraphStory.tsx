import { Story, type StoryStep } from "@biliboss/my-ui";
import { GraphCanvas, type GraphNode } from "@biliboss/my-ui/graph";

//! A TEORIA, DESENHADA. O que sobrou aqui depois do my-ui é só o que é DESTE
//! produto: os dezesseis nós e o que cada passo diz. A dobra parallax, o canvas
//! do cytoscape e as paradas do `j`/`k` são da casa.

const NODES: GraphNode[] = [
  { id: "company", label: "sua empresa", level: 0 },
  { id: "vender", label: "vender o que entrega", level: 1, parent: "company" },
  { id: "entregar", label: "entregar o que vendeu", level: 1, parent: "company" },
  { id: "amar", label: "ser amado pelo que entregou", level: 1, parent: "company" },
  { id: "descoberta", label: "descoberta", level: 2, parent: "vender" },
  { id: "proposta", label: "proposta", level: 2, parent: "vender" },
  { id: "fechamento", label: "fechamento", level: 2, parent: "vender" },
  { id: "onboarding", label: "onboarding", level: 2, parent: "entregar" },
  { id: "producao", label: "produção", level: 2, parent: "entregar" },
  { id: "aceite", label: "aceite", level: 2, parent: "entregar" },
  { id: "suporte", label: "suporte", level: 2, parent: "amar" },
  { id: "sucesso", label: "sucesso do cliente", level: 2, parent: "amar" },
  { id: "comunidade", label: "comunidade", level: 2, parent: "amar" },
  { id: "seu-jeito", label: "o seu jeito", level: 3, parent: "proposta", custom: true },
  { id: "seu-ritual", label: "o seu ritual", level: 3, parent: "producao", custom: true },
  { id: "seu-cuidado", label: "o seu cuidado", level: 3, parent: "sucesso", custom: true },
];

const STEPS: StoryStep[] = [
  {
    kicker: "PASSO 1",
    title: "Toda empresa cabe numa bolinha.",
    copy: "É aqui que a conversa começa. Uma empresa, uma tela, zero desculpa pra não enxergar.",
  },
  {
    kicker: "PASSO 2",
    title: "Toda empresa depende de três processos.",
    copy: "Vender o que entrega. Entregar o que vendeu. Ser amado pelo que entregou. O resto é variação.",
  },
  {
    kicker: "PASSO 3",
    title: "Aí começa o jogo.",
    copy: "Cada um dos três depende de outros processos pra acontecer. E cada empresa tem os seus.",
  },
  {
    kicker: "PASSO 4",
    title: "O seu jeito é o produto.",
    copy: "O my-company já vem com uma série de processos prontos pra configurar — e deixa você criar o seu jeito de fazer e adaptar.",
  },
];

export function GraphStory({ theme }: { theme: string }) {
  return (
    <Story steps={STEPS} stepVh={110}>
      {(step) => <GraphCanvas nodes={NODES} level={step} theme={theme} />}
    </Story>
  );
}
