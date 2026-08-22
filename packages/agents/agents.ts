import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Command } from "commander";

import type { AgentSystem, Fail, Finding } from "@biliboss/interfaces/agents.ts";
import type { ChatSystem } from "@biliboss/interfaces/chat.ts";

import {
	allMessages,
	getCursor,
	inbox,
	listChannels,
	type Msg,
	read as readChannel,
	say,
	seen,
} from "@biliboss/chat";
import { list as liveAgents, type Agent as HerdrAgent } from "@biliboss/herdr/agents/list";
import { forget, remember, roster } from "@biliboss/herdr/agents/roster";
import { start as herdrStart, startWhenReady } from "@biliboss/herdr/agents/start";
import { read as readPane } from "@biliboss/herdr/panes/read";
import { send } from "@biliboss/herdr/panes/send";
import { split } from "@biliboss/herdr/panes/split";
import { did, result } from "@biliboss/herdr/run";
import { close } from "@biliboss/herdr/tabs/close";
import { focus as focusTab } from "@biliboss/herdr/tabs/focus";
import { wait } from "@biliboss/herdr/agents/wait";
import { list as tabs } from "@biliboss/herdr/tabs/list";
import { create } from "@biliboss/herdr/workspaces/create";
import { list as listWorkspaces } from "@biliboss/herdr/workspaces/list";
import { move } from "@biliboss/herdr/workspaces/move";
import { resolve } from "@biliboss/herdr/workspaces/resolve";
import { emit } from "@biliboss/shared/findings";
import { fmtOf, out } from "@biliboss/shared/gh";
import { store } from "@biliboss/shared/paths";

/** The CLIs this house knows how to run, keyed by the program name herdr detects.
 *  `engine` is the contract's discriminator and `bin` is what you exec — three
 *  spellings of one thing, and they used to live in three tables that could
 *  disagree.
 *
 *  OPEN ENUM: a harness that is not here is `other`, never guessed — see
 *  `AgentSystem.ValueObjects.Engine.Other`. */
const HARNESSES = {
	claude: { engine: "claude-code", bin: "claude" },
	pi: { engine: "pi", bin: "pi" },
	codex: { engine: "codex", bin: "codex" },
	gemini: { engine: "gemini", bin: "gemini" },
} as const;

type Engine = (typeof HARNESSES)[keyof typeof HARNESSES]["engine"];

/** What a delegation gets when nobody names it. `harness` is a key of
 *  `HARNESSES`, so a typo is a compile error instead of an agent that never
 *  starts. */
export const DEFAULT = {
	harness: "claude" as keyof typeof HARNESSES,
	model: "opus",
	effort: "medium",
	/** Second in the sidebar, 0-based: `my-dashboard` owns the first position. */
	workspacePosition: 1,
} as const;

/** Every wait this file makes, in ms, in one place. A timeout hidden next to the
 *  code that waits is a number nobody compares against its siblings. */
export const TIMEOUT = {
	/** `<bin> --help`, to read what a CLI supports. */
	help: 5_000,
	/** The Claude TUI opening in a fresh pane before we type into it. */
	tui: 60_000,
} as const;

/** One delegated stage. It lives inside the pool and nowhere else: the root is
 *  the only thing that builds one, and `--max-agents` is honest because of it. */
// ─── the shapes ──────────────────────────────────────────────────────────────

export type Reader = {
	name: string;
	cursor: ChatSystem.ValueObjects.Cursor;
	/** QUANTAS mensagens deste canal ficaram pra trás — a CONTAGEM de mensagens
	 *  do canal com `seq > cursor`, nunca `HEAD - cursor`. `seq` é endereço
	 *  GLOBAL do arquivo inteiro (@store.ts, "nunca reusado" — não recomeça por
	 *  canal), então subtrair endereços conta de brinde toda mensagem de OUTRO
	 *  canal escrita no meio. MEDIDO: dois canais interleaved, cursor 0, um
	 *  canal com só 2 mensagens suas devolvia `lag: 4` por causa de 2 mensagens
	 *  de outro canal entre elas — achado do T5 contra 569 linhas reais, onde
	 *  isto teria dito "557 atrás" pra um canal com 2 mensagens não lidas. */
	lag: number;
	/** Está na frota AGORA, pelo herdr — não confundir com "leu alguma vez". */
	alive: boolean;
};

type Linha = HerdrAgent & { nome: string; base: string; n: number; eu: boolean }

type Pane = {
  pane_id: string
  tab_id: string
  terminal_title_stripped?: string
  agent_session?: { value?: string }
}

