//! Todo pane em que o herdr vê um agente rodando.
//!
//!     my herdr agents list
//!
//! "Agente" aqui é o do HERDR: um pane com um agente interativo dentro,
//! `claude` ou outro. Uma palavra, um significado — ela já era do herdr em toda
//! outra ferramenta desta máquina.
//!
//! Esta é a metade VIVA da frota. A outra — o que os runs declaram em
//! `agentes[]` — NÃO TEM MAIS LEITOR: o `fleet.ts` que as cruzava morreu com o
//! `src/sandbox/` em 17/08. O número que importa (agente vivo sem linha em run
//! nenhum é ÓRFÃO) hoje não é calculado por ninguém — na primeira vez que ele
//! doer de novo, o lugar dele é aqui, não numa segunda pasta.
//!
//! depends_on: src/herdr/run.ts
//! impacts: src/herdr/agents/roster.ts

import { result } from '../run.ts'
import { upstream, type Fail } from '../../shared/result.ts'

export type Agent = {
  /** Que programa o herdr detectou no pane: `claude`, `codex`, … */
  agent: string
  status: string
  title: string
  /** DISPLAY: o cwd de quem está no FOREGROUND agora — pode ser um subprocesso
   *  que o agente chamou, e por isso muda durante a vida do pane. */
  cwd: string
  /** ONDE O AGENTE NASCEU, e não muda depois — é a chave que os três vendors
   *  usam pra nomear a própria pasta de sessão (`~/.claude/projects/<slug>/`
   *  e semelhantes). Adicionado 20/08 pro `View.log` de `src/agents/view.ts`:
   *  usar `cwd` (foreground) ali resolvia o slug ERRADO sempre que o agente
   *  tinha um subprocesso em foreground — medido contra um pane real. */
  launchCwd: string
  pane: string
  tab: string
  workspace: string
  /** A sessão do próprio agente, quando ele expõe uma. */
  session?: string
}

export async function list(): Promise<{ ok: true; agents: Agent[] } | Fail> {
  const out = await result(['agent', 'list'])
  if (!out.ok) return upstream(out.error)

  const raw = out.result?.agents
  if (!Array.isArray(raw)) return upstream('herdr returned no agent list')

  return {
    ok: true,
    agents: raw.map((a: any) => ({
      agent: a.agent ?? 'unknown',
      status: a.agent_status ?? 'unknown',
      // O título "stripped" é o sem o glifo de status do próprio herdr.
      title: a.terminal_title_stripped ?? a.terminal_title ?? '',
      cwd: a.foreground_cwd ?? a.cwd ?? '',
      launchCwd: a.cwd ?? a.foreground_cwd ?? '',
      pane: a.pane_id,
      tab: a.tab_id,
      workspace: a.workspace_id,
      session: a.agent_session?.value,
    })),
  }
}

if (import.meta.main) {
  const out = await list()
  if (!out.ok) {
    console.error(`✗ ${out.error}`)
    process.exit(1)
  }
  for (const a of out.agents) console.log(`${a.pane.padEnd(10)} ${a.agent.padEnd(8)} ${a.status.padEnd(8)} ${a.title.slice(0, 42)}`)
}
