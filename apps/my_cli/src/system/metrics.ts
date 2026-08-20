//! Every measure this house takes about ITSELF, in one file — six scripts folded
//! into one because none of them has its own storage: each reads a source that
//! already exists (git log, a hook, the CLI's own .jsonl, an event folder), and
//! a family with one source PER file was six places to look for "how do we
//! measure", not six measures. `src/CONTEXT.md` still explains the naming
//! convention (`system/metrics/<what>` — this is the one file left under it).
//!
//!   bun run src/system/metrics.ts task-runtime <tasks.md>   (`my system metrics task-runtime`)
//!   bun run src/system/metrics.ts task-runtime --todos
//!   bun run src/system/metrics.ts claude-session <run-slug>
//!   bun run src/system/metrics.ts claude-session --session <uuid> --json
//!   bun run src/system/metrics.ts askuser --hook              (called by hooks)
//!   bun run src/system/metrics.ts askuser [--sessao <id>] [--json]

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { has, value } from "../shared/argv.ts";
import { homedir } from "node:os";
import { index } from "../runs.ts";
import { root } from "../home/paths.ts";

// A CASA, e não o caminho de UMA máquina. Era literal — a última linha do fonte
// que só funcionava no laptop do Gabriel, e a que teria ido pública inteira no
// commit da mudança pro `biliboss/my`.
const ME = root();

/** O rodapé que toda medida desta casa tem que imprimir quando JOGOU LINHA FORA.
 *
 *  Os três leitores daqui pulam linha ilegível — `.askuser.jsonl` truncado por um
 *  append concorrente, `.jsonl` de sessão ainda sendo escrito — e pular calado é o
 *  jeito de um p85 encolher sem ninguém saber por quê. O `--json` de cada um já
 *  publicava `amostras_ignoradas`; esta função é a mesma verdade no modo humano.
 *
 *  Nada quando não houve descarte: rodapé que aparece sempre vira rodapé que
 *  ninguém lê. */
function reportaDescartes(descartes: string[]): void {
  if (!descartes.length) return;
  console.log(`\n⚠ ${descartes.length} linha(s) ignorada(s) — a amostra acima NÃO as inclui:`);
  for (const d of descartes.slice(0, 5)) console.log(`  ${d}`);
  if (descartes.length > 5) console.log(`  … e mais ${descartes.length - 5}`);
}

// =============================================================================
// task-runtime — quanto leva uma tarefa, lido do HISTÓRICO do git, não de
// carimbo novo.
//
// O commit É a fonte da verdade. Um commit que vira `- [ ]` em `- [x]` diz DUAS
// coisas ao mesmo tempo: que a tarefa fechou, e QUANDO — e o "quando" é o que
// nem o texto nem a memória de ninguém se dá sozinho. Não existe arquivo novo,
// carimbo novo nem daemon: o dado já está sendo escrito desde que o
// @02_areas/00_workflows/00_main/01_coding/CONTEXT.md passou a mandar marcar no commit da tarefa.
//
// O QUE ELE NÃO FAZ, e é a parte que importa: não estima. Commit que fecha
// várias tarefas de uma vez é RAJADA — ali o git registra quando o agente
// sentou pra escrever, não quando cada tarefa terminou. Rajada sai da amostra e
// aparece no relatório, porque média sobre rajada é o tipo de número que parece
// medida e é chute (medido em 14/08: um commit fechou 14, e os dois seguintes
// vieram 0min depois).
//
// A saída alimenta o Monte Carlo do META.md#dog_and_camel.
// =============================================================================

const git = (...a: string[]) => execFileSync("git", a, { cwd: ME, encoding: "utf8" });

/** Até quantas tarefas num commit ainda contam como "uma sentada". Duas é o
 *  limite honesto: uma tarefa mais o ajuste que ela obrigou. De três pra cima
 *  não dá pra dizer qual delas consumiu o tempo. */
const RAJADA = 2;

type EventoTarefa = { ts: number; fechou: number; sha: string; msg: string };