// ─── the entities ────────────────────────────────────────────────────────────

export class Agent {
	/** The stage it was handed. It is also the tab name and the name it signs with
	 *  on the bus, through `MY_AGENT`. */
	readonly stage: string;

	/** Which CLI runs it — herdr calls this the kind. */
	readonly harness: string;

	readonly model: string;

	readonly effort: string;

	/** `--permission-mode` of the vendor. Absent keeps the house default, which is
	 *  `--dangerously-skip-permissions`. */
	readonly permission?: string;

	/** What it is told before the stage: appended to the system prompt, never to
	 *  the ask. `@path` reads the file, anything else is the text. */
	readonly brief?: string;

	/** The directory it boots in. A coding stage that starts in the wrong repo
	 *  reads the wrong code and is confidently wrong about it. */
	readonly cwd?: string;

	/** Where it is drawn. Absent until the pool starts it. */
	readonly pane?: string;

	constructor(
		stage: string,
		opts: { harness?: string; model?: string; effort?: string; permission?: string; brief?: string; cwd?: string; pane?: string } = {},
	) {
		this.stage = stage;
		this.harness = opts.harness ?? DEFAULT.harness;
		this.model = opts.model ?? DEFAULT.model;
		this.effort = opts.effort ?? DEFAULT.effort;
		this.permission = opts.permission;
		this.brief = opts.brief;
		this.cwd = opts.cwd;
		this.pane = opts.pane;
	}
}

/** Quanto se espera o TUI do Claude abrir antes de digitar a primeira barra.
 *  Confirmado lendo a tela, não por sleep — retomar sessão longa demora. */

// ─── the aggregate ────────────────────────────────────────────────────────────────

/** The plumbing every face shares. Protected, so it never reaches a caller:
 *  the faces below are the API, and this is how they are built. */
class AgentsCore {
	constructor(protected readonly root: Agents) {}

	/** The refusal shape, in one place. Every verb that can fail for a
	 *  herdr-shaped reason returns this instead of throwing. */
	protected fail(error: string, reason: Fail["reason"] = "not_found"): Fail {
		return { ok: false, error, reason };
	}

	/** herdr's program name → the contract's engine discriminator. Absent means a
	 *  CLI this house has not met; the enum stays open. */
	protected engineOf(herdrName: string): Engine | undefined {
		return HARNESSES[herdrName as keyof typeof HARNESSES]?.engine;
	}

	/** The engine discriminator → what you actually exec. */
	protected binOf(engine: string): string {
		return Object.values(HARNESSES).find((h) => h.engine === engine)?.bin ?? engine;
	}

