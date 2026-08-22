import { result } from '../run.ts'
import { upstream, type Fail } from "@biliboss/shared/result"

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

