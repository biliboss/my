//! Os workspaces do herdr, achatados e vestindo as marcas desta casa.
//!
//!     my herdr workspaces list                   os visíveis
//!     my herdr workspaces list --hidden          com os que a cortina esconde
//!     my herdr workspaces list --agents          com quantos agentes cada um tem
//!     my herdr workspaces list --empty           só os que não têm agente nenhum
//!     my herdr workspaces list --staffed         só os que têm
//!     my herdr workspaces list --empty --remote fonseca-vps
//!
//! `--agents` custa uma segunda chamada ao herdr, então é opt-in. O `status` do
//! workspace NÃO responde isto: ele fica `unknown` num workspace sem agente
//! nenhum, que é a mesma coisa que um agente que ninguém conseguiu classificar.
//!
//! O envelope cru é `{id, result: {type, workspaces: [...]}}` com snake_case e um
//! `worktree` aninhado. Achatar AQUI, e não em quem chama, mantém a forma nossa:
//! um upgrade do herdr que renomeia campo é uma edição.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts · src/shared/argv.ts
//! impacts:    src/herdr/workspaces/resolve.ts · src/herdr/workspaces/close.ts

import { result } from '../run.ts'
import { marks, type Mark } from '../policy.ts'
import { upstream, type Fail } from '../../shared/result.ts'
import { has } from '../../shared/argv.ts'
import { list as agents } from '../agents/list.ts'

export type Workspace = {
  id: string
  label: string
  number: number
  focused: boolean
  /** Vocabulário do próprio herdr: idle | working | blocked | done | unknown. */
  status: string
  tabs: number
  panes: number
  /** Só existe quando o workspace está amarrado num checkout. */
  repo?: { name: string; path: string; linked: boolean }
  blocked?: Mark
  hidden?: Mark
  /** How many live agents sit in it. `undefined` when the agent list could not be
   *  read — which is not the same as zero, and must not print as zero. */
  agents?: number
}

export async function list(
  opts: { includeHidden?: boolean; withAgents?: boolean } = {},
): Promise<{ ok: true; workspaces: Workspace[] } | Fail> {
  const out = await result(['workspace', 'list'])
  if (!out.ok) return upstream(out.error)

  const raw = out.result?.workspaces
  if (!Array.isArray(raw)) return upstream('herdr returned no workspace list')

  const { blocked, hidden } = marks()
  const workspaces: Workspace[] = raw.map((w: any) => ({
    id: w.workspace_id,
    label: w.label,
    number: w.number,
    focused: Boolean(w.focused),
    // Enum aberto de propósito: um status que o herdr adicionar amanhã chega
    // verbatim em vez de ser achatado em 'unknown' e perdido.
    status: w.agent_status ?? 'unknown',
    tabs: w.tab_count ?? 0,
    panes: w.pane_count ?? 0,
    repo: w.worktree
      ? { name: w.worktree.repo_name, path: w.worktree.checkout_path, linked: Boolean(w.worktree.is_linked_worktree) }
      : undefined,
    blocked: blocked[w.workspace_id],
    hidden: hidden[w.workspace_id],
  }))

  // Counting agents is a second call to herdr, so it only happens when asked.
  // `w.status` does NOT answer this: it stays `unknown` on a workspace that has
  // no agent at all, which reads the same as an agent nobody could classify.
  if (opts.withAgents) {
    const fleet = await agents()
    if (fleet.ok) {
      const per = new Map<string, number>()
      for (const a of fleet.agents) per.set(a.workspace, (per.get(a.workspace) ?? 0) + 1)
      for (const w of workspaces) w.agents = per.get(w.id) ?? 0
    }
  }

  // A cortina cai por último: `--hidden` é o que torna `unhide` alcançável, já
  // que ninguém desconde um id que não consegue mais ver.
  return { ok: true, workspaces: workspaces.filter((w) => opts.includeHidden || !w.hidden) }
}

if (import.meta.main) {
  const empty = has('empty')
  const staffed = has('staffed')
  if (empty && staffed) {
    console.error('--empty e --staffed pedem coisas opostas: escolha uma')
    process.exit(2)
  }

  const out = await list({ includeHidden: has('hidden'), withAgents: empty || staffed || has('agents') })
  if (!out.ok) {
    console.error(`✗ ${out.error}`)
    process.exit(1)
  }

  let rows = out.workspaces
  if (empty) rows = rows.filter((w) => w.agents === 0)
  if (staffed) rows = rows.filter((w) => (w.agents ?? 0) > 0)

  for (const w of rows) {
    const mark = w.blocked ? '⊘' : w.hidden ? '·' : ' '
    // `—` and not `0` when the count is missing: the fleet could not be read, and
    // printing zero would state something nobody measured.
    const crew = w.agents === undefined ? '' : ` ${w.agents === 0 ? '—' : `${w.agents}a`}`
    console.log(`${mark} ${w.id.padEnd(6)} ${w.label.padEnd(24)} ${w.status.padEnd(8)} ${w.tabs}t ${w.panes}p${crew}`)
  }

  if (empty || staffed) console.log(`\n${rows.length} de ${out.workspaces.length} ${empty ? 'sem agente' : 'com agente'}`)
}