const eventosTarefa = (arquivo: string): EventoTarefa[] =>
  git("log", "--format=%H %ct %s", "--", arquivo)
    .trim().split("\n").filter(Boolean)
    .map((l) => {
      const [sha, ts, ...m] = l.split(" ");
      // `-U0`: só as linhas que mudaram. Sem isso o contexto do diff traz
      // `- [x]` que já existia e todo commit parece fechar o arquivo inteiro.
      const d = git("show", "--format=", "-U0", sha, "--", arquivo);
      const fechou = d.split("\n").filter((x) => x.startsWith("+") && x.includes("- [x]")).length;
      return { ts: Number(ts), fechou, sha: sha.slice(0, 7), msg: m.join(" ") };
    })
    .filter((e) => e.fechou > 0)
    .reverse();                                  // do mais VELHO pro mais novo

const analisaTarefas = (arquivo: string) => {
  const evs = eventosTarefa(arquivo);
  const amostra: number[] = [];
  let rajadas = 0, emRajada = 0;
  for (let i = 1; i < evs.length; i++) {
    const min = Math.round((evs[i].ts - evs[i - 1].ts) / 60_000);
    if (evs[i].fechou > RAJADA) { rajadas++; emRajada += evs[i].fechou; continue; }
    // O intervalo é DIVIDIDO pelas tarefas do commit: fechar duas em 20min é
    // duas de 10, não duas de 20. Aproximação, e é por isso que RAJADA é baixo.
    for (let k = 0; k < evs[i].fechou; k++) amostra.push(Math.max(1, Math.round(min / evs[i].fechou)));
  }
  return { evs, amostra, rajadas, emRajada };
};

function taskRuntime(args: string[]): void {
  const alvo = args[0];
  if (!alvo) { console.error("uso: task-runtime <tasks.md> | --todos"); process.exit(1); }

  const arquivos = alvo === "--todos"
    ? readdirSync(join(ME, "01_projects"))
        .flatMap((p) => {
          const f = join(ME, "01_projects", p, "features");
          return existsSync(f)
            ? readdirSync(f).map((x) => `01_projects/${p}/features/${x}/tasks.md`)
            : [];
        })
        .filter((f) => existsSync(join(ME, f)))
    : [alvo.replace(`${ME}/`, "")];

  let total: number[] = [], rajTotal = 0, emRajTotal = 0;
  for (const f of arquivos) {
    const { evs, amostra, rajadas, emRajada } = analisaTarefas(f);
    if (!evs.length) continue;
    console.log(`\n${f}`);
    for (const e of evs) {
      const q = e.fechou > RAJADA ? `🚨 rajada de ${e.fechou}` : `+${e.fechou}`;
      console.log(`  ${new Date(e.ts * 1000).toISOString().slice(5, 16).replace("T", " ")}  ${q.padEnd(16)} ${e.sha}  ${e.msg.slice(0, 46)}`);
    }
    total.push(...amostra); rajTotal += rajadas; emRajTotal += emRajada;
  }

  total.sort((a, b) => a - b);
  console.log(`\n── amostra por TAREFA ──`);
  if (!total.length) {
    console.log("  vazia. Toda tarefa fechada até agora veio em rajada — o git sabe QUANDO");
    console.log("  alguém escreveu, não quando cada uma terminou. Um commit por tarefa é o");
    console.log("  preço da previsão (@02_areas/00_workflows/00_main/01_coding/CONTEXT.md, passo 6.5).");
  } else {
    const p = (k: number) => total[Math.min(total.length - 1, Math.floor((total.length * k) / 100))];
    console.log(`  n=${total.length} · min ${total[0]}min · p50 ${p(50)}min · p85 ${p(85)}min · max ${total.at(-1)}min`);
    console.log(`  ${JSON.stringify(total)}`);
  }
  if (rajTotal) console.log(`  DESCARTADO: ${rajTotal} commit(s) em rajada, ${emRajTotal} tarefas — não dá pra saber qual consumiu o tempo`);
}