	/** `/Users/x/src/me` → `-Users-x-src-me`, the slug all three filesystem
	 *  vendors build their project folder from. */
	protected slug(cwd: string): string {
		return cwd.replace(/\//g, "-");
	}

	/** Prints and exits. Only `panes()` uses it: a herdr that does not answer at
	 *  all is not a refusal a caller can do anything with. */
	protected morre(msg: string): never {
		console.error(msg);
		process.exit(1);
	}

	protected async panes(): Promise<Pane[]> {
	  const out = await result(['pane', 'list'])
	  if (!out.ok) this.morre(`herdr não respondeu: ${out.error}`)
	  return (out.result?.panes ?? []) as Pane[]
	}

	/** THE ONE NAME→PANE RESOLUTION every verb below shares with `this.root.list.all()`/`this.root.list.find()`: a
	 *  roster name when `Agents.start` remembered one, else the pane's own stripped
	 *  title — the same fallback `my agents list` already displays as identity for
	 *  every agent nobody named through the roster. Splitting this from `this.root.list.find()`
	 *  saves every OTHER verb here from re-deriving it its own way, which is how
	 *  `health`/`screen` first ended up seeing only rostered agents while `find` saw
	 *  all of them — same name, two different answers. */
	protected async locate(name: string): Promise<HerdrAgent | undefined> {
	  const live = await liveAgents()
	  if (!live.ok) return undefined
	  const rosterPane = (await roster()).find((a) => a.name === name)?.pane
	  return live.agents.find((a) => a.pane === rosterPane || a.title === name)
	}

	/** herdr's own vocabulary (`idle · working · blocked · done · unknown`, measured
	 *  via `herdr agent wait --help`) folded onto the four this house named in the
	 *  contract. `done` and `idle` both mean "no work in flight right now", which is
	 *  `waiting`. `stuck` is deliberately NEVER produced here: telling it apart from
	 *  `working` needs two screen reads over time, not one — this is a single herdr
	 *  call, and guessing `stuck` off one sample would be worse than not offering it. */
	protected toHealth(status: string): AgentSystem.ValueObjects.Health {
	  if (status === 'working') return 'working'
	  if (status === 'blocked') return 'blocked'
	  if (status === 'idle' || status === 'done') return 'waiting'
	  // `unknown` — herdr saw the pane but could not classify it. Closest honest
	  // bucket: not confirmed working, not confirmed gone.
	  return 'waiting'
	}

	/** gemini keys its project folder by an OPAQUE name, never the path itself — so
	 *  resolving it means reading every `.project_root` file and matching by VALUE,
	 *  not guessing the folder name from the cwd. */
	protected geminiProjectDir(cwd: string): string | undefined {
	  const root = join(homedir(), '.gemini', 'tmp')
	  if (!existsSync(root)) return undefined
	  for (const entry of readdirSync(root, { withFileTypes: true })) {
	    if (!entry.isDirectory()) continue
	    const marker = join(root, entry.name, '.project_root')
	    if (existsSync(marker) && readFileSync(marker, 'utf8').trim() === cwd) return join(root, entry.name)
	  }
	  return undefined
	}

	/** Where the roster lives on this machine. */
	protected rosterStore(): string {
		return store("agents");
	}

	/** One herdr-raw agent → the contract's `Entity.Agent`. Exported: `start.ts`,
	 *  `clone.ts` and `control.ts` all hand back the entity a mutation just produced,
	 *  and this is the one place that knows the shape. */
	protected toEntity(a: HerdrAgent, rosterName: string | undefined, siblings: HerdrAgent[]): AgentSystem.Entities.Agent {
	  const cli = this.engineOf(a.agent)
	  const runtime: AgentSystem.ValueObjects.Runtime.Any = cli
	    ? { cli, session: a.session }
	    : { cli: 'other', name: a.agent, session: a.session }

	  // O PAI: mesmo `tab`, mesma `base` de nome, o `n` imediatamente ABAIXO do
	  // deste — é a mesma árvore que `main()` já desenha na CLI, só que devolvida
	  // como fato em vez de indentação.
	  const { base, n } = this.root.clone.nomeDoClone(a.title)
	  let parent: string | undefined
	  if (n > 0) {
	    const candidatos = siblings
	      .filter((s) => s.tab === a.tab && s.pane !== a.pane)
	      .map((s) => ({ s, x: this.root.clone.nomeDoClone(s.title) }))
	      .filter((c) => this.root.clone.baseCurta(c.x.base) === this.root.clone.baseCurta(base) && c.x.n < n)
	      .sort((x, y) => y.x.n - x.x.n)
	    parent = candidatos[0]?.s.title
	  }

	  return {
	    name: rosterName ?? a.title,
	    runtime,
	    // `worktree` é o único campo de `launch` que herdr entrega de graça (o
	    // `cwd` do pane); modelo/effort/permission não são reconstruíveis sem ler a
	    // tela — `launch: {}` além disso é uma resposta REAL ("tudo no default"),
	    // não um stub, porque todo campo de `Launch` já é opcional no contrato.
	    launch: { engine: cli ? { cli } : { cli: 'other', name: a.agent }, worktree: a.launchCwd },
	    pane: a.pane,
	    parent,
	  }
	}
}

/** The fleet as it is: who exists, who reads, what is rotten. */
export class AgentsList extends AgentsCore {
	/** O QUE `my agents list` MOSTRA, TIPADO (`View.all`). */
	async all(): Promise<AgentSystem.Entities.Agent[]> {
	  const [live, known] = await Promise.all([liveAgents(), roster()])
	  if (!live.ok) return []
	  const names = new Map(known.filter((k) => k.name !== '—').map((k) => [k.pane, k.name]))
	  return live.agents.map((a) => this.toEntity(a, names.get(a.pane), live.agents))
	}

	/** The live entity for a roster NAME — `undefined` when that name resolves to
	 *  nothing, per contract (`find` never fails, it just may find nothing). */
	async find(name: string): Promise<AgentSystem.Entities.Agent | undefined> {
	  return (await this.all()).find((a) => a.name === name)
	}

