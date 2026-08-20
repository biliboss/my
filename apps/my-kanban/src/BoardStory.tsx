import { LayoutGroup, motion } from "framer-motion";
import { Chip, ChipRow, LpParallax } from "@biliboss/my-ui";

//! A DEMONSTRAÇÃO: o mesmo conjunto de cards, quatro perguntas diferentes.
//!
//! A tese do my-kanban cabe numa frase: **a coluna é uma pergunta, não uma
//! gaveta.** O card não muda de dono nem de estado quando a perspectiva troca —
//! muda o eixo pelo qual a gente está olhando, e o card só reaparece embaixo de
//! outra coluna. `layoutId` faz esse voo ser visível; sem ele a troca seria um
//! corte, e um corte não prova que é o MESMO card.
//!
//! O parallax é uma variável só, `--p` (0→1), escrita no scroll: halo desce,
//! quadro sobe devagar, legenda sobe rápido. Três ritmos, zero biblioteca.

type Status = "inbox" | "backlog" | "ready" | "doing" | "done";

type Task = {
  id: string;
  title: string;
  status: Status;
  area: "vender" | "entregar" | "amar";
  quem: "gabriel" | "frota" | "cliente";
  risco: "alto" | "médio" | "baixo";
};

/** As cinco colunas PADRÃO. São padrão, não lei — o eixo `status` é um eixo como
 *  qualquer outro, e trocar as colunas dele é a mesma operação de trocar de
 *  perspectiva. `inbox` é EFÊMERO de propósito: é o lugar onde se joga sem
 *  decidir, inclusive pedindo pra um agente. Nada mora ali. */
const STATUS_COLUMNS: Array<[Status, string]> = [
  ["inbox", "inbox"],
  ["backlog", "backlog"],
  ["ready", "ready"],
  ["doing", "in progress"],
  ["done", "done"],
];

const TASKS: Task[] = [
  { id: "t1", title: "Ligar o board no ledger ao vivo", status: "doing", area: "entregar", quem: "gabriel", risco: "alto" },
  { id: "t2", title: "Perspectiva por rótulo", status: "doing", area: "entregar", quem: "gabriel", risco: "médio" },
  { id: "t3", title: "Landing da família", status: "done", area: "vender", quem: "frota", risco: "baixo" },
  { id: "t4", title: "\"aquilo do cliente, ver depois\"", status: "inbox", area: "amar", quem: "cliente", risco: "alto" },
  { id: "t5", title: "Onboarding em uma tela", status: "ready", area: "entregar", quem: "frota", risco: "médio" },
  { id: "t6", title: "Escrever a proposta", status: "ready", area: "vender", quem: "gabriel", risco: "médio" },
  { id: "t7", title: "Medir o lead time real", status: "backlog", area: "amar", quem: "frota", risco: "baixo" },
  { id: "t8", title: "Rótulo vira coluna", status: "backlog", area: "entregar", quem: "gabriel", risco: "baixo" },
  { id: "t9", title: "Aceite assinado", status: "done", area: "entregar", quem: "cliente", risco: "baixo" },
  { id: "t10", title: "\"olhar o canal da comunidade\"", status: "inbox", area: "amar", quem: "frota", risco: "médio" },
  { id: "t11", title: "Fechamento do trimestre", status: "backlog", area: "vender", quem: "cliente", risco: "alto" },
  { id: "t12", title: "Descoberta com três clientes", status: "ready", area: "vender", quem: "gabriel", risco: "baixo" },
];

type Axis = keyof Pick<Task, "status" | "area" | "quem" | "risco">;

type Step = {
  axis: Axis;
  label: string;
  columns: Array<[string, string]>;
  /** A coluna que esta dobra está contando. */
  focus?: string;
  kicker: string;
  title: string;
  copy: string;
};

const plain = (vals: string[]): Array<[string, string]> => vals.map((v) => [v, v]);