// =============================================================================
// A LEITURA COMPARTILHADA por agent-runtime e monte-carlo saiu daqui em 17/08,
// junto com a pasta `_events/` que era a fonte dela. Ela lia nome de pasta
// (`<verbo>_completed__<slug>`) e o `created_at` do `state.yaml` — duas coisas que
// só existiam ali. Reescrevê-la em cima da pasta do run seria inventar um
// `created_at` que ninguém escreve; a fonte honesta, quando a pergunta voltar, é o
// `duration_ms` que o harness devolve por agente.
// =============================================================================
// askuser — quanto tempo um popup fica aberto esperando o Gabriel, carimbado pelo harness,
// não pela memória de ninguém.
//
// O `espera_s` de uma rodada de drip é a medida mais reveladora que ela tem — o
// gargalo do laço é sempre a resposta humana — e é a que mais se perde. Medido em
// 14/08 sobre as SETE rodadas do dia: três fecharam `null`, três `desconhecido`,
// e UMA trouxe o número. Seis de sete.
//
// A causa é sempre a mesma: `AskUserQuestion` não devolve quanto tempo ficou
// aberto, então a única fonte era eu rodar `date` antes de abrir o popup e depois
// de a resposta chegar. Depende de lembrar, duas vezes por gota, e passada a
// rodada não se recupera de lugar nenhum.
//
// O HARNESS JÁ SABE, e é isso que torna este bloco curto: `PreToolUse` dispara
// quando o popup sobe e `PostToolUse` quando a resposta chega, os dois com matcher
// por nome de ferramenta. É o META.md#source_already_exists aplicado ao laço.
//
// `Elicitation`/`ElicitationResult` PARECEM o par certo — a doc os descreve como
// "when an MCP server requests user input" e "after a user responds". São MCP-only:
// disparam dentro de execução de ferramenta MCP, e `AskUserQuestion` é NATIVA.
// Escrito aqui porque foi a primeira tentativa, e seria o erro caro de repetir.
//
// E ELE NÃO PODE DERRUBAR O HOSPEDEIRO. `PreToolUse` é evento que BLOQUEIA com
// exit 2: um hook de medição que saísse 2 aí engoliria o popup do Gabriel, e uma
// medida não vale um popup perdido. Sai 0 em todo caminho, nada em stdout.
// Ver 01_projects/vscode-terminal-automation/design/nao_derruba_o_hospedeiro.md.
// =============================================================================

// `_step_runs/` died on 15/08 and this was the last thing writing into it — a
// folder kept alive by one ledger nobody could see. The raw stream lives at the
// root now, ignored by git, beside `.meta-lookups.tsv`: same shape of fact
// (high frequency, zero value per line, worth counting in aggregate) and the
// same rule from #source_already_exists — the source stays local, what earns a
// commit is what a reader extracts from it.
const ASKUSER_DIR = ME;
const ASKUSER_LEDGER = join(ME, ".askuser.jsonl");

/** Uma pergunta ou uma resposta. `espera_s` sai da diferença, na LEITURA. */
type LinhaAskuser = {
  at: string;
  fase: "perguntou" | "respondeu";
  sessao: string;
  cwd?: string;
  pergunta: string;
  /** Só na resposta: o rótulo que ele clicou. É o `porque_dele` do step 005. */
  resposta?: string;
};

/** Um arquivo só, com `sessao` como campo — pasta rasa ganha de árvore (@CLAUDE.md).
 *  Linha única por append é atômica o bastante em POSIX pra sessões concorrentes. */
function gravaAskuser(linha: LinhaAskuser): void {
  mkdirSync(ASKUSER_DIR, { recursive: true });
  appendFileSync(ASKUSER_LEDGER, JSON.stringify(linha) + "\n");
}