	/** Quem está lendo `channel`, e quanto atrás — a frota viva UNIDA aos membros
	 *  declarados do canal (@store.ts `registerChannel`). A união importa: um
	 *  membro que nunca apareceu na frota ainda é alguém que deveria estar lendo,
	 *  e um agente vivo que ninguém registrou como membro ainda é presença real.
	 *  Ordenado do mais atrasado pro mais em dia — é quem eu preciso cutucar. */
	async who(channel: ChatSystem.ValueObjects.ChannelName): Promise<Reader[]> {
		const live = await this.all();
		const aliveNames = new Set(live.map((a) => a.name));
		const declared = listChannels().find((c) => c.name === channel)?.members ?? [];
		const names = new Set<string>([...declared.map((m) => m.trim()).filter(Boolean), ...aliveNames]);
		names.delete("all"); // endereço, não identidade — ver Addressee no contrato
		return this.lag(channel, [...names])
			.map((r) => ({ ...r, alive: aliveNames.has(r.name) }))
			.sort((a, b) => b.lag - a.lag);
	}

	/** Cursor lag pra uma lista FIXA de nomes — sem frota, só `store.ts`. `this.who()`
	 *  é isto mais "quem está vivo agora"; separado porque só a metade de cima
	 *  precisa de herdr, e herdr é o que este módulo não pode exigir pra ser
	 *  testado. */
	lag(channel: ChatSystem.ValueObjects.ChannelName, names: string[]): Omit<Reader, "alive">[] {
		// SÓ as mensagens DESTE canal — a contagem certa ignora todo `seq` gasto
		// por outro canal no meio, que é justamente o que `HEAD - cursor` não fazia.
		const doCanal = allMessages().filter((m) => m.channel === channel);
		return names.map((name) => {
			const cursor = getCursor(channel, name);
			return { name, cursor, lag: doCanal.filter((m) => m.seq > cursor).length };
		});
	}

	/** O HEAD de um canal: o maior `seq` já escrito nele, 0 se vazio. É um
	 *  ENDEREÇO (o que `--seen <seq>` espera), não uma contagem — só a CLI
	 *  imprime, `this.lag()` não usa mais isto pra aritmética (ver o porquê no
	 *  `Reader.lag`). */
	headOf(channel: ChatSystem.ValueObjects.ChannelName): number {
		return allMessages()
			.filter((m) => m.channel === channel)
			.reduce((mx, m) => Math.max(mx, m.seq), 0);
	}

	check(): Finding[] {
	  let raw: Record<string, { pane: string }>
	  try {
	    raw = JSON.parse(readFileSync(this.rosterStore(), 'utf8'))
	  } catch {
	    // Arquivo ausente e corrompido contam a mesma história: nenhum agente
	    // lembrado, logo nenhuma colisão possível.
	    return []
	  }
	  const byPane = new Map<string, string[]>()
	  for (const [name, entry] of Object.entries(raw)) {
	    const list = byPane.get(entry.pane) ?? []
	    list.push(name)
	    byPane.set(entry.pane, list)
	  }
	  const findings: Finding[] = []
	  for (const [pane, names] of byPane) {
	    if (names.length > 1) findings.push({ path: this.rosterStore(), says: `${names.join(', ')} apontam todos pro mesmo pane ${pane}` })
	  }
	  return findings
	}
}


/** One workspace, one tab per stage, a ceiling on how many run. */
export class AgentsDelegation extends AgentsCore {
	/** The herdr workspace that holds the pool, one tab per delegated stage. */
	readonly name: string;

	/** How many stages may run at once. The ceiling is the whole reason the pool
	 *  is one workspace: `live()` counts its tabs, and this is what it counts to. */

	readonly max: number;

	#workspace?: Promise<string>;

	constructor(root: Agents, name = "my-agents", max = 10) {
		super(root);
		this.name = name;
		this.max = max;
	}

	/** Resolved once and held. LAZY on purpose: an eager field would shell out to
	 *  herdr the moment this module is imported, and every CLI shell imports it. */
	get workspace(): Promise<string> {
		this.#workspace ??= this.open();
		return this.#workspace;
	}

	/** The whole ask, in three lines: which process, and the two ends of it.
	 *
	 *  It carries no pedido, no contract and no context — every one of those has
	 *  an address the agent can open, and opening it reads TODAY's version. The
	 *  copy this replaces diverged on the first new comment, and it also did not
	 *  fit: 6.4 KB of inlined issue made herdr refuse with `agent arguments cannot
	 *  be encoded safely for the target shell`. Measured 22/08 — #in_reference.
	 *
	 *  Input and output are the same folder on purpose: the run is where the ask
	 *  and what it became sit side by side, and one `ls` shows both.
	 *
	 *  ONE LINE, and that is not cosmetic: herdr refuses a prompt that carries a
	 *  newline with `agent arguments cannot be encoded safely for the target
	 *  shell`. Measured 22/08 — three short lines were refused and the same text
	 *  joined by ` · ` went up as `w65:pT`. The size was never the limit. */
	ask(workflow: string, run: string): string {
		return `Execute o workflow ${workflow} · Input e Output: ${run} — leia o input.md primeiro e escreva o summary.md aqui`;
	}