const STEPS: Step[] = [
  {
    axis: "status",
    label: "status",
    columns: STATUS_COLUMNS,
    focus: "inbox",
    kicker: "01 · inbox",
    title: "Tudo cai num lugar só.",
    copy: "Você está no meio de outra coisa e lembrou. Cai no inbox — inclusive pedindo pra qualquer agente jogar ali. O inbox é efêmero de propósito: ninguém mora nele, e por isso ninguém precisa decidir na hora.",
  },
  {
    axis: "status",
    label: "status",
    columns: STATUS_COLUMNS,
    focus: "backlog",
    kicker: "02 · backlog",
    title: "Se for relevante, sobe.",
    copy: "O backlog é o primeiro filtro, e é o único momento em que se decide alguma coisa: isto merece existir amanhã? O que não merece some do inbox sem cerimônia.",
  },
  {
    axis: "status",
    label: "status",
    columns: STATUS_COLUMNS,
    focus: "ready",
    kicker: "03 · ready",
    title: "Pronto? joga pra cá.",
    copy: "Ready é a prateleira de onde os seus agentes PUXAM trabalho. Ninguém empurra tarefa pra ninguém: quem está livre puxa daqui, e a fila é a sua decisão, não a do agente.",
  },
  {
    axis: "status",
    label: "status",
    columns: STATUS_COLUMNS,
    kicker: "04 · o padrão",
    title: "Cinco colunas. E são só o padrão.",
    copy: "Inbox · backlog · ready · in progress · done vêm prontas porque quase todo fluxo começa assim. Mas status é um eixo como qualquer outro — e a próxima dobra mostra o que isso quer dizer.",
  },
  {
    axis: "area",
    label: "area:",
    columns: plain(["vender", "entregar", "amar"]),
    kicker: "05 · area:",
    title: "Mesmos cards. Outra pergunta.",
    copy: "Nada foi movido, nada foi duplicado. Trocou o eixo: agora a coluna é o processo que o card serve — vender, entregar, ser amado.",
  },
  {
    axis: "quem",
    label: "quem:",
    columns: plain(["gabriel", "frota", "cliente"]),
    kicker: "06 · quem:",
    title: "Quem está segurando o quê.",
    copy: "A mesma tela responde a pergunta da segunda-feira de manhã sem que ninguém mantenha um segundo quadro pra isso.",
  },
  {
    axis: "risco",
    label: "risco:",
    columns: plain(["alto", "médio", "baixo"]),
    kicker: "07 · risco:",
    title: "A coluna é uma query.",
    copy: "Qualquer rótulo chave:valor vira eixo. Sem migração, sem campo novo, sem quadro paralelo: o board é uma projeção, e a projeção é barata.",
  },
];

export function BoardStory() {
  return (
    <LpParallax steps={STEPS} stepVh={90} stageBottom={250} stageBottomSm={240}>
      {(step) => <Board step={STEPS[step]} />}
    </LpParallax>
  );
}

/** O QUADRO. Ele é do my-kanban — mas é feito COM as primitivas: `Chip` e
 *  `ChipRow` vêm do my-ui, então mudar o rótulo lá muda aqui. */
function Board({ step: s }: { step: Step }) {
  return (
    <LayoutGroup>
      <motion.div
        className="board"
        layout
        style={{ gridTemplateColumns: `repeat(${s.columns.length}, 1fr)` }}
      >
        {s.columns.map(([col, label]) => (
          <motion.section
            layout
            key={`${s.axis}-${col}`}
            className={`board-col ${s.focus === col ? "focus" : ""} ${s.focus && s.focus !== col ? "dim" : ""}`}
          >
            <header>
              <span className="col-name">{label}</span>
              <span className="col-count">{TASKS.filter((t) => t[s.axis] === col).length}</span>
            </header>
            <div className="board-stack">
              {TASKS.filter((t) => t[s.axis] === col).map((t) => (
                <motion.article
                  layout
                  layoutId={t.id}
                  key={t.id}
                  className="card"
                  transition={{ type: "spring", stiffness: 260, damping: 30 }}
                >
                  <p>{t.title}</p>
                  <ChipRow>
                    <Chip active={s.axis === "area"}>area:{t.area}</Chip>
                    <Chip active={s.axis === "quem"}>quem:{t.quem}</Chip>
                    <Chip active={s.axis === "risco"}>risco:{t.risco}</Chip>
                  </ChipRow>
                </motion.article>
              ))}
            </div>
          </motion.section>
        ))}
      </motion.div>
    </LayoutGroup>
  );
}
