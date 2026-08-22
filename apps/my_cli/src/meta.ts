#!/usr/bin/env bun
//! Reads a process out of @META.md and prints it. Nothing else.
//!
//! @META.md — the four processes, the rules and the concepts this prints
//! @CONTEXT.md — how the house uses them
//!
//! WHY THIS EXISTS. META.md is 1300+ lines and an agent needs ONE of them.
//! Pasting the whole file into a prompt costs everything it is not running;
//! telling the agent "read lines 45-128" rots the moment a rule is inserted
//! above. This resolves the section by its HEADING, which survives edits the
//! way a line number does not.
//!
//! WHY IT IS NOT A SECOND SOURCE. It parses META.md and prints it verbatim. It
//! holds no copy, no summary and no rule of its own — delete this file and the
//! system still works, you just paste more. The rule that used to say "a script
//! may READ the process, never BE it" fell on 16/08 (`my meta design
//! script_crossed_the_line`); what still holds for THIS file is narrower and
//! sharper: it decides nothing. See #markdown_is_the_database.
//!
//! `my meta resources meta_cli` is the whole verb list, and it is the one that
//! stays current — a copy here would be the fourth hand-kept list this repo
//! deleted today. The two worth knowing without a fetch:
//!
//!   bun run src/meta.ts                 everything by name
//!   bun run src/meta.ts --check         exit 1 when a citation is dead
//!
//! A process is short and its tasks cite resources as `#underscore_case`. That
//! is the whole reason resources are addressable: an agent reads one process,
//! sees `#worktree_and_staging`, and fetches exactly that — instead of carrying
//! nine rules it will not use.
//!
//! Exit 1 on an unknown slug, with the valid ones on stderr — an agent that
//! guessed wrong finds out immediately instead of getting an empty prompt.
//!
//! COMO ESTE ARQUIVO ESTÁ ARRUMADO, e o VS Code dobra cada bloco (`//#region`):
//!
//!   1 · os campos, e o parsing do markdown   funções puras, sem I/O
//!   2 · o registro de busca                  quem grava e quem conta
//!   3 · o modelo                             a classe LLM
//!   4 · busca lexical, sem índice            headingAt + rg
//!   5 · as runs                              readRun · board · plan
//!   6 · decorators                           @verb
//!   7 · use-cases: o CLI                     class Cli, um método por verbo
//!
//! A ordem é de DENTRO PRA FORA: o que não conhece ninguém vem primeiro, o que
//! conhece todo mundo vem por último. Os use-cases no fim são a borda — quem
//! quer entender o que este arquivo SABE lê de cima, quem quer saber o que ele
//! FAZ pula pro fim.

import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { read as readRunFolder } from "./runs.ts";
import { espelho1000, resolvePorPrefixo } from "./shared/resolve.ts";
import { home } from "./shared/file.ts";

const ROOT = home();
const META = join(ROOT, "META.md");
/** One rule per file, filed by TYPE: `03_resources/rules/<type>/<slug>.md`. */
const RULES = join(ROOT, "03_resources", "rules");
/** One process per folder: `03_resources/00_company/<stream|shared_workflows>/…/CONTEXT.md`. */
const WORKFLOWS = join(ROOT, "03_resources", "00_company");

type Section = { slug: string; title: string; body: string };

//#region  ── 1 · os campos, e o parsing do markdown ───────────────────────

/**
 * The line right under the `## heading`, capped at 7 words. It is WRITTEN, not
 * derived: deriving it from the first prose line produced "references:" for
 * anchored_references and "cycle:" for cycle_cost — the opening line of half the
 * resources is a code fence, and a heuristic that guesses wrong on eight of
 * seventeen is not a description, it is noise with a field name.
 * SERVES: #markdown_is_the_database
 */