	/** Hands the stage to one agent and returns it. Throws at the ceiling. */
	async delegate(stage: string, prompt: string, opts: Partial<Agent> = {}): Promise<Agent> {
		await this.reap();

		const running = await this.live();
		if (running.length >= this.max) {
			throw new Error(`${running.length} de ${this.max} rodando: ${running.map((a) => a.stage).join(", ")}`);
		}

		const asked = new Agent(stage, opts);
		// `startWhenReady` and not `herdrStart`: a pane born a moment ago is not a
		// shell yet, and herdr answers `is not an available shell` truthfully.
		const up = await startWhenReady(asked.stage, {
			workspace: await this.workspace,
			kind: asked.harness,
			model: asked.model,
			effort: asked.effort,
			permission: asked.permission,
			system: asked.brief,
			cwd: asked.cwd,
			prompt,
		});
		if (!up.ok) throw new Error(up.error);

		// Focus the tab that was just born. A one-shot you cannot see is a one-shot
		// you find out about when it is already done.
		if (up.tab) await focusTab(up.tab);

		return new Agent(asked.stage, { ...asked, pane: up.pane });
	}

	/** Who is running right now. The tabs of the pool ARE the count: a tab that is
	 *  still booting has no agent yet, and counting the fleet would let the ceiling
	 *  be crossed while it comes up. */
	async live(): Promise<Agent[]> {
		const open = await tabs(await this.workspace);
		if (!open.ok) return [];

		const live = await liveAgents();
		const harness = new Map(live.ok ? live.agents.map((a) => [a.tab, a.agent]) : []);
		return open.tabs.map((t) => new Agent(t.label, { harness: harness.get(t.id) }));
	}

	/** A one-shot agent that finished leaves its tab open, and that tab keeps
	 *  eating the budget forever. Closing it is what makes `max` mean "running"
	 *  instead of "ever started". */
	/** Blocks until the stage is `done`, then closes its tab. This is what makes a
	 *  one-shot one-shot: `reap()` only cleans on the NEXT delegate, so an agent
	 *  that finished sits there holding a slot until somebody else asks for one. */
	async finish(stage: string, timeoutMs = 600_000): Promise<boolean> {
		const done = await wait(stage, { until: ["done"], timeoutMs });
		if (!done.ok) return false;

		// By TAB LABEL, not by agent name: herdr's agent list does not carry the
		// roster name, and the label is what `start` wrote when it opened the tab.
		const open = await tabs(await this.workspace);
		const mine = open.ok ? open.tabs.find((t) => t.label === stage) : undefined;
		if (mine) await close(mine.id);
		return true;
	}

	async reap(): Promise<string[]> {
		const home = await this.workspace;
		const open = await tabs(home);
		if (!open.ok) return [];

		const live = await liveAgents();
		const agentOf = new Map(live.ok ? live.agents.filter((a) => a.workspace === home).map((a) => [a.tab, a]) : []);

		// Two kinds of dead tab, and only the first was being closed: an agent that
		// finished, and a tab that never got one — a `start` that refused leaves the
		// tab behind, and six of them filled the pool before this counted them.
		//
		// The race is real and accepted: a tab created a breath ago has no agent yet.
		// `delegate` reaps BEFORE it opens its own, so it never eats its own tab.
		const dead = open.tabs.filter((t) => (agentOf.get(t.id)?.status ?? "done") === "done");
		for (const t of dead) await close(t.id);
		return dead.map((t) => t.label);
	}

	private async open(): Promise<string> {
		const found = await resolve(this.name);
		if (found.ok) return found.workspace.id;

		const born = await create(this.name);
		if (!born.ok) throw new Error(born.error);

		await move(born.id, DEFAULT.workspacePosition);
		return born.id;
	}
}


/** One agent, up close: what it shows, where it logs, what it can do. */
export class AgentsView extends AgentsCore {
	async screen(name: string): Promise<{ ok: true; text: string } | Fail> {
	  const rec = await this.locate(name)
	  if (!rec) return this.fail(`não conheço agente \`${name}\``)
	  const out = await readPane(rec.pane)
	  return out.ok ? out : { ok: false, error: out.error, reason: 'herdr' }
	}