function askuser(args: string[]): void {

  // ---------------------------------------------------------------------------
  // modo hook — chamado pelo harness, com o JSON do evento em stdin
  // ---------------------------------------------------------------------------
  if (has("hook", args)) {
    try {
      const cru = readFileSync(0, "utf8");
      const e = JSON.parse(cru);

      // O matcher já filtra, mas o hook pode ser chamado com matcher "*" por
      // engano — e gravar toda ferramenta encheria o ledger de ruído permanente.
      if (e.tool_name !== "AskUserQuestion") process.exit(0);

      const perguntas = e.tool_input?.questions ?? [];
      const pergunta = String(perguntas[0]?.question ?? "").slice(0, 300);

      if (e.hook_event_name === "PreToolUse") {
        gravaAskuser({
          at: new Date().toISOString(),
          fase: "perguntou",
          sessao: e.session_id ?? "?",
          cwd: e.cwd,
          pergunta,
        });
      } else {
        // O que ele escolheu, VERBATIM — é o campo que o step 005 pede como
        // `porque_dele`, e que hoje sai da minha paráfrase. Capado em 300: rótulo
        // é curto, e "Other" com texto livre pode trazer qualquer coisa.
        const respostas = e.tool_response?.answers ?? {};
        const resposta = String(Object.values(respostas)[0] ?? "").slice(0, 300);

        gravaAskuser({
          at: new Date().toISOString(),
          fase: "respondeu",
          sessao: e.session_id ?? "?",
          pergunta,
          resposta,
        });
      }
    } catch {
      // Silêncio absoluto por desenho. stdin torto, disco cheio, JSON quebrado —
      // nada disso pode custar um popup ao Gabriel.
    }
    process.exit(0);
  }

  // ---------------------------------------------------------------------------
  // modo relatório
  // ---------------------------------------------------------------------------
  if (!existsSync(ASKUSER_LEDGER)) {
    console.log("nenhum popup registrado ainda — o hook está instalado?");
    process.exit(0);
  }

  const descartes: string[] = [];
  const linhas: LinhaAskuser[] = readFileSync(ASKUSER_LEDGER, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as LinhaAskuser];
      } catch (e) {
        descartes.push(`${ASKUSER_LEDGER}: linha ilegível (${(e as Error).message}) — ${l.slice(0, 60)}`);
        return [];
      }
    });

  const sessao = value("sessao", undefined, args);
  const escopo = sessao ? linhas.filter((l) => l.sessao.startsWith(sessao)) : linhas;

  /** Pareia cada resposta com a pergunta ABERTA mais recente da mesma sessão.
   *  Por sessão e não global: duas sessões perguntando ao mesmo tempo é o caso
   *  normal desta casa, e parear entre elas inventaria esperas que não houve. */
  const abertas = new Map<string, LinhaAskuser>();
  const pares: Array<{ pergunta: string; resposta: string; espera_s: number; at: string }> = [];

  for (const l of escopo) {
    if (l.fase === "perguntou") {
      abertas.set(l.sessao, l);
      continue;
    }

    const aberta = abertas.get(l.sessao);
    if (!aberta) continue;
    abertas.delete(l.sessao);

    pares.push({
      pergunta: aberta.pergunta,
      resposta: l.resposta ?? "",
      espera_s: Math.round((Date.parse(l.at) - Date.parse(aberta.at)) / 1000),
      at: aberta.at,
    });
  }

  if (has("json", args)) {
    console.log(JSON.stringify({ pares, abertas: [...abertas.values()], amostras_ignoradas: descartes.length }, null, 2));
    process.exit(0);
  }

  if (!pares.length) {
    console.log(`${escopo.length} linha(s), nenhum par completo ainda`);
    reportaDescartes(descartes);
    process.exit(0);
  }

  const esperas = pares.map((p) => p.espera_s).sort((a, b) => a - b);
  const pct = (p: number) => esperas[Math.min(esperas.length - 1, Math.floor(esperas.length * p))];

  for (const p of pares.slice(-12)) {
    console.log(
      `  ${p.at.slice(11, 16)}  ${String(p.espera_s).padStart(5)}s  ` +
        `${p.pergunta.slice(0, 46).padEnd(48)}→ ${p.resposta.slice(0, 30)}`,
    );
  }

  // p85, nunca média — é a mesma escolha do agent-runtime, pelo mesmo motivo:
  // a distribuição de espera humana tem cauda longa, e média sobre cauda longa é
  // um número que parece medida e é chute.
  console.log(
    `\n${pares.length} popup(s) · p50 ${pct(0.5)}s · p85 ${pct(0.85)}s · máx ${esperas.at(-1)}s` +
      (abertas.size ? ` · ${abertas.size} sem resposta ainda` : ""),
  );
  reportaDescartes(descartes);
}

// =============================================================================
// claude-session — where did an agent's run actually GO? Decomposes a Claude
// Code session by tool family, straight from the `.jsonl` transcript the CLI
// already writes.
//
// THE SOURCE ALREADY EXISTS — no hook, no new store. Claude Code writes every
// turn to `~/.claude/projects/<slug-do-cwd>/<session>.jsonl`, and the run's
// `input.yaml` already carries the ids that reach it. This is
// META.md#source_already_exists applied to the question "why did that agent
// take half an hour".
//
// WHAT IT ANSWERS, and none of it was answerable before 14/08:
//
//   · how long the PERMISSION GATE held the agent — the silent gap between two
//     tool calls, which no report showed and `espera_s` used to record as zero
//   · how much of the run was writing code vs proving it
//   · when the first WRITE happened — everything before it is startup
//
// Measured on `1206Z-esteira-criar-empresa` the day this was written: browser 29%,
// Bash 28%, gate 18%, and `Edit`+`Write` — the actual code — **18%**.
//
// THE GAP IS ATTRIBUTED, NOT MEASURED. A tool call's cost here is the interval
// until the NEXT one, so thinking time, model latency and a human staring at a
// permission prompt all land on the call that preceded them. That is the honest
// reading and it is why `--calls` exists: a single 333s line is a gate, not work,
// and only the timeline shows which.
// =============================================================================