export function description(body: string, words = 7): string {
  const line = body.split("\n").slice(1).find((l) => l.trim());
  if (!line || /^(STATUS|TYPE|TAGS):/.test(line)) return "";
  const w = line.replace(/[`*]/g, "").trim().split(/\s+/);
  return w.slice(0, words).join(" ");
}

/** `TYPE: execution` — the family a resource belongs to. Written, like STATUS. */
export function type(body: string): string {
  return body.split("\n").find((l) => l.startsWith("TYPE:"))?.slice(5).trim() ?? "outro";
}

/**
 * `TAGS: git, agents` — what a resource is ABOUT, across families.
 *
 * TYPE answers "which process owns this" and every resource has exactly one.
 * TAGS answer "what does this protect", and the useful ones cut ACROSS types:
 * `git` reaches an execution rule and an interview rule; `drift` reaches a
 * planning rule and a measure rule. A tag that only ever repeats its TYPE
 * (`execution`) buys nothing — the field already answers that.
 *
 * A tag with one member is a tag waiting to die: it cannot group anything.
 * `--tag` prints the count so that is visible instead of assumed.
 * SERVES: #markdown_is_the_database
 */
export function tags(body: string): string[] {
  const line = body.split("\n").find((l) => l.startsWith("TAGS:"))?.slice(5) ?? "";
  return line.split(",").map((t) => t.trim()).filter(Boolean);
}

/**
 * `CODE: meta.ts#readRun` — the function that serves this rule, if one does.
 *
 * The other half of the pointer lives in that function's docstring as
 * `SERVES: #slug`. Both directions are written by hand and `--check` proves they
 * agree — a cross-file pointer with nobody checking it is #anchored_references
 * happening between two files instead of inside one.
 *
 * Most rules have no code and say nothing. A rule the reader cannot serve is not
 * a defect: `#callstack_notation` is a form for humans, and inventing a function
 * to make the field non-empty would be the tail wagging the dog.
 *
 * SERVES: #markdown_is_the_database
 */
export function code(body: string): string[] {
  const line = body.split("\n").find((l) => l.startsWith("CODE:"))?.slice(5) ?? "";
  return line.split(",").map((t) => t.trim()).filter(Boolean);
}

/**
 * `exercised (runs 001, 002)` -> {status: "exercised", detail: "runs 001, 002"}.
 * Anything that is not exactly `exercised` or `untested` at the head is `partial` —
 * `worktree_and_staging` says "exercised in part", and flattening that into
 * `exercised` is how a half-true rule starts looking whole.
 */
export function status(body: string): { status: "exercised" | "partial" | "untested"; detail: string } {
  const line = body.split("\n").find((l) => l.startsWith("STATUS:"))?.slice(7).trim() ?? "";
  const detail = line.replace(/^(exercised|untested)\s*/, "").replace(/^\((.*)\)$/, "$1").trim();
  if (line.startsWith("untested")) return { status: "untested", detail };
  if (/^exercised\s*\(/.test(line)) return { status: "exercised", detail };
  if (line.startsWith("exercised")) return { status: "partial", detail };
  return { status: "untested", detail: line };
}

/** Splits on headings of one depth, skipping anything inside a fenced block. */
function split(lines: string[], depth: 1 | 2): { title: string; body: string }[] {
  const marker = "#".repeat(depth) + " ";
  const starts: number[] = [];
  let fenced = false;

  lines.forEach((line, i) => {
    // A `# ` inside a fence is shell prose, not a heading. Missing this is how
    // naive splitters cut a file in half at a bash comment.
    if (line.startsWith("```")) fenced = !fenced;
    else if (!fenced && line.startsWith(marker) && line[depth + 1] !== "#") starts.push(i);
  });

  return starts.map((start, i) => ({
    title: lines[start].slice(depth + 1).trim(),
    body: lines.slice(start, starts[i + 1] ?? lines.length).join("\n").trimEnd(),
  }));
}

/**
 * Splits META.md on `# `. The first block is the header; `# Resources` and
 * `# Design` are pulled out by name and split again on `## `, and whatever is
 * left is a process.
 *
 * TWO SHELVES, NOT ONE, and the difference is what each answers. A resource is a
 * RULE a process follows — it is cited from inside a task and it constrains the
 * next cycle. A design concept is a DECISION already taken and already built: it
 * explains why the house is shaped the way it is, and nothing cites it to obey
 * it. Merging them would put "what you must do" and "why this exists" behind the
 * same verb, and the agent fetching a rule would pay for the essay.
 */
export function parse(md: string): {
  header: string;
  sections: Section[];
  resources: Section[];
  design: Section[];
} {
  const blocks = split(md.split("\n"), 1);
  const [header, ...rest] = blocks;

  const named = (t: string) => rest.find((b) => b.title.toLowerCase() === t);
  const resourcesBlock = named("resources");
  const designBlock = named("design");
  const processes = rest.filter((b) => b !== resourcesBlock && b !== designBlock);

  // Headings on both shelves are already underscore_case in the file — the name
  // IS the slug, because tasks cite it verbatim as `#worktree_and_staging`. Any
  // transform here would let the citation and the lookup drift apart.
  const shelf = (b?: { body: string }) =>
    b ? split(b.body.split("\n"), 2).map((s) => ({ ...s, slug: s.title })) : [];

  return {
    header: header?.body ?? "",
    sections: processes.map((b) => ({ ...b, slug: slugify(b.title) })),
    resources: shelf(resourcesBlock),
    design: shelf(designBlock),
  };
}

/**
 * The processes, one folder each: `03_resources/00_company/<stream|shared_workflows>/…/CONTEXT.md`.
 *
 * They left META.md on 17/08 for the reason the rules did, plus one the rules did
 * not have: a process OWNS things — its runs land in `output/` beside it, and a
 * process that is a heading inside a shared file has nowhere to put them.
 *
 * The NUMBER is the order and the FOLDER is the domain; the slug still comes from
 * the heading, so `just meta gen` resolves exactly as it did when the heading was
 * `# 2. Generate Sprints`.
 */
export function readProcesses(dir = WORKFLOWS): Section[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    // `00_product/<NN>_<verb>/CONTEXT.md`, e SÓ isso. O `CONTEXT.md` do domínio
    // é o MAPA dos processos, não um processo — sem o número no penúltimo nível
    // ele entrava na lista como um quinto. E o domínio é `00_product` pelo nome:
    // `01_engineering/` e `02_system/` também casam `<NN>_<verb>/CONTEXT.md`, mas
    // abrem com frontmatter e nenhum `# ` na primeira linha — onze slugs vazios
    // em `--- list`, medido em 17/08, no dia em que os steps entraram na pasta.
    // Eles são achados pelo mapa, não por `just meta`.
    .filter((f): f is string => typeof f === "string" && /^00_product\/\d+_[^/]+\/CONTEXT\.md$/.test(f))
    .sort()
    .map((f) => {
      const body = readFileSync(join(dir, f), "utf8").trimEnd();
      const title = body.split("\n")[0].replace(/^#\s*/, "").trim();
      return { slug: slugify(title), title, body };
    });
}

/**
 * The rules, one file each: `03_resources/rules/<type>/<slug>.md`.
 *
 * THEY LEFT META.md ON 17/08. A task cites `#worktree_and_staging` and an agent
 * needs that ONE rule; 1400 lines of them sat inside the file every read parses,
 * so the cheapest fetch in the house paid for all 38. The four processes stayed —
 * they are read whole, and they are what the header is about.
 *
 * THE FOLDER IS THE TYPE. `TYPE: execution` still lives inside the file because
 * `type()` reads it and the views print it; the folder mirrors it so `ls` answers
 * "what families of rule exist" without opening anything. Two places to say one
 * thing is drift waiting to happen — `check/rules.ts` is what makes it a failing
 * check instead of a surprise.
 *
 * The FILE NAME is the slug, verbatim, for the same reason the heading was: the
 * citation is typed by hand and the lookup must land on it with no transform.
 */
export function readResources(dir = RULES): Section[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .filter((f): f is string => typeof f === "string" && f.endsWith(".md"))
    .sort()
    .map((f) => {
      const slug = f.slice(f.lastIndexOf("/") + 1, -3);
      return { slug, title: slug, body: readFileSync(join(dir, f), "utf8").trimEnd() };
    });
}

/** `BUILT: src/vscode/regen.ts` — what a design concept turned into.
 *
 *  It is the field that lets the design DOC die. A concept with nothing built is
 *  still an idea and belongs in a `02_areas/design/` file being argued over; one with a
 *  path here has already landed, and keeping the doc alive beside the code is
 *  the second source `#markdown_is_the_database` exists to refuse.
 *  SERVES: #design_folds_into_meta */
export function built(body: string): string[] {
  const line = body.split("\n").find((l) => l.startsWith("BUILT:"))?.slice(6) ?? "";
  return line.split("·").map((t) => t.trim()).filter(Boolean);
}

/**
 * `# 2. Generate Sprints` -> `generate-sprints`. The ordinal is position, not
 * identity, so it goes; the VERB stays. Dropping it collapsed "Generate Sprints"
 * and "Do Sprints" onto the same slug, and `just meta sprints` silently ran the
 * wrong process. Prefix matching is what keeps it short at the keyboard:
 * `just meta gen`, `just meta do`.
 */
export function slugify(title: string): string {
  return title
    .replace(/^\d+\.\s*/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The `## Input` / `## Tasks` / `## Output` blocks of a process, and for each task
 * the resources it cites. This is what a view draws: the rail exists to show which
 * rule each step pulls, and that edge lives nowhere but the `#name` inside the task.
 */
export function anatomy(body: string) {
  const lines = body.split("\n");
  const part = (name: string) =>
    split(lines, 2).find((b) => b.title === name)?.body.split("\n").slice(1) ?? [];
  const bullets = (ls: string[]) =>
    ls.join("\n").split(/\n(?=[-\d])/).map((t) => t.trim()).filter(Boolean);
  const flat = (t: string) => t.replace(/^(-|\d+\.)\s*/, "").replace(/\s+/g, " ").trim();

  return {
    input: bullets(part("Input")).map(flat),
    tasks: bullets(part("Tasks")).map((t) => ({
      // The citation is stripped from the text and kept as an edge. Leaving it
      // inline would make the view render the same fact twice.
      text: flat(t).replace(/\s*—?\s*#[a-z_]+(\s*·\s*(and pass `isolation` for real —\s*)?#[a-z_]+)*\s*$/, ""),
      cites: [...t.matchAll(/#([a-z][a-z0-9_]+)/g)].map((m) => m[1]),
    })),
    output: bullets(part("Output")).map(flat),
  };
}

/** Exact match first, prefix second — so `do` reaches `do-sprints` at the keyboard. */
function find(pool: Section[], wanted: string): Section | undefined {
  return pool.find((s) => s.slug === wanted) ?? pool.find((s) => s.slug.startsWith(wanted));
}

//#endregion

//#region  ── 2 · o registro de busca ──────────────────────────────────────

/**
 * Every fetch, appended as one TSV line: `<iso>\t<verb>\t<term>\t<hit>`.
 *
 * WHY LOG THE HITS TOO, when the misses carry the signal. A miss says someone
 * reached for a word this file does not have. A hit says which rules are
 * actually pulled — and the opposite of that is the question nobody can answer
 * today: seven resources are `untested`, and there is no way to tell whether
 * that is "no cycle ran it" or "nobody ever looks it up". Two different repairs.
 *
 * TSV AND NOT JSONL because the record is four fixed fields and will never
 * nest, `cut -f3 | sort | uniq -c` answers most questions without a parser, and
 * the house already keeps its agent bus in append-only TSV — reusing the shape
 * beats inventing a second one.
 *
 * IT IS NOT VERSIONED, and that is the same line #source_already_exists draws:
 * a high-frequency raw source stays local, and what earns a commit is what a
 * reader extracted from it — here `vocabulary.yaml`. Committing one line per
 * `just resources` would put the history to work describing its own reads.
 *
 * NEVER THROWS. A lookup that fails because logging failed would be the
 * telemetry breaking the thing it measures.
 */
// Derived from META's own path, not from `ROOT`: `ROOT` is declared further down
// for the runs half of this file, and reaching it here would be a TDZ error at
// module load — the kind that only shows up when someone runs the CLI.
const LOOKUPS = join(dirname(META), ".meta-lookups.tsv");

/** SERVES: #lookup_log */
function logLookup(verb: string, term: string, hit: boolean): void {
  try {
    const clean = (s: string) => s.replace(/[\t\n]/g, " ").slice(0, 120);
    appendFileSync(LOOKUPS, `${new Date().toISOString()}\t${verb}\t${clean(term)}\t${hit ? 1 : 0}\n`);
  } catch {
    /* telemetry never breaks the read */
  }
}

type Lookup = { at: string; verb: string; term: string; hit: boolean };

function readLookups(): Lookup[] {
  if (!existsSync(LOOKUPS)) return [];
  return readFileSync(LOOKUPS, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("\t"))
    .filter((f) => f.length >= 4)
    .map(([at, verb, term, hit]) => ({ at, verb, term, hit: hit === "1" }));
}

//#endregion

//#region  ── 3 · o modelo ─────────────────────────────────────────────────

/**
 * O cliente do kimi coding plan, cru: um `fetch`, sem SDK.
 *
 * A CHAVE NUNCA ENTRA NESTE ARQUIVO. Ela é lida de `~/kimi_token` no momento da
 * chamada, e não existe caminho por onde ela saia daqui — não vai pro
 * `.meta-lookups.tsv`, não vai pro erro, não vai pro commit. Um segredo em
 * código é um segredo no git para sempre, e `git rm` não desfaz isso.
 *
 * A BASE FOI MEDIDA, não adivinhada. Cinco endpoints da Moonshot devolveram 401
 * em 16/08 — `api.moonshot.ai` e `.cn`, nos dois contratos — porque esta chave
 * não é da Moonshot: prefixo `sk-kimi-`, 72 caracteres, coding plan da
 * `api.kimi.com`. O que respondeu 200 foi `/coding/v1/chat/completions`, e é
 * OpenAI-compat, não Anthropic-compat: `/coding/anthropic/v1/messages` deu 404.
 *
 * `KIMI_BASE` sobrepõe, porque plano muda de host e um host chumbado no código é
 * a próxima coisa a mentir.
 * SERVES: #llm_reads_its_key
 */
export class LLM {
  constructor(
    readonly model = "kimi-k2-turbo-preview",
    readonly base = process.env.KIMI_BASE ?? "https://api.kimi.com/coding/v1",
  ) {}

  /** Lida em runtime, a cada chamada. Nunca guardada, nunca impressa. */
  private key(): string {
    const p = join(process.env.HOME ?? "~", "kimi_token");
    if (!existsSync(p)) throw new Error(`sem chave em ${p}`);
    return readFileSync(p, "utf8").trim();
  }

  async ask(prompt: string, maxTokens = 800): Promise<string> {
    const r = await fetch(`${this.base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.key()}` },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      // O corpo do erro entra; o header de autorização NÃO — é onde a chave
      // vazaria se alguém colasse o erro num issue.
      throw new Error(`${this.base}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    const j = (await r.json()) as {
      choices?: { message?: { content?: string; reasoning_content?: string }; finish_reason?: string }[];
    };
    const c = j.choices?.[0];
    // MODELO DE RACIOCÍNIO: o `kimi-k2-turbo-preview` gasta orçamento em
    // `reasoning_content` e só depois escreve `content`. Medido em 16/08: com
    // `max_tokens: 60` ele voltou `content: ""`, `finish_reason: "length"` e 60
    // tokens inteiros de raciocínio — a chamada "funcionou", devolveu vazio, e
    // o vazio virou um `rg ""` que casa o arquivo inteiro. Um truncamento que
    // não estoura é pior que um erro; então ele estoura aqui.
    if (c?.finish_reason === "length" && !c?.message?.content?.trim())
      throw new Error(`resposta truncada em max_tokens=${maxTokens}: o raciocínio comeu o orçamento`);
    return c?.message?.content?.trim() ?? "";
  }
}

//#endregion

//#region  ── 4 · busca lexical, sem índice ────────────────────────────────

/**
 * Qual seção contém cada linha do arquivo — `linha -> slug`, construído uma vez.
 *
 * É o que transforma um match de `rg` em ENDEREÇO. Sem isto a busca devolve
 * "linha 764", que é exatamente o tipo de ponteiro que #anchored_references
 * proíbe: verdadeiro por alguns minutos. Com isto ela devolve
 * `#worktree_and_staging`, e quem quiser o resto chama `just resources` nele.
 * SERVES: #grep_before_embeddings
 */
export function headingAt(md: string): string[] {
  const linhas = md.split("\n");
  const dono: string[] = [];
  let bloco = "";       // o `# `: um processo, ou `Resources`/`Design`
  let secao = "";       // o `## ` de dentro dele
  let prateleira = false;
  let fenced = false;

  for (const l of linhas) {
    // A mesma armadilha do `split()`: um `## ` dentro de cerca é prosa de shell,
    // não heading. Errar isto faz metade do arquivo pertencer a uma seção que
    // não existe.
    if (l.startsWith("```")) fenced = !fenced;
    else if (!fenced && l.startsWith("## ")) secao = l.slice(3).trim();
    else if (!fenced && l.startsWith("# ")) {
      bloco = l.slice(2).trim();
      secao = "";
      prateleira = /^(resources|design)$/i.test(bloco);
    }
    // O ENDEREÇO É O QUE UM COMANDO ACEITA, e é por isso que a regra depende do
    // bloco. Dentro de `# Resources` e `# Design`, o `## ` É o slug — vai direto
    // pro `just resources <slug>`. Dentro de um PROCESSO, o `## ` é `Tasks` ou
    // `Output`, que não abre nada: ali o endereço é o processo inteiro, que se
    // busca por `just meta do-sprints`. Devolver `#Tasks` seria dar um ponteiro
    // que não resolve, exatamente o que esta função existe pra evitar.
    dono.push(prateleira ? secao : slugify(bloco));
  }
  return dono;
}

/**
 * `rg` no META.md, agrupado pela seção que contém cada match.
 *
 * QUEM PROCURA É O RIPGREP, e isso é a escolha, não um detalhe: a alternativa
 * era um `.match()` em JS sobre o arquivo inteiro, que é reimplementar
 * devagar o que uma ferramenta afiada já faz — e perder `-i`, alternância,
 * classe de caractere e tudo o mais que quem escreve o padrão já sabe usar.
 * Aqui o MODELO decide o que procurar; a recuperação é determinística e burra.
 *
 * NÃO HÁ ÍNDICE, e é por isso que isto sobrevive ao arquivo mudar. Embedding e
 * vector DB pagariam por semântica que este arquivo não precisa: ele é escrito
 * com o vocabulário da casa, e quem busca é um agente que acabou de ler o
 * vocabulário. O que faltava não era entender a pergunta, era não ter que
 * carregar 22.851 tokens pra responder.
 *
 * Devolve o ENDEREÇO, não a seção inteira: o chamador decide o que abrir.
 * SERVES: #grep_before_embeddings
 */
export function grep(pattern: string, contexto = 0) {
  // Cinto no LUGAR CERTO: quem chama pode errar, e `rg ""` casando o arquivo
  // inteiro é a falha que não se anuncia — ela devolve resultado.
  if (!pattern.trim()) throw new Error("grep: padrão vazio casaria o arquivo inteiro");
  const r = Bun.spawnSync(["rg", "-n", "-i", "-e", pattern, META]);
  if (r.exitCode === 2)
    throw new Error(`rg falhou: ${r.stderr.toString().trim() || "sem stderr"}`);

  const dono = headingAt(readFileSync(META, "utf8"));
  const por = new Map<string, { linha: number; texto: string }[]>();
  for (const l of r.stdout.toString().split("\n").filter(Boolean)) {
    const m = /^(\d+):(.*)$/.exec(l);
    if (!m) continue;
    const n = Number(m[1]);
    // `dono` é 0-based, `rg` conta a partir de 1.
    const slug = dono[n - 1] || "(cabeçalho)";
    por.set(slug, [...(por.get(slug) ?? []), { linha: n, texto: m[2].trim().slice(0, 100) }]);
  }
  return [...por].map(([slug, hits]) => ({ slug, hits: hits.slice(0, contexto || 3), total: hits.length }));
}

/**
 * What the vocabulary is missing, counted from what people actually typed.
 *
 * A term searched and never found, more than once, is a REQUEST FOR A RULE —
 * not a typo. The house names things once and cites them forever, so the second
 * person reaching for the same absent word is evidence that the word is the
 * house's and the rule is not written yet.
 *
 * `nunca_buscado` is the other half and the cheaper one to act on: a resource
 * nobody has ever fetched is either dead weight or badly named, and the file
 * cannot tell you which — but it can tell you it happened.
 * SERVES: #lookup_log
 */
export function terms(resources: Section[], design: Section[]) {
  const rows = readLookups();
  const byTerm = new Map<string, { n: number; hits: number; last: string }>();
  for (const r of rows) {
    const e = byTerm.get(r.term) ?? { n: 0, hits: 0, last: r.at };
    byTerm.set(r.term, { n: e.n + 1, hits: e.hits + (r.hit ? 1 : 0), last: r.at });
  }

  const orfaos = [...byTerm]
    .filter(([, e]) => e.hits === 0)
    .sort((a, b) => b[1].n - a[1].n)
    .map(([term, e]) => ({ term, buscas: e.n, ultima: e.last }));

  const buscados = new Set([...byTerm].filter(([, e]) => e.hits > 0).map(([t]) => t));
  const nunca = [...resources, ...design]
    .map((s) => s.slug)
    .filter((slug) => ![...buscados].some((t) => slug === t || slug.startsWith(t)));

  return { total: rows.length, orfaos, nunca_buscado: nunca };
}

//#endregion

//#region  ── 5 · as runs ──────────────────────────────────────────────────
// The RUNS side. META.md says what the processes are; `_meta/*_run/` is what
// they produced. Both live here for one reason: a view that needs the rules AND
// the runs would otherwise grow a second parser, and a second parser is a second
// truth. Same rule as everything else in this file — it READS, never decides.
// ───────────────────────────────────────────────────────────────────────────

/** A run folder: `NNN_<type>_<slug>`. The NUMBER is the identity — the type and
 *  the slug are there for whoever is reading `ls`, and they change when a run is
 *  renamed. Resolving by prefix is what keeps a citation alive across a rename.
 *
 *  SERVES: #run_folder_name */
const RUN_DIR = /^\d{3}_/;

/**
 * Every run on disk: folder name → path relative to the repo root.
 *
 * A run lands in the `output/` of the process that OPENED it — the interview that
 * started it, or the research that answered the question — and the later processes
 * write into that same folder. `_meta/` was the single bucket until 17/08; the
 * folder name still carries the number, and the number is still the identity, so
 * nothing that cites a run had to change.
 *
 * SERVES: #run_folder_name #where_work_lands
 */
function runIndex(): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(WORKFLOWS)) return out;
  for (const rel of readdirSync(WORKFLOWS, { recursive: true })) {
    if (typeof rel !== "string") continue;
    const m = rel.match(/^(.*\/output)\/(\d{3}_[^/]+)$/);
    if (m && statSync(join(WORKFLOWS, rel)).isDirectory()) {
      out.set(m[2], join("03_resources", "00_company", rel));
    }
  }
  return new Map([...out].sort(([a], [b]) => a.localeCompare(b)));
}

/** O main que roda a run — `01_coding`, `02_product`, … — tirado do caminho.
 *  `runs.read` recebe como rótulo; nada aqui depende dele para achar arquivo. */
function mainOf(rel: string): string {
  return rel.match(/00_main\/([^/]+)\//)?.[1] ?? rel.split("/").at(-3) ?? "";
}

/** `S3` → 3, `sprint_003` → 3, `tasks` → undefined. O dialeto PASTA não numera
 *  sprint (a pasta é UM pacote), e aí quem numera é a posição na lista. */
function numeroDaSprint(id: string): number | undefined {
  const n = id.match(/\d+/);
  return n ? Number(n[0]) : undefined;
}

/** Repo-relative path of one run — the form `git` wants. */
function runRel(dir: string): string {
  const hit = runIndex().get(dir);
  if (!hit) throw new Error(`run "${dir}" não está no disco`);
  return hit;
}

/** `003` · `3` · `003_metrics_morre` all reach the same folder. */
export function resolveRun(id: string): string | undefined {
  const all = [...runIndex().keys()].filter((d) => RUN_DIR.test(d));
  // AMBÍGUO É ERRO, não sorteio. Cada workflow numera pra baixo desde 999 por
  // conta própria, então o mesmo número existe em famílias diferentes: em 17/08
  // `997` casava `997_metrics_morre` (product) e `997_curto_vs_livre`
  // (experimental), e o `find` devolvia o primeiro do `readdir` — que é ordem de
  // disco, não escolha de ninguém. Mesma correção que o `workflows/tree.ts`
  // levou no mesmo dia, e pelo mesmo motivo: pedir um e trabalhar no outro por
  // meia hora custa mais que uma mensagem de erro — e é por ter sido escrita
  // duas vezes que ela virou `shared/resolve.ts`.
  const achado = resolvePorPrefixo(all, id.replace(/_run$/, ""), (d) => d, { oQue: "runs", dica: () => " — use o nome inteiro" });
  if (achado && "erro" in achado) throw new Error(achado.erro);
  return achado?.hit;
}

/**
 * Everything a view needs about one run, from the disk it already has.
 *
 * A run older than the interview/sprints split keeps it all in `output.yaml`, so
 * this reads EVERY yaml in the folder and merges. Migrating those files instead
 * would rewrite history to fit a rule that did not exist when they were written.
 * SERVES: #run_state_pointer #receipt_on_disk #proof_per_task #estimate_becomes_measurement #declared_deviation
 */
export function readRun(dir: string) {
  const path = join(ROOT, runRel(dir));
  const files = readdirSync(path).filter((f) => f.endsWith(".yaml"));
  const docs = files.map((f) => {
    try {
      return (Bun.YAML.parse(readFileSync(join(path, f), "utf8")) ?? {}) as Record<string, any>;
    } catch {
      return {};
    }
  });
  const merged = Object.assign({}, ...docs) as Record<string, any>;

  // DELEGADO a `runs.read`, e isso é o conserto de um bug medido: este bloco
  // entendia UM dialeto (`sprint_001:` como chave de topo) e o disco tem três.
  // Nove runs e 128 tasks voltavam como `sprints: []` — calado, porque lista
  // vazia é uma resposta legítima ("nada planejado"). O header de `runs.ts` já
  // descrevia o estrago: zero sprint vira "toda task já tem commit", e o ciclo
  // reporta sucesso sem subir um agente.
  //
  // Não há ciclo de import: `runs.ts` não importa este arquivo.
  const lido = readRunFolder(path, mainOf(runRel(dir)));

  const sprints = lido.sprints.map((s, i) => ({
    // `sprint_NNN` e não `S1`: o board casa o nome da worktree por esta forma
    // (`sprint_${n.padStart(3,'0')}`) e volta a `S` para exibir. `runs.read`
    // normaliza para `S1`/`tasks`, então a conversão é aqui — na fronteira.
    id: `sprint_${String(numeroDaSprint(s.id) ?? i + 1).padStart(3, "0")}`,
    title: s.title,
    estimated: s.estimated ?? null,
    actual: s.actual ?? null,
    covers: s.covers ?? [],
    waits_for: s.waits_for ?? [],
    tasks: s.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      duration: t.duration ?? null,
      actual: t.actual ?? null,
      // `proof` fica BOOLEANO na leitura da run — quem lista tasks quer saber
      // se existe prova, não qual é. O comando inteiro sai no `plan`, que é
      // quem monta o prompt do agente.
      proof: Boolean(t.proof),
      command: (t.proof ?? "").toString().trim(),
      description: t.description ?? "",
      references: t.references ?? [],
    })),
  }));

  const final = merged.final_understanding ?? merged.entendimento_final ?? {};
  // `receipts` era a contagem de `_events/` dentro do run. A pasta morreu em
  // 17/08 e o campo fica em 0 porque o BOARD ainda tem a coluna; quem diz que uma
  // task terminou é o COMMIT com a etiqueta, que é a única fonte que sobreviveu.
  const receipts = 0;

  return {
    id: dir,
    files,
    // Uncommitted = still open. The state is git's, never a field — that is the
    // whole point of #write_as_it_happens.
    open: !gitTracked(runRel(dir)),
    // `question_verbatim` is what a Research run writes; the other three come
    // from interviews. One chain, because a run has one subject however it
    // was opened — a second field here would be a second answer.
    subject: final.the_sentence ?? final.a_frase ?? merged.request_verbatim ?? merged.question_verbatim ?? "",
    // `repo` viaja junto com `branch` porque uma branch sem o repo dela não
    // localiza nada: quem quer saber se o trabalho foi RECEBIDO precisa dos
    // dois pra rodar o `git branch --merged` no lugar certo.
    pointer: merged.at
      ? {
          at: merged.at,
          next: merged.next ?? null,
          branch: merged.branch ?? null,
          repo: merged.repo ?? null,
          // QUEM assinou o ponteiro. Um `[reconstruido]` foi DEDUZIDO do disco de
          // hoje, e não registrado pelo processo na hora — 001 e 002 são assim.
          // Quem lê precisa poder distinguir: um ponteiro reconstruído carrega a
          // fase, e não carrega o que só o recibo saberia.
          written_by: merged.written_by ?? merged.escrito_por ?? [],
        }
      : null,
    // `projeto:` — o esforço de `01_projects/` que a run serve, ou null. Estava
    // no disco em 12 de 14 runs e NINGUÉM lia; #run_state_pointer previu isso no
    // próprio CEILING e disse o que o tiraria de lá: um quadro perguntando o que
    // está rodando para um projeto. `just meta runs acme` é a pergunta.
    projeto: merged.projeto ?? null,
    deliverables: (final.deliverables ?? final.entregas ?? []).map((d: any) => d?.id).filter(Boolean),
    pending: (merged.pending ?? merged.pendente ?? []).map((p: any) => p?.id).filter(Boolean),
    coverage: merged.coverage ?? merged.cobertura ?? {},
    // Um desvio declarado que só o YAML conhece não é declarado pra ninguém:
    // quem lê `just meta runs` é quem precisa ver que o ciclo saiu da regra.
    // A chave é o NOME do desvio (`worktree:`, `branch:`), o valor é o porquê —
    // #declared_deviation.
    deviations: Object.keys(merged.desvio_do_meta ?? merged.declared_deviations ?? {}),
    sprints,
    receipts,
  };
}

/** SERVES: #write_as_it_happens — open is git's answer, never a field. */
function gitTracked(rel: string): boolean {
  const out = Bun.spawnSync(["git", "ls-files", rel], { cwd: ROOT }).stdout.toString().trim();
  return out.length > 0;
}

/**
 * `4m` · `1h12` · `2d`. Coarse on purpose — a board is read across a room, and
 * the second a task moved is not a decision anyone takes.
 *
 * Vivia dentro de `board()`. Subiu quando `runs` passou a precisar da mesma
 * escala: duas formatações de duração na mesma tela é o leitor tendo que
 * descobrir qual é qual.
 */
export const dur = (ms: number) => {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h${String(min % 60).padStart(2, "0")}` : `${Math.floor(h / 24)}d`;
};

/**
 * Quando cada run abriu, e quanto durou a execução dela — de UMA passada no git.
 *
 * #source_already_exists: nada disto é campo. `abriu` é o commit mais antigo que
 * tocou a pasta da run, que é o mesmo instante que #write_as_it_happens define
 * como início; `ciclo` é a janela dos commits que tocaram a pasta do run, que é
 * quando os agentes estavam rodando. Uma run sem recibo devolve `null` no ciclo,
 * e isso é a verdade: ela nunca executou.
 *
 * UMA CHAMADA, NÃO N. Quinze runs × `git log` seriam quinze processos para
 * desenhar uma tela; o log inteiro de `_meta/` sai numa passada e se agrupa aqui.
 *
 * SERVES: #source_already_exists
 */
export function janelas(): Map<string, { abriu: Date | null; ciclo: number | null }> {
  const out = Bun.spawnSync(
    // `--diff-filter=A`: o instante em que cada arquivo NASCEU, não a última vez
    // que alguém encostou nele. #receipt_on_disk diz que recibo se escreve uma
    // vez e não muda; sem este filtro, uma migração de 16/08 que tocou os
    // recibos da 002 alargava o ciclo dela de minutos para UM DIA — e o número
    // parecia perfeitamente plausível.
    // DOIS caminhos, e o velho fica pra sempre: os runs sairam de `_meta/` em
    // 17/08, e o log de antes disso so existe sob o nome velho.
    ["git", "log", "--format=@%cI", "--name-only", "--diff-filter=A", "--", "_meta/", "03_resources/00_company/"],
    { cwd: ROOT },
  ).stdout.toString();

  const m = new Map<string, { datas: Date[]; recibos: Date[] }>();
  let quando: Date | null = null;
  for (const linha of out.split("\n")) {
    if (linha.startsWith("@")) { quando = new Date(linha.slice(1)); continue; }
    // AGRUPA PELO NÚMERO, NÃO PELO NOME. #run_folder_name: o número é a
    // identidade e a pasta pode ser renomeada à vontade — e nove foram, em
    // 16/08. `git log --follow` NÃO atravessa renomeação de diretório: pelo
    // caminho novo, `_meta/008_interview_acme-mono_quatro_pastas/` começa no commit
    // que renomeou, e a run passa a alegar que abriu às 10:59 de 16/08 quando
    // abriu às 22:34 de 15/08. O histórico antigo está lá, sob `_meta/008_run/`;
    // só o nome mudou. Três dígitos acham os dois.
    const achou = linha.match(/(?:^_meta|\/output)\/(\d{3})[^/]*\/(.*)$/);
    if (!achou || !quando) continue;
    // O NÚMERO VELHO VIRA O NOVO AQUI, e em nenhum outro lugar. A renumeração de
    // 17/08 inverteu a escala (`1000 − n`, run novo no topo), e o log anterior a
    // ela fala sob `_meta/003_…`. Traduzir na leitura é o que mantém a data de
    // abertura de 15/08 ligada à pasta `997_` — sem isso, toda run antiga volta
    // sem `abriu` e sem ciclo, com cara de run que nunca rodou.
    const n = linha.startsWith("_meta/") ? espelho1000(achou[1]!) : achou[1];
    const reg = m.get(n) ?? { datas: [], recibos: [] };
    reg.datas.push(quando);
    // `recibos` nunca mais cresce: `_events/` morreu em 17/08. O array fica
    // porque o formato do board é lido por fora, e um campo que desaparece
    // quebra quem lê — vazio é resposta, ausente é erro.
    m.set(n, reg);
  }

  const r = new Map<string, { abriu: Date | null; ciclo: number | null }>();
  for (const [dir, { datas, recibos }] of m) {
    const min = (ds: Date[]) => new Date(Math.min(...ds.map((d) => +d)));
    const max = (ds: Date[]) => new Date(Math.max(...ds.map((d) => +d)));
    r.set(dir, {
      abriu: datas.length ? min(datas) : null,
      // Um recibo só não é janela — é um instante. `null` diz isso melhor que `0`.
      ciclo: recibos.length > 1 ? +max(recibos) - +min(recibos) : null,
    });
  }
  return r;
}

/**
 * Uma run em uma linha: quando abriu, quanto durou, e o que produziu.
 *
 * A ORDEM DAS COLUNAS É A ORDEM DAS PERGUNTAS. Quem lê uma lista de ciclos
 * pergunta "quando" antes de "quanto", e "quanto" antes de "o quê" — o assunto
 * fica por último porque é o único campo que se entende cortado pela metade.
 *
 * `—` no ciclo não é dado faltando: é uma run que nunca executou, e vale
 * distinguir da que executou em um minuto.
 */
export function linhaRun(r: ReturnType<typeof readRun>, j: Map<string, { abriu: Date | null; ciclo: number | null }>): string {
  const w = j.get(r.id.slice(0, 3));
  const dd = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ` +
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const tasks = r.sprints.reduce((n, s) => n + s.tasks.length, 0);
  return [
    r.id.padEnd(34),
    (w?.abriu ? dd(w.abriu) : "—").padEnd(11),
    (w?.ciclo != null ? dur(w.ciclo) : "—").padStart(5),
    (r.open ? "ABERTO" : "fechado").padEnd(7),
    (r.projeto ?? "—").padEnd(23),
    `${String(tasks).padStart(2)} tasks · ${String(r.receipts).padStart(2)} recibos`,
    r.deviations.length ? `desvio:${r.deviations.length}` : "        ",
    r.subject.slice(0, 40),
  ].join("  ");
}

/* ─────────────────────────────── the board ──────────────────────────────── */

/**
 * Where every task of a run stands, read from the three things that already
 * exist.
 *
 * It DERIVES and does not decide, which is the line @CLAUDE.md draws: the column
 * is a function of a worktree, a file and a commit that something else had to
 * create anyway. Nothing here writes, nothing here fixes, and no task carries a
 * status field — the day one does, this function is the thing to delete.
 *
 * It lives in `meta.ts` because the alternative was measured on 16/08 and is
 * worse: the first composer re-parsed `sprints.yaml` in Python, which is a
 * SECOND reader of a file this one already reads. Two parsers of the same file
 * diverge on the first shape change, and the one nobody runs `--check` against
 * is the one that rots.
 *
 * SERVES: #board_from_git #task_identifier
 */
export function board(dir: string) {
  const run = readRun(dir);
  const repo = run.pointer?.repo
    ? run.pointer.repo.replace(/^~/, process.env.HOME ?? "~")
    : ROOT;

  const git = (cwd: string, ...args: string[]) =>
    Bun.spawnSync(["git", ...args], { cwd }).stdout.toString();

  // `<run>/S<sprint>/T<task>` AND NOTHING ELSE — the identifier is the contract
  // (#task_identifier). Any form without the run is deliberately NOT read.
  //
  // The worktree half of this was fixed on 16/08 morning: `sprint_001T3` carries
  // no run, so five leftovers from 003 lit up run 010's T3 as in progress. The
  // commit half was left carrying the same defect and cost the same afternoon —
  // `[S001/T1]` appears SIX times across the history, from six different runs,
  // so run 012 opened with nine tasks in `done` and never a commit of its own.
  // The tell was on screen the whole time: the age column read `—` on all nine,
  // which this function only prints when a task has neither worktree nor
  // receipt. It had the evidence that nothing had started and said done anyway.
  //
  // A board that guesses which run an identifier belongs to is a board that
  // reports another cycle's work as this one's.
  const ID = /(\d{3})\/S(\d+)\/T(\d+)/;
  const eu = dir.slice(0, 3);
  // A renumeração de 17/08 (999 pra baixo, run novo no topo) deixou 300 commits
  // falando o número VELHO: a `997` de hoje assina `[003/S1/T1]`. Commit não se
  // reescreve, então o leitor é que aceita os dois — `legado` é o mesmo número
  // pelo espelho `1000 − n`, e sem ele o board devolvia TUDO como backlog.
  const legado = espelho1000(eu);
  const key = (r: string, s: string, t: string) =>
    `${eu}_S${String(Number(s)).padStart(3, "0")}_T${Number(t)}`;
  const mine = (m: RegExpMatchArray) => m[1] === eu || m[1] === legado;
  const wt = git(ROOT, "worktree", "list") + git(repo, "worktree", "list");
  const working = new Set<string>();

  // O WORKTREE É DA SPRINT, não da task — #sprint_package. Um agente por sprint
  // corta `<run>/S<sprint>`, sem `/T`, então acender só o que casa com `/T`
  // deixaria a sprint inteira apagada enquanto alguém trabalha nela: o quadro
  // diria "nada começou" com um worktree vivo na tela ao lado.
  //
  // Uma sprint viva acende TODAS as tasks dela, e isso é verdade em vez de
  // aproximação: o agente é um só e está no meio da lista. Qual das quatro ele
  // está fazendo agora, nada no disco sabe — inventar seria o quadro chutando.
  //
  // A forma com `/T` continua lida porque a história tem worktree assim, e o
  // recibo e o commit seguem por task. O que mudou é quem corta a worktree.
  const SPRINT = /(\d{3})\/S(\d+)(?!\/T)/g;
  for (const m of wt.matchAll(SPRINT))
    if (mine(m))
      for (const t of run.sprints.find((s) => s.id === `sprint_${m[2].padStart(3, "0")}`)?.tasks ?? [])
        working.add(key(m[1], m[2], t.id.replace(/\D/g, "")));

  for (const m of wt.matchAll(new RegExp(ID, "g")))
    if (mine(m)) working.add(key(m[1], m[2], m[3]));

  // OS DOIS REPOSITÓRIOS, e não só o do trabalho. Uma task cujo resultado é
  // "conferi, nada a mudar" não tem diff no repo do trabalho — e ela é uma task
  // legítima: a T9 da 010 existia para PROVAR que o SSR ficou de pé. Lendo só o
  // trabalho, ela ficava `in_progress` para sempre, e o quadro passava a mentir
  // sobre uma task que tinha acabado.
  //
  // A ETIQUETA É O CONTRATO; em qual repo ela cai é consequência do que a task
  // tocou. #commit_is_the_report já diz que a task termina num commit em CADA
  // repo que ela mexeu — quando mexeu só no registro, é lá que o commit está.
  const landed = new Set<string>();
  for (const cwd of new Set([repo, ROOT]))
    for (const m of git(cwd, "log", "--format=%s", "-300").matchAll(/\[(\d{3})\/S(\d+)\/T(\d+)\]/g))
      if (mine(m)) landed.add(key(m[1], m[2], m[3]));

  // OS CICLOS ANTERIORES A 16/08 escreveram `[S001/T1]`, sem o run — seis deles,
  // e é a colisão que #task_identifier existe pra fechar. Eles não voltam: um
  // rewrite de history pra consertar a etiqueta custaria mais do que ela vale.
  //
  // O que desambigua sem chutar é o próprio git: um commit que carrega a
  // etiqueta velha E TOCA `_meta/<este run>/` é deste run, porque foi ele que
  // escreveu o recibo. Isso é #source_already_exists — o fato já estava no
  // `--name-only`, e a alternativa era adivinhar por proximidade de data, que é
  // exatamente o que o comentário acima proíbe. Só a forma VELHA passa por aqui;
  // um commit novo sem run continua sem ser lido, senão a regra nova não vale.
  // SEM EXIGIR O COLCHETE, porque o caminho já é o escopo. Metade dos ciclos
  // velhos escreveu o recibo com o subject `chore(010): recibo S003/T6 — …`,
  // sem etiqueta nenhuma; pedir o colchete deixava seis das nove tasks da 010
  // presas em `in_progress`, que é a mentira mais cara das três colunas — diz
  // que existe trabalho em voo que já acabou.
  for (const l of git(ROOT, "log", "--format=%s", "-300", "--", runRel(dir)).split("\n")) {
    const m = /\bS(\d+)\/T(\d+)\b/.exec(l);
    if (m) landed.add(key(eu, m[1], m[2]));
  }

  // O RECIBO MORREU em 17/08 junto com `_events/`: a coluna "recibo" do board
  // media uma pasta que ninguém escrevia — as 10 tasks do lote daquele dia
  // deixaram ZERO. Sobrou o que sempre foi verdade: **a etiqueta no commit** diz
  // que a task terminou, e ela mora no `git log`, que é comum a todos os ciclos.
  const receipts = new Set<string>();

  /* WHEN each task started and ended, from the same three things.
   *
   * `start` is the worktree's directory, because that is the first moment a task
   * exists outside the plan — before the commit. A task with no worktree on disk
   * has no start: the board prints `—` rather than inventing one from the commit.
   * (The receipt used to be the fallback here; it died with `_events/` on 17/08.)
   * A cycle time measured from its own end is a zero wearing a number's clothes.
   *
   * `end` is the commit that carries the tag — #commit_is_the_report already made
   * that the moment a task is over. */
  // `git worktree list` prints `<path> <sha> [branch]` on one line. The porcelain
  // form starts each record with `worktree <path>`, and reading for that against
  // the plain output matched nothing — every in-flight card came out with no
  // clock, which looks exactly like a task that just started.
  const started = new Map<string, number>();
  for (const line of wt.split("\n")) {
    const m = /^(\S+)\s+\S+\s+\[(\d{3})\/S(\d+)\/T(\d+)\]/.exec(line);
    if (!m || m[2] !== eu || !existsSync(m[1])) continue;
    started.set(key(m[2], m[3], m[4]), statSync(m[1]).mtimeMs);
  }


  const ended = new Map<string, number>();
  for (const l of git(repo, "log", "--format=%ct %s", "-300").split("\n")) {
    const m = /^(\d+) .*\[(\d{3})\/S(\d+)\/T(\d+)\]/.exec(l);
    if (m && m[2] === eu) ended.set(key(m[2], m[3], m[4]), Number(m[1]) * 1000);
  }


  // Exclusion, in this order: `done` beats `in_progress`. A task with a commit
  // AND a live worktree is a worktree nobody removed, and lighting both would be
  // the board counting one task twice.
  const column = (k: string) =>
    landed.has(k) ? "done" : working.has(k) || receipts.has(k) ? "in_progress" : "backlog";

  return {
    run: dir,
    subject: run.subject,
    repo,
    sprints: run.sprints.map((s) => ({
      id: s.id.replace("sprint_", "S"),
      title: s.title,
      tasks: s.tasks.map((t) => {
        const k = key(eu, s.id.replace(/\D/g, ""), t.id.replace(/\D/g, ""));
        const col = column(k);
        // In flight: how long it has been in this phase. Done: the whole cycle,
        // start to commit — which is what #estimate_becomes_measurement wants
        // measured, and the only number here git could not know in advance.
        const t0 = started.get(k);
        const t1 = ended.get(k);
        const age =
          col === "done"
            ? t0 && t1 ? dur(t1 - t0) : "—"
            : col === "in_progress" && t0 ? dur(Date.now() - t0) : "";
        return { id: t.id, title: t.title, column: col, age };
      }),
    })),
  };
}

/**
 * Uma referência de task, traduzida do bucket velho pro caminho de hoje.
 *
 * Até 17/08 toda run morava em `_meta/NNN_<slug>/`, e as referências que as
 * tasks carregam ficaram gravadas nessa forma. A pasta hoje está VAZIA: são 84
 * ponteiros, espalhados por dez runs, que o `plan()` entregava verbatim pro
 * prompt do agente. Um agente mandado ler `_meta/011_interview_…/interview.yaml`
 * não acha nada — e o modo de falha é o pior que existe, porque ele não estoura:
 * ou gasta turnos procurando, ou segue sem o contexto que a task dizia exigir.
 *
 * A tradução é a mesma que a leitura do `git log` já fazia: o número velho conta
 * pra CIMA desde 001 e o novo pra BAIXO desde 999, então `NNN → 1000 - NNN`, e o
 * resto é o índice de runs.
 *
 * O NÚMERO SOZINHO É AMBÍGUO — cada família numera pra baixo desde 999 por conta
 * própria, então `996` casa três runs. Desambiguar aqui NÃO é sorteio, e são duas
 * peneiras, nesta ordem:
 *
 *   1. a própria run. Quase toda referência velha aponta pra ela — foi a
 *      entrevista dela que gerou as tasks.
 *   2. O ARQUIVO CITADO TEM QUE EXISTIR. `_meta/004_run/sprints.yaml` entre três
 *      candidatas `996_` é a que TEM `sprints.yaml` em disco. Sobrando uma, é
 *      ela; sobrando duas, ninguém sabe e o ponteiro fica como está.
 *
 * NÃO ESTOURA quando não resolve: ponteiro velho que não casa com run nenhuma
 * volta como estava. Um plano inteiro não deixa de rodar por causa de uma
 * citação podre — quem acusa isso é o `my check citations`, não este caminho.
 */
function refDeHoje(ref: string, dir: string): string {
  const m = ref.match(/^_meta\/(\d{3})[^/]*(\/.*)?$/);
  if (!m) return ref;
  const n = espelho1000(m[1]!);
  const cauda = m[2] ?? "";
  // A ÂNCORA (`#decisions`) não é caminho: ela não entra no teste de existência.
  const arquivo = cauda.split("#")[0];
  const monta = (d: string) => runRel(d) + cauda;

  if (dir.startsWith(n)) return monta(dir);
  const candidatas = [...runIndex().keys()].filter((d) => d.startsWith(n));
  if (candidatas.length === 1) return monta(candidatas[0]);

  const existem = candidatas.filter((d) => existsSync(join(ROOT, runRel(d) + arquivo)));
  return existem.length === 1 ? monta(existem[0]) : ref;
}

/**
 * O ciclo inteiro como ARGUMENTO, pronto para o Workflow.
 *
 *     Workflow({ name: 'cycle', args: <a saída daqui> })
 *
 * O script do workflow não tem shell: ele só sabe chamar `agent()`. Então quem
 * lê o plano é este arquivo — o mesmo que já lê tudo o mais de uma run — e o
 * script vira o que ele deveria ser desde o começo: uma FORMA, igual em todo
 * ciclo, que recebe a lista. O script É UM SÓ e já existe
 * (`.claude/workflows/cycle.js`): quem chega aqui não escreve script nenhum.
 *
 * O OUTRO PRODUTOR é `my sprints units`, que lê sprint-PASTA em vez de
 * `sprints.yaml` e emite `mode: pr`. Os dois cospem o mesmo objeto, e é por isso
 * que o script não sabe de qual dos dois veio.
 *
 * TASK JÁ FEITA NÃO ENTRA. A coluna vem do `board()`, então rodar o ciclo duas
 * vezes não refaz o que já tem commit — é o que torna "retomar de onde parou"
 * o comportamento padrão em vez de uma opção que alguém lembra de passar.
 *
 * SAI AGRUPADO POR SPRINT porque a sprint É a unidade de agente: quem executa
 * recebe uma lista de sprints e abre um agente por sprint, não por task. Uma
 * lista achatada não carrega essa fronteira, então quem executasse teria que
 * reconstruí-la — ou, mais provável, ignorá-la. Sprint sem task pendente não
 * sai: ela já aconteceu.
 *
 * SERVES: #one_workflow_shape #sprint_package
 */

export function plan(dir: string) {
  const run = readRun(dir);
  const b = board(dir);
  const feito = new Set(
    b.sprints.flatMap((s) => s.tasks.filter((t) => t.column === "done").map((t) => `${s.id}/${t.id}`)),
  );

  return {
    run: dir,
    work_repo: b.repo,
    base: run.pointer?.branch ?? "staging",
    // O MODO É DADO, e este caminho é o do ciclo de casa: a unidade MERGEIA na
    // base ao terminar, e o VERIFY fecha o ciclo no `main`. O outro produtor de
    // `units` — `my sprints units` — emite `pr`, e é o mesmo script dos dois
    // lados. Ver `.claude/workflows/cycle.js`.
    mode: "merge",
    // UNIDADE é o nome da casa pro que roda num agente só, com worktree própria —
    // @02_areas/00_workflows/00_main/01_coding/CONTEXT.md: "sprint, issue e tarefa
    // solta são a mesma coisa com nomes diferentes". Este verbo dizia `sprints` e
    // o outro dizia `units`, e um script tinha que saber os dois. Um nome.
    units: run.sprints
      .map((s) => ({
        id: s.id.replace("sprint_", "S"),
        // LEQUE É O PADRÃO, e a espera é que se declara — #sprint_package. Sai
        // como lista de unidades, não booleano: "espera a S001" é executável e
        // "não é paralela" não é.
        waits_for: s.waits_for ?? [],
        tasks: s.tasks
          .map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            proof: t.command,
            references: t.references?.map((r) => refDeHoje(r, dir)),
          }))
          .filter((t) => !feito.has(`${s.id.replace("sprint_", "S")}/${t.id}`)),
      }))
      .filter((u) => u.tasks.length > 0),
  };
}

export function allRuns() {
  return [...runIndex().keys()].filter((d) => RUN_DIR.test(d)).map(readRun);
}

/**
 * O bloco `descartados:` de um `vocabulary.yaml`, e nada além dele.
 *
 * ANCORADO NA LINHA, nunca `indexOf`: a palavra `descartados:` aparece no
 * COMENTÁRIO do cabeçalho do arquivo que ela descreve, então `indexOf` acha ela
 * lá em cima e o bloco vira o arquivo quase inteiro — incluindo o `sem_dono:`,
 * que usa a mesma chave `- termo:`. O efeito é o verbo ler os órfãos que ele
 * mesmo acabou de escrever como se já tivessem sido julgados, e a lista zerar
 * sozinha na segunda rodada, em silêncio.
 *
 * Duas versões deste parser morreram pela mesma causa, e é sempre a mesma: uma
 * chave lida fora do lugar onde ela É chave.
 * SERVES: #lookup_log
 */
export function discardBlock(yaml: string): string {
  const at = yaml.search(/^descartados:/m);
  return at < 0 ? "" : yaml.slice(at);
}

//#endregion

//#region  ── 6 · decorators ────────────────────────────────────────────────

/**
 * `@verb("grep")` — registra o método como um verbo do CLI.
 *
 * O QUE ELE CARREGA é o que estava copiado à mão em doze ramos de um `if` de
 * 412 linhas: o registro no log de busca, o contrato de erro (`console.error` +
 * exit 1) e o despacho por nome. Contado antes do refactor: `return 1` dezesseis
 * vezes, `if (json) return out(...)` seis, `logLookup(...)` cinco — três
 * políticas repetidas por cópia, que é como uma delas fica pra trás.
 *
 * DIALETO LEGACY (`target, key, descriptor`), e isso foi MEDIDO, não escolhido:
 * o bun 1.3.9 aceita a sintaxe stage-3 e **não executa** o decorator — o método
 * roda, o decorator nunca é chamado, e nada avisa. Um decorator que vira no-op
 * em silêncio é pior que não ter decorator, então aqui usamos o dialeto que
 * de fato roda neste runtime.
 *
 * O REGISTRO É O EFEITO COLATERAL, e é ele que mata o `if`-chain: cada método
 * se anuncia em `VERBS` na hora em que a classe é definida, então acrescentar um
 * verbo é escrever um método — não é escrever um método E lembrar de pendurar
 * mais um `else if` no lugar certo de uma cadeia.
 */
const VERBS = new Map<string, string>();

function verb(nome: string) {
  return function (_target: unknown, key: string, desc: PropertyDescriptor) {
    VERBS.set(nome, key);
    const orig = desc.value;
    desc.value = async function (this: Cli, ...args: unknown[]) {
      try {
        return await orig.apply(this, args);
      } catch (e) {
        // O ERRO VIRA EXIT 1 EM UM LUGAR SÓ. Antes cada ramo escrevia o seu, e
        // o `grep` era o único com `try/catch` — os outros onze estouravam com
        // stack trace na cara de quem só errou um nome.
        console.error(`meta: ${(e as Error).message}`);
        return 1;
      }
    };
    return desc;
  };
}

//#endregion

//#region  ── 7 · use-cases: o CLI ──────────────────────────────────────────

/**
 * Um método por verbo, e o `@verb` que os liga ao nome digitado.
 *
 * ESTA CLASSE NÃO DECIDE NADA sobre o META — ela é a borda: lê `argv`, chama
 * quem lê o arquivo, imprime. A regra de #markdown_is_the_database continua
 * valendo aqui embaixo, e o dia em que um destes métodos tiver uma regra dentro
 * é o dia de tirá-la daqui.
 *
 * SERVES: #meta_cli
 */
class Cli {
  readonly json: boolean;
  /** Os argumentos que não são flag — o que sobrou depois de tirar `--isso`. */
  readonly args: string[];

  constructor(
    readonly argv: string[],
    readonly meta: ReturnType<typeof parse>,
  ) {
    this.json = argv.includes("--json");
    this.args = argv.slice(1).filter((a) => !a.startsWith("--"));
  }

  /** JSON quando pedido, e o valor de retorno do processo junto. */
  private out(v: unknown): number {
    console.log(JSON.stringify(v, null, 2));
    return 0;
  }

  /** O run que o argumento nomeia, ou um erro que diz quais existem. */
  private run(id: string | undefined): string {
    const dir = resolveRun(id ?? "");
    if (!dir) throw new Error(`no run "${id ?? ""}". try: ${allRuns().map((r) => r.id).join(" · ")}`);
    return dir;
  }

  // ── o lado das RUNS ──────────────────────────────────────────────────────

  @verb("runs")
  runs(): number {
    const sub = this.args[0];
    const j = janelas();
    // UM ARGUMENTO NÃO-NUMÉRICO É FILTRO DE PROJETO, e o número segue sendo a
    // run. `acme` casa por PREFIXO, então alcança
    // `acme-refatoracao` também — são dois esforços contra a mesma
    // árvore, e quem pergunta "o que rodou pro acme" quer os dois.
    if (sub && !/^\d/.test(sub)) {
      const rs = allRuns().filter((r) => (r.projeto ?? "").startsWith(sub));
      if (this.json) return this.out(rs);
      if (!rs.length) {
        const vistos = [...new Set(allRuns().map((r) => r.projeto).filter(Boolean))];
        console.error(`meta: nenhuma run com projeto "${sub}". Existem: ${vistos.join(", ")}`);
        return 1;
      }
      rs.forEach((r) => console.log(linhaRun(r, j)));
      return 0;
    }
    if (!sub) {
      const rs = allRuns();
      if (this.json) return this.out(rs);
      rs.forEach((r) => console.log(linhaRun(r, j)));
      return 0;
    }
    return this.out(readRun(this.run(sub)));
  }

  @verb("plan")
  plan(): number {
    return this.out(plan(this.run(this.args[0])));
  }

  @verb("board")
  board(): number {
    const b = board(this.run(this.args[0]));
    if (this.json) return this.out(b);
    for (const s of b.sprints)
      for (const t of s.tasks)
        console.log(`${s.id}/${t.id}  ${t.column.padEnd(12)}  ${(t.age || "").padEnd(6)}  ${t.title}`);
    return 0;
  }

  @verb("sprints")
  sprints(): number {
    const [verbo, alvo] = [this.args[0] ?? "list", this.args[1]];
    const r = readRun(this.run(alvo));

    if (verbo === "tasks") {
      const flat = r.sprints.flatMap((s) => s.tasks.map((t) => ({ sprint: s.id, ...t })));
      if (this.json) return this.out(flat);
      flat.forEach((t) =>
        console.log(`${t.sprint}/${t.id}  ${t.proof ? "✓prova" : " sem  "}  ${String(t.duration ?? "—").padEnd(7)}  ${t.title}`),
      );
      return 0;
    }
    if (verbo === "list") {
      if (this.json) return this.out(r.sprints);
      r.sprints.forEach((s) =>
        console.log(
          `${s.id}  ${s.tasks.length} tasks · ${s.estimated ?? "—"}${s.actual ? " → " + s.actual : ""}  ` +
            `cobre ${(s.covers as string[]).join(",") || "—"}  ${s.title}`,
        ),
      );
      return 0;
    }
    throw new Error("sprints <list|tasks> <run>");
  }

  @verb("tasks")
  tasks(): number {
    // `just meta tasks 012` é atalho de `sprints tasks 012`. O atalho existe
    // porque é o que se digita; a implementação é uma só.
    return (this as unknown as { sprints: () => number }).sprints.call(
      new Cli(["sprints", "tasks", ...this.args], this.meta),
    );
  }

  // ── busca ────────────────────────────────────────────────────────────────

  /**
   * O laço inteiro: o modelo vira a pergunta em termos, o `rg` recupera, o
   * modelo responde SÓ com o que voltou. Sem embedding, sem índice, nada
   * persistido — #grep_before_embeddings.
   */
  @verb("ask")
  async ask(): Promise<number> {
    const pergunta = this.args.join(" ");
    if (!pergunta) throw new Error("ask <pergunta>");
    const llm = new LLM();

    // PRIMEIRA CHAMADA: só termos, e barata de propósito. Pedir a resposta aqui
    // seria pedir pro modelo inventar sobre um arquivo que ele não viu.
    const termos = (
      await llm.ask(
        `Vou buscar num arquivo markdown com ripgrep. Devolva SÓ um padrão de ` +
          `alternância com 2 a 5 termos, separados por |, sem aspas e sem explicação. ` +
          `Use o vocabulário provável do arquivo, em inglês e português.\n\nPergunta: ${pergunta}`,
        400,
      )
    ).split("\n").map((l) => l.trim()).filter(Boolean).pop()?.replace(/^["'`]|["'`]$/g, "").trim() ?? "";

    // PADRÃO VAZIO NÃO PASSA. `rg ""` casa toda linha do arquivo, então termo
    // vazio não falha: devolve as primeiras seções e PARECE busca. Medido em
    // 16/08 — a resposta veio honesta ("os trechos não respondem") sobre
    // trechos que nunca foram procurados.
    if (!termos || /^[|\s]*$/.test(termos))
      throw new Error("o modelo não devolveu termos — sem padrão, não há busca");

    const achados = grep(termos);
    logLookup("ask", termos, achados.length > 0);
    if (!achados.length)
      throw new Error(
        `"${termos}" não casou nada. A pergunta usa palavra que este arquivo não tem — é um achado de #lookup_log, não um erro.`,
      );

    // O CONTEXTO É A SEÇÃO INTEIRA das que casaram, e no máximo cinco: o
    // arquivo tem ~22.851 tokens e o objetivo é justamente não carregar isso.
    const todas = [...this.meta.resources, ...this.meta.design, ...this.meta.sections];
    const trechos = achados
      .slice(0, 5)
      .map((a) => todas.find((s) => s.slug === a.slug)?.body)
      .filter(Boolean)
      .join("\n\n---\n\n");

    console.log(
      await llm.ask(
        `Responda a pergunta USANDO SOMENTE os trechos abaixo. Se eles não ` +
          `responderem, diga isso — não complete com conhecimento próprio.\n\n` +
          `PERGUNTA: ${pergunta}\n\nTRECHOS:\n${trechos}`,
      ),
    );
    console.log(`\n— termos: ${termos}`);
    console.log(`— de: ${achados.slice(0, 5).map((a) => "#" + a.slug).join(" · ")}`);
    return 0;
  }

  /**
   * A busca por PERGUNTA, que `just meta <nome>` nunca respondeu: ele resolve
   * heading, e serve só a quem já sabe o nome — #grep_before_embeddings.
   */
  @verb("grep")
  grep(): number {
    if (!this.args.length)
      throw new Error(`grep <termo> [termo…]  — vários viram alternância: "a|b|c"`);
    // Vários argumentos viram alternância. É o que faz `just meta grep worktree
    // isolation` significar o que quem digitou quis dizer, sem ensinar regex.
    const pattern = this.args.length === 1 ? this.args[0] : this.args.join("|");
    const achados = grep(pattern);
    logLookup("grep", pattern, achados.length > 0);
    if (this.json) return this.out(achados);
    if (!achados.length) throw new Error(`nada casou com "${pattern}" em META.md`);
    for (const a of achados) {
      console.log(`\n#${a.slug}  ${a.total} linha(s)`);
      a.hits.forEach((h) => console.log(`  ${String(h.linha).padStart(4)}: ${h.texto}`));
    }
    console.log(`\n${achados.length} seção(ões) · abra com \`my meta <slug>\` ou \`my meta resources <slug>\``);
    return 0;
  }

  /**
   * O que o vocabulário não tem, contado do que as pessoas digitaram. Sem
   * `--write` só imprime; com, acumula em `vocabulary.yaml` sem tocar no que já
   * está escrito à mão lá — #lookup_log.
   */
  @verb("terms")
  terms(): number {
    const t = terms(this.meta.resources, this.meta.design);
    if (this.json) return this.out(t);
    const V = join(dirname(META), "vocabulary.yaml");
    const bloco = discardBlock(existsSync(V) ? readFileSync(V, "utf8") : "");
    const descartados = (bloco.match(/^\s+- termo: (.+)$/gm) ?? []).map((l) =>
      l.replace(/^\s+- termo: /, "").trim(),
    );
    const vivos = t.orfaos.filter((o) => !descartados.includes(o.term));

    console.log(
      `${t.total} buscas registradas · ${vivos.length} termo(s) sem dono · ${t.nunca_buscado.length} recurso(s) que ninguém buscou`,
    );
    vivos.forEach((o) => console.log(`  ${String(o.buscas).padStart(3)}×  ${o.term}`));
    if (t.nunca_buscado.length) console.log(`\nnunca buscados: ${t.nunca_buscado.join(" · ")}`);
    if (!this.argv.includes("--write")) return 0;

    // O yaml é DERIVADO menos o que um humano já descartou. Reescrever o bloco
    // `descartados:` seria a ferramenta apagando o julgamento que ela pediu.
    writeFileSync(
      V,
      [
        "# DERIVADO de `.meta-lookups.tsv` por `my meta terms --write`. Não edite",
        "# as duas primeiras listas: elas são reescritas a cada rodada. `descartados:`",
        "# é a única parte à mão, e é o que impede um termo já julgado de voltar.",
        `# Contado em ${new Date().toISOString()} sobre ${t.total} buscas.`,
        "",
        "# Termo buscado que não achou NADA. Duas buscas pelo mesmo termo ausente",
        "# não é erro de digitação: é a casa pedindo uma regra que ninguém escreveu.",
        "sem_dono:",
        ...(vivos.length
          ? vivos.map((o) => `  - termo: ${o.term}\n    buscas: ${o.buscas}\n    ultima: ${o.ultima}`)
          : ["  []"]),
        "",
        "# Recurso que existe e nunca foi buscado: ou é peso morto, ou o nome está",
        "# errado. O arquivo não sabe qual — só sabe que aconteceu.",
        "nunca_buscado:",
        ...(t.nunca_buscado.length ? t.nunca_buscado.map((s) => `  - ${s}`) : ["  []"]),
        "",
        bloco.trim() || "descartados: []",
        "",
      ].join("\n"),
    );
    console.log(`\n→ ${V}`);
    return 0;
  }

  // ── as duas prateleiras ──────────────────────────────────────────────────

  @verb("design")
  design(): number {
    const { design } = this.meta;
    const sub = this.args[0];
    if (!sub) {
      design.forEach((d) => console.log(`${d.slug.padEnd(26)} ${description(d.body)}`));
      return 0;
    }
    if (this.json)
      return this.out(
        design.map((d) => ({ slug: d.slug, description: description(d.body), tags: tags(d.body), built: built(d.body), body: d.body })),
      );
    const nome = sub.replace(/^#/, "");
    const hit = find(design, nome);
    logLookup("design", nome, !!hit);
    if (!hit) throw new Error(`no design concept "${sub}". try: ${design.map((d) => d.slug).join(" · ")}`);
    console.log(hit.body);
    return 0;
  }

  @verb("resources")
  resources(): number {
    const { resources } = this.meta;
    const sub = this.argv[1];

    // `--tag` sem valor lista o vocabulário e quantos cada tag segura. Tag com 1
    // membro fica visível aqui, que é o ponto: ela não agrupa nada.
    if (sub === "--tag") {
      const wanted = this.argv[2];
      if (!wanted) {
        const counts = new Map<string, number>();
        resources.forEach((r) => tags(r.body).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
        [...counts]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .forEach(([t, n]) => console.log(`${String(n).padStart(2)}  ${t}`));
        return 0;
      }
      const hits = resources.filter((r) => tags(r.body).includes(wanted));
      if (!hits.length) {
        const all = [...new Set(resources.flatMap((r) => tags(r.body)))].sort();
        throw new Error(`no resource tagged "${wanted}". try: ${all.join(" · ")}`);
      }
      hits.forEach((r) => console.log(`${r.slug.padEnd(30)} ${type(r.body).padEnd(10)} ${description(r.body)}`));
      return 0;
    }

    // O placar conta do DISCO. Ele morava escrito à mão no cabeçalho do META.md
    // e apodreceu calado — SERVES: #markdown_is_the_database
    if (sub === "--status") {
      const wanted = this.argv[2];
      const by = (s: string) => resources.filter((r) => status(r.body).status === s);
      if (wanted) {
        const hits = by(wanted);
        if (!hits.length) throw new Error(`no resource with status "${wanted}". try: exercised · partial · untested`);
        hits.forEach((r) => console.log(`${r.slug.padEnd(30)} ${status(r.body).detail}`));
        return 0;
      }
      ["exercised", "partial", "untested"].forEach((s) => {
        const hits = by(s);
        console.log(`${s.padEnd(10)} ${String(hits.length).padStart(2)}   ${hits.map((r) => r.slug).join(", ")}`);
      });
      console.log(`${resources.length} regras · ${allRuns().length} ciclos`);
      return 0;
    }

    if (!this.args.length) {
      console.log(resources.map((r) => r.slug).join("\n"));
      return 0;
    }
    const nome = this.args[0].replace(/^#/, "");
    const hit = find(resources, nome);
    logLookup("resources", nome, !!hit);
    if (hit) {
      console.log(hit.body);
      return 0;
    }

    // A sintaxe de citação NÃO tem namespace: `#sandbox_scripts` e
    // `#source_already_exists` moram em `design`, e quem segue a âncora não tem como
    // saber disso — o erro listava 46 alternativas e não mencionava o outro verbo uma
    // vez. Procurar do lado antes de errar é o que faz a citação continuar sendo um
    // nome só, que era o ponto dela.
    const noDesign = find(this.meta.design, nome);
    if (noDesign) {
      console.log(noDesign.body);
      return 0;
    }

    throw new Error(`no resource "${this.args[0]}". try: ${resources.map((r) => r.slug).join(" · ")}`);
  }

  // ── o que prova que o arquivo não mente ──────────────────────────────────

  /**
   * A deriva que este desenho convida: uma task cita `#foo`, alguém renomeia o
   * recurso, e a citação continua parecendo citação. Mesma falha que a família
   * `check/` existe pra pegar, então se comporta como uma — exit 1 quando mente.
   */
  @verb("--check")
  check(): number {
    const { sections, resources, design } = this.meta;

    // Os dois lados que CITAM: o processo cita a regra que segue, e o conceito
    // de design cita a regra que nasceu dele — ou o conceito vizinho que
    // sustenta o argumento. Por isso os nomes válidos são a união das duas
    // prateleiras; checar só uma deixava metade do arquivo livre pra apodrecer.
    const names = new Set([...resources, ...design].map((s) => s.slug));
    const broken = [...sections, ...design].flatMap((s) =>
      [...s.body.matchAll(/#([a-z][a-z0-9_]+)/g)]
        .map((m) => m[1])
        .filter((n) => !names.has(n))
        .map((n) => `${s.title}: cita #${n}, que não existe em # Resources nem em # Design`),
    );

    // O PONTEIRO CRUZADO. `CODE:` num recurso nomeia a função; `SERVES: #slug`
    // na função nomeia o recurso de volta. Escrever os dois à mão só vale se
    // alguém provar que concordam — senão é o apodrecimento de
    // #anchored_references entre dois arquivos, onde nem `git grep` alcança.
    //
    // Três coisas quebram, e cada uma mente de um jeito:
    //   1. CODE aponta pra função que não existe → morreu numa renomeação
    //   2. SERVES cita recurso que não existe    → a regra sumiu, o código não soube
    //   3. um lado aponta e o outro não devolve  → metade de uma edição, o pior
    //      caso, porque cada lado lido sozinho parece inteiro
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "meta.ts"), "utf8");
    // FUNÇÃO **OU CLASSE**. O `main()` deixou de ser quem serve o `#meta_cli` no
    // refactor de 16/08 — quem serve é a classe `Cli`, e o check não sabia
    // enxergar `class`. Um ponteiro válido acusado como quebrado ensina a
    // ignorar o check, que é pior do que o check não existir.
    const fns = new Set(
      [...src.matchAll(/^(?:export )?(?:async )?(?:function|class) (\w+)/gm)].map((m) => m[1]),
    );

    const serves = new Map<string, string[]>();
    [...src.matchAll(/SERVES:([^\n]*)\n(?:[^\n]*\n){0,3}?(?:export )?(?:async )?(?:function|class) (\w+)/g)].forEach((m) =>
      serves.set(m[2], [...m[1].matchAll(/#([a-z][a-z0-9_]+)/g)].map((x) => x[1])),
    );

    const crossed = resources.flatMap((r) =>
      code(r.body).flatMap((ref) => {
        // `justfile` e afins não têm função; o par só vale dentro do meta.ts
        const [file, fn] = ref.split("#");
        if (file !== "meta.ts" || !fn) return [];
        if (!fns.has(fn)) return [`${r.slug}: CODE aponta meta.ts#${fn}, que não é função de lá`];
        if (!(serves.get(fn) ?? []).includes(r.slug))
          return [`${r.slug}: CODE aponta meta.ts#${fn}, mas ${fn}() não devolve SERVES: #${r.slug}`];
        return [];
      }),
    );
    const orphanServes = [...serves].flatMap(([fn, slugs]) =>
      slugs.filter((s) => !names.has(s)).map((s) => `meta.ts#${fn}: SERVES #${s}, que não existe em # Resources`),
    );

    const all = [...broken, ...crossed, ...orphanServes];
    all.forEach((b) => console.error(b));
    console.log(
      `${sections.length} processos · ${resources.length} recursos · ${design.length} conceitos · ` +
        `${broken.length} citação(ões) quebrada(s) · ${crossed.length + orphanServes.length} ponteiro(s) cruzado(s) quebrado(s)`,
    );
    return all.length ? 1 : 0;
  }

  /**
   * A view da parede lê ISTO, não um awk paralelo sobre o META.md. Um segundo
   * parser é uma segunda verdade: ele deriva na primeira mudança de forma.
   */
  @verb("--json")
  dump(): number {
    const { sections, resources, design } = this.meta;
    const cited = (name: string) => sections.filter((s) => s.body.includes(`#${name}`)).map((s) => s.slug);
    return this.out({
      processes: sections.map((s) => ({ slug: s.slug, title: s.title, ...anatomy(s.body) })),
      resources: resources.map((r) => ({
        slug: r.slug, description: description(r.body), type: type(r.body), tags: tags(r.body),
        code: code(r.body), body: r.body, ...status(r.body), cited_by: cited(r.slug),
      })),
      design: design.map((d) => ({
        slug: d.slug, description: description(d.body), tags: tags(d.body), built: built(d.body), body: d.body,
      })),
    });
  }

  @verb("--list")
  list(): number {
    console.log(this.meta.sections.map((s) => s.slug).join("\n"));
    return 0;
  }

  /** Sem argumento: o cabeçalho, e o nome de tudo que dá pra buscar. */
  header(): number {
    const { header, sections, resources, design } = this.meta;
    console.log(header);
    console.log(`\n${sections.map((s) => `  my meta ${s.slug}  —  ${s.title}`).join("\n")}`);
    console.log(`\n  my meta resources  —  ${resources.length} recursos: ${resources.map((r) => r.slug).join(" · ")}`);
    console.log(`\n  my meta design  —  ${design.length} conceitos: ${design.map((d) => d.slug).join(" · ")}`);
    return 0;
  }

  /** O que sobrou: o argumento é o nome de um PROCESSO, ou não é nada. */
  processo(arg: string): number {
    const hit = find(this.meta.sections, slugify(arg));
    logLookup("process", slugify(arg), !!hit);
    if (!hit) {
      console.error(`meta: no process "${arg}". try: ${this.meta.sections.map((s) => s.slug).join(" · ")}`);
      return 1;
    }
    console.log(hit.body);
    return 0;
  }
}

/**
 * O despacho, e ele é uma LINHA porque o `@verb` já fez o resto: o mapa
 * `VERBS` foi preenchido quando a classe foi definida, então acrescentar um
 * verbo é escrever um método — nunca escrever um método E lembrar de pendurar
 * mais um `else if` no lugar certo de uma cadeia de 412 linhas.
 */
async function main(argv: string[]): Promise<number> {
  // The two shelves come from two places now: processes and design from META.md,
  // rules from `03_resources/rules/`. Everything downstream still sees one object.
  const cli = new Cli(argv, {
    ...parse(readFileSync(META, "utf8")),
    sections: readProcesses(),
    resources: readResources(),
  });
  const [arg] = argv;
  if (!arg) return cli.header();
  const metodo = VERBS.get(arg);
  if (metodo) return await (cli as unknown as Record<string, () => Promise<number> | number>)[metodo]();
  return cli.processo(arg);
}

//#endregion

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