	async log(name: string): Promise<{ ok: true; path: string } | Fail> {
	  const entry = await this.locate(name)
	  if (!entry) return this.fail(`não conheço agente \`${name}\` — \`my agents list\` mostra os vivos`)

	  const cli = entry.agent

	  if (cli === 'claude') {
	    if (!entry.session) return this.fail(`herdr não relatou a sessão do claude para \`${name}\` (agent_session ausente)`, 'unsupported')
	    const path = join(homedir(), '.claude', 'projects', this.slug(entry.launchCwd), `${entry.session}.jsonl`)
	    return existsSync(path) ? { ok: true, path } : this.fail(`esperava o transcript em ${path}, e não está lá`)
	  }

	  if (cli === 'gemini') {
	    const dir = this.geminiProjectDir(entry.launchCwd)
	    if (!dir) return this.fail(`gemini nunca rodou em ${entry.launchCwd} (nenhum \`.project_root\` bate)`)
	    const path = join(dir, 'logs.json')
	    return existsSync(path) ? { ok: true, path } : this.fail(`${dir} existe, mas sem logs.json`)
	  }

	  if (cli === 'pi' || cli === 'codex') {
	    // O id da sessão mora no NOME do arquivo (pi: `<ISO>_<uuid>.jsonl`; codex:
	    // `rollout-<ISO>-<uuid>.jsonl`), e o herdr não relata esse id pra nenhum dos
	    // dois hoje (medido: `agent_session` só aparece pra `claude` em `agent list`).
	    // Escolher um arquivo entre vários seria chutar — a casa proíbe.
	    return this.fail(`\`${cli}\` não expõe sessão pelo herdr hoje — sem ela não dá pra escolher o arquivo certo em \`~/.${cli === 'pi' ? 'pi/agent/sessions' : 'codex/sessions'}\` sem chutar`, 'unsupported')
	  }

	  return this.fail(`\`${cli}\` é um CLI que esta casa ainda não mapeou transcript nenhum`, 'unsupported')
	}

	async health(name: string): Promise<AgentSystem.ValueObjects.Health | Fail> {
	  const rec = await this.locate(name)
	  if (!rec) return this.fail(`não conheço agente \`${name}\` — \`my agents list\` mostra os vivos`)
	  return this.toHealth(rec.status)
	}

	async caps(
	  cli: string,
	): Promise<{ ok: true; fork: AgentSystem.ValueObjects.ForkSupport } | (Fail & { reason: 'not_found' | 'unsupported' })> {
	  const bin = this.binOf(cli)
	  let out: string
	  try {
	    const child = Bun.spawn([bin, '--help'], { stdout: 'pipe', stderr: 'pipe', timeout: TIMEOUT.help })
	    const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()])
	    await child.exited
	    // `exitedDueToTimeout` is newer than the @types/bun this workspace pins.
	    if ((child as { exitedDueToTimeout?: boolean }).exitedDueToTimeout) return { ok: false, error: `\`${bin} --help\` travou depois de ${TIMEOUT.help}ms`, reason: 'unsupported' }
	    out = stdout + stderr
	  } catch (err) {
	    // Binário ausente do PATH cai aqui — "não sei porque não tenho", não `false`.
	    return { ok: false, error: `não tenho \`${bin}\` instalado — ${err instanceof Error ? err.message : String(err)}`, reason: 'not_found' }
	  }

	  const native = /--fork-session\b/.test(out) || /^\s*fork\s/m.test(out) || /--fork\s*</.test(out)
	  if (native) return { ok: true, fork: 'native' }

	  const emulated = /--session-file\b/.test(out) && /--session-id\b/.test(out)
	  if (emulated) return { ok: true, fork: 'emulated' }

	  return { ok: true, fork: 'none' }
	}
}