const PROJECTS = join(homedir(), ".claude/projects");

/** Acha o `.jsonl` da sessão. Duas entradas: o uuid direto, ou o slug do run —
 *  e neste caso o uuid sai do `input.yaml`, que já grava `claude_session_id` e o
 *  `agent_session` de cada agente delegado. */
function acharSessao(args: string[]): { file: string; via: string } {
  const livre = args.filter((a, i, all) => !a.startsWith("--") && !all[i - 1]?.startsWith("--"));

  const uuid = value("session", undefined, args) ?? (livre[0] ? uuidDoRun(livre[0]) : undefined);
  if (!uuid) throw new Error("passe um <run-slug> ou --session <uuid>");
  for (const p of readdirSync(PROJECTS)) {
    const f = join(PROJECTS, p, `${uuid}.jsonl`);
    try {
      statSync(f);
      return { file: f, via: p };
    } catch {}
  }
  // O project dir é indexado pelo CWD de quem rodou, então um agente de worktree
  // NÃO cai no diretório do repo pai — foi o que confundiu a busca em 14/08.
  throw new Error(`sessão ${uuid} não achada em ${PROJECTS}/*/`);
}

function uuidDoRun(slug: string): string | undefined {
  // A fonte era `_events/<slug>/input.yaml`, e a pasta morreu em 17/08. Agora é o
  // `input.yaml` do RUN, que é onde o `001_user_prompt` já escrevia a sessão.
  const run = index().find((r) => r.run === slug || r.run.startsWith(slug));
  if (!run) throw new Error(`run ${slug} não achado — \`my runs\` lista os que existem`);
  const s = readFileSync(join(ME, run.path, "input.yaml"), "utf8");
  // `agent_session` primeiro: num run com agente delegado, é ELE que interessa —
  // o `claude_session_id` é do coordenador, que não é quem se quer medir.
  const uuid =
    s.match(/^\s*agent_session:\s*([0-9a-f-]{36})/m)?.[1] ??
    s.match(/^\s*claude_session_id:\s*([0-9a-f-]{36})/m)?.[1];
  // Achar o run e não achar a sessão é um caso DIFERENTE de não passar argumento, e
  // dizia a mesma frase: "passe um <run-slug>", pra quem tinha acabado de passar um.
  // Medido 19/08: NENHUM `input.yaml` em disco carrega os dois campos, então este é o
  // caminho normal deste subcomando hoje, não a exceção.
  if (!uuid) throw new Error(`run ${run.run} não grava sessão no input.yaml — passe --session <uuid>`);
  return uuid;
}

type Call = { t: Date; nome: string; input: string };