/** Moving one: bring it up, poke it, retune it, put it down. */
export class AgentsControl extends AgentsCore {
	async start(
		name: string,
		where: AgentSystem.ValueObjects.Placement,
		launch: AgentSystem.ValueObjects.Launch = {},
	): Promise<AgentSystem.Entities.Agent | Fail> {
	  const cli = launch.engine?.cli ?? 'claude-code'
	  if (cli !== 'claude-code') {
	    return { ok: false, error: `\`${cli}\` ainda não tem os defaults de start medidos — só \`claude-code\` roda hoje`, reason: 'unsupported' }
	  }

	  const out = await startWhenReady(name, {
	    workspace: where.workspace,
	    pane: where.pane,
	    tab: where.tab,
	    cwd: where.cwd,
	    prompt: where.prompt,
	    model: launch.engine?.model,
	    effort: launch.effort,
	  })
	  if (!out.ok) return { ok: false, error: out.error, reason: out.reason }

	  remember(name, out.pane)

	  const agent = await this.root.list.find(name)
	  if (!agent) return { ok: false, error: `${name} subiu em ${out.pane}, mas não apareceu na frota logo em seguida`, reason: 'herdr' }
	  return agent
	}

	async restart(name: string): Promise<AgentSystem.Entities.Agent | Fail> {
	  const origem = await this.locate(name)
	  if (!origem) return this.fail(`não conheço agente \`${name}\``)
	  if (origem.agent !== 'claude') return this.fail(`\`${origem.agent}\` não tem restart medido nesta casa — só claude-code`, 'unsupported')
	  if (!origem.session) return this.fail(`herdr não relatou a sessão de \`${name}\` (agent_session ausente) — sem ela não dá pra retomar`, 'unsupported')

	  const partido = await split(origem.pane, { direction: 'right', ratio: 0.6, focus: false })
	  if (!partido.ok) return { ok: false, error: partido.error, reason: 'herdr' }
	  const novo = partido.pane

	  const abriu = await send(novo, `claude --dangerously-skip-permissions -r ${origem.session}`)
	  if (!abriu.ok) return { ok: false, error: `o pane ${novo} nasceu mas não recebeu o comando: ${abriu.error}`, reason: 'herdr' }

	  if (!(await this.root.clone.esperaTUI(novo))) return this.fail(`o claude não retomou em ${novo} em ${TIMEOUT.tui / 1000}s — o pane novo está lá, o velho (${origem.pane}) NÃO foi fechado`, 'herdr')

	  const renomeado = await send(novo, `/rename ${name}`, { window: 24 })
	  if (!renomeado.ok) return { ok: false, error: `\`/rename ${name}\` não entrou em ${novo}: ${renomeado.error} — os dois panes estão de pé`, reason: 'herdr' }
	  await Bun.sleep(1_500)

	  // SÓ AGORA fecha o velho — depois que o novo provou que subiu e respondeu ao
	  // rename. Fechar antes seria arriscar ficar sem NENHUM dos dois.
	  const fechou = await did(['pane', 'close', origem.pane])
	  if (!fechou.ok) return this.fail(`${name} retomou em ${novo}, mas o pane velho ${origem.pane} não fechou: ${fechou.error} — feche à mão`, 'herdr')

	  remember(name, novo)
	  const depois = await liveAgents()
	  const novoLive = depois.ok ? depois.agents.find((a) => a.pane === novo) : undefined
	  return {
	    name,
	    runtime: { cli: 'claude-code', session: novoLive?.session ?? origem.session },
	    launch: { engine: { cli: 'claude-code' }, worktree: novoLive?.launchCwd ?? origem.launchCwd, resume: origem.session },
	    pane: novo,
	  }
	}

	async interrupt(name: string): Promise<{ ok: true } | Fail> {
	  const rec = await this.locate(name)
	  if (!rec) return this.fail(`não conheço agente \`${name}\``)
	  const out = await did(['pane', 'send-keys', rec.pane, 'esc'])
	  return out.ok ? { ok: true } : { ok: false, error: out.error ?? 'herdr failed', reason: 'herdr' }
	}

	async stop(name: string): Promise<{ ok: true } | Fail> {
	  const rec = await this.locate(name)
	  if (!rec) return this.fail(`não conheço agente \`${name}\``)
	  const out = await did(['pane', 'close', rec.pane])
	  if (!out.ok) return { ok: false, error: out.error ?? 'herdr failed', reason: 'herdr' }
	  forget([name])
	  return { ok: true }
	}

	/** RECUSA TUDO — ver o cabeçalho deste arquivo. MEDIDO 20/08 contra um pane
	 *  descartável: `/model <m>` e `/effort <n>` prometem escopo de sessão (`s`, ou
	 *  um confirm de "esta conversa") e as DUAS vezes acabaram escrevendo
	 *  `~/.claude/settings.json` GLOBAL mesmo assim — quatro gravações reais no
	 *  arquivo de configuração do Gabriel, todas revertidas à mão contra o
	 *  `.bak`. Nenhum campo de `Launch` tem hoje um caminho ao vivo que este teste
	 *  não tenha provado arriscado; `tune` diz `unsupported` pra todos até essa
	 *  investigação terminar, em vez de reofertar o mesmo risco. */
	async tune(
	  name: string,
	  launch: Partial<AgentSystem.ValueObjects.Launch>,
	): Promise<AgentSystem.Entities.Agent | Fail> {
	  const rec = await this.locate(name)
	  if (!rec) return this.fail(`não conheço agente \`${name}\``)

	  const pedido = Object.keys(launch)
	  return this.fail(
	    pedido.length
	      ? `\`${pedido.join(', ')}\` não tem tune ao vivo SEGURO nesta casa hoje: /model e /effort MEDIDOS 20/08 escreveram o default GLOBAL em ~/.claude/settings.json em vez de escopar à sessão (achado, não limitação de tempo — ver o cabeçalho de control.ts). Use \`this.restart(name, launch)\` pra aplicar no próximo boot.`
	      : 'tune sem nenhum campo em `launch` não muda nada — não há o que fazer',
	    'unsupported',
	  )
	}
}


/** Naming and splitting a clone off a running pane. */
export class AgentsClone extends AgentsCore {
	/** O sufixo `-N` do nome de um clone, e o nome sem ele. `worker` → base
	 *  `worker`, n 0; `worker-2` → base `worker`, n 2. */
	nomeDoClone(titulo: string): { base: string; n: number } {
	  const m = titulo.trim().match(/^(.*?)-(\d+)$/)
	  return m ? { base: m[1]!.trim(), n: Number(m[2]) } : { base: titulo.trim(), n: 0 }
	}

	/** O nome CURTO que vai pro `/rename`, tirado do título do pane.
	 *
	 *  O título de uma sessão do Claude é a primeira frase do pedido — "Setup
	 *  study_bloom project with bloom standalone" — e mandar isso inteiro num
	 *  `/rename` dentro de um pane de 16% de largura quebra a linha em quatro, e a
	 *  confirmação do `send` não acha o texto que ela mesma digitou (medido 20/08).
	 *  Três palavras e 24 caracteres é o que cabe no pane mais estreito que este
	 *  comando cria, e continua endereçando: ninguém procura o clone pela frase
	 *  inteira, procura pelo começo dela mais o número. */
	baseCurta(titulo: string): string {
	  return titulo
	    .trim()
	    .split(/\s+/)
	    .slice(0, 3)
	    .join('-')
	    .replace(/[^\w-]/g, '')
	    .slice(0, 24)
	    .replace(/-+$/, '')
	}

	/** O próximo número livre entre os panes irmãos — não `n+1` cego.
	 *
	 *  Dois clones disparados na mesma aba com `n+1` nasceriam os dois `-1`, e aí o
	 *  nome deixa de endereçar. Olhar os irmãos é a única fonte que já existe. */
	proximoN(base: string, titulos: string[]): number {
	  const usados = titulos
	    .map((t) => this.nomeDoClone(t))
	    .filter((x) => x.base === base && x.n > 0)
	    .map((x) => x.n)
	  return usados.length ? Math.max(...usados) + 1 : 1
	}

	async esperaTUI(pane: string): Promise<boolean> {
	  const fim = Date.now() + TIMEOUT.tui
	  do {
	    const tela = await readPane(pane, { lines: 12 })
	    // O sinal tem que sobreviver à LARGURA. Um clone de clone fica com ~16% da
	    // tela, e ali a barra de status vira `⏵⏵ ·` — procurar "bypass permissions"
	    // ou "shift+tab" falhava com o TUI já pintado (medido 20/08, 60s de espera
	    // por uma tela que estava pronta). O `⏵⏵` é o primeiro caractere da barra e
	    // é o último a ser cortado.
	    if (tela.ok && /⏵⏵|bypass permissions|shift\+tab|\? for shortcuts/i.test(tela.text)) return true
	    await Bun.sleep(500)
	  } while (Date.now() < fim)
	  return false
	}
}

/** The aggregate. Five faces, one per question you ask the fleet — the outline of
 *  this class is the map, and each face is a class of its own below. */
export class Agents {
	readonly list = new AgentsList(this);
	readonly delegation: AgentsDelegation = new AgentsDelegation(this);
	readonly view = new AgentsView(this);
	readonly control = new AgentsControl(this);
	readonly clone = new AgentsClone(this);
}

/** The one aggregate. Cheap to hold: nothing reaches herdr until a method does. */
export const agents = new Agents();