function claudeSession(args: string[]): void {

  /** Quantas chamadas da linha do tempo imprimir. O default mostra o arranque, que
   *  é onde o portão de permissão aparece como um buraco entre dois números. */
  const CALLS = Number(value("calls", undefined, args) ?? 12);

  const { file, via } = acharSessao(args);
  const calls: Call[] = [];
  const descartes: string[] = [];
  for (const linha of readFileSync(file, "utf8").split("\n")) {
    if (!linha.trim()) continue;
    let d: any;
    try {
      d = JSON.parse(linha);
    } catch (e) {
      // linha truncada no fim do arquivo enquanto a sessão ainda escreve
      descartes.push(`${file}: linha ilegível (${(e as Error).message})`);
      continue;
    }
    if (!d.timestamp) continue;
    for (const c of d.message?.content ?? []) {
      if (c?.type === "tool_use") calls.push({ t: new Date(d.timestamp), nome: c.name, input: JSON.stringify(c.input ?? {}) });
    }
  }
  if (!calls.length) throw new Error(`nenhuma tool call em ${file}`);

  const t0 = calls[0].t.getTime();
  const tN = calls[calls.length - 1].t.getTime();
  const total = (tN - t0) / 1000;

  /** Família, não nome: 12 verbos de browser são UMA decisão de desenho, e listar
   *  cada um esconde o total atrás de uma cauda de linhas de 0,1 min. */
  const familia = (n: string) =>
    n.startsWith("mcp__claude-in-chrome") ? "browser" : n.startsWith("mcp__") ? `mcp:${n.split("__")[1]}` : n;

  const ESCRITA = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
  const seg = new Map<string, number>();
  const cnt = new Map<string, number>();
  let maiorBuraco = { s: 0, depois: "", em: 0 };

  for (let i = 0; i < calls.length; i++) {
    const d = i + 1 < calls.length ? (calls[i + 1].t.getTime() - calls[i].t.getTime()) / 1000 : 0;
    const f = familia(calls[i].nome);
    seg.set(f, (seg.get(f) ?? 0) + d);
    cnt.set(f, (cnt.get(f) ?? 0) + 1);
    if (d > maiorBuraco.s) maiorBuraco = { s: d, depois: calls[i].nome, em: (calls[i].t.getTime() - t0) / 1000 };
  }

  const iEscrita = calls.findIndex((c) => ESCRITA.has(c.nome));
  const arranque = iEscrita > -1 ? (calls[iEscrita].t.getTime() - t0) / 1000 : null;
  const min = (s: number) => (s / 60).toFixed(1);

  if (has("json", args)) {
    console.log(
      JSON.stringify(
        {
          sessao: file.split("/").pop()?.replace(".jsonl", ""),
          project_dir: via,
          total_s: Math.round(total),
          calls: calls.length,
          familias: Object.fromEntries([...seg].map(([f, s]) => [f, { calls: cnt.get(f), s: Math.round(s) }])),
          arranque_s: arranque === null ? null : Math.round(arranque),
          maior_buraco: { s: Math.round(maiorBuraco.s), depois: maiorBuraco.depois, em_s: Math.round(maiorBuraco.em) },
          amostras_ignoradas: descartes.length,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`sessão ${file.split("/").pop()?.replace(".jsonl", "")}  ·  ${via}`);
    console.log(`${min(total)} min · ${calls.length} tool calls\n`);

    console.log(`${"família".padEnd(22)}${"calls".padStart(7)}${"min".padStart(8)}${"%".padStart(6)}`);
    for (const [f, s] of [...seg].sort((a, b) => b[1] - a[1]))
      console.log(`${f.padEnd(22)}${String(cnt.get(f)).padStart(7)}${min(s).padStart(8)}${`${Math.round((100 * s) / total)}%`.padStart(6)}`);

    if (arranque !== null)
      console.log(
        `\nprimeira ESCRITA em +${min(arranque)} min (${Math.round((100 * arranque) / total)}% do run), ` +
          `depois de ${iEscrita} calls de leitura`,
      );

    // O buraco é o achado que motivou o script: 333s entre dois `Read` num run em
    // que ninguém tinha percebido espera nenhuma.
    console.log(
      `maior BURACO: ${maiorBuraco.s.toFixed(0)}s (${min(maiorBuraco.s)} min) logo após ` +
        `\`${maiorBuraco.depois}\`, em +${min(maiorBuraco.em)} min`,
    );
    if (maiorBuraco.s > 60)
      console.log(`  ⚠ buraco de mais de 1 min entre duas calls é portão de permissão ou espera humana, não trabalho`);

    console.log(`\nas ${CALLS} primeiras — o arranque:`);
    for (const c of calls.slice(0, CALLS)) {
      const d = ((c.t.getTime() - t0) / 1000).toFixed(0);
      console.log(`  +${d.padStart(5)}s  ${familia(c.nome).padEnd(12)}  ${c.input.slice(0, 58)}`);
    }

    reportaDescartes(descartes);
  }
}

// =============================================================================
// dispatch
// =============================================================================

if (import.meta.main) {
  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    case "task-runtime": taskRuntime(rest); break;
    case "askuser": askuser(rest); break;
    case "claude-session": claudeSession(rest); break;
    default:
      console.error("uso: metrics.ts <task-runtime|askuser|claude-session> [args]");
      process.exit(1);
  }
}
