//! Os workspaces do herdr, achatados e vestindo as marcas desta casa.
//!
//!     bun run src/herdr/workspaces/list.ts               os visíveis
//!     bun run src/herdr/workspaces/list.ts --hidden      com os que a cortina esconde
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
}

export async function list(opts: { includeHidden?: boolean } = {}): Promise<{ ok: true; workspaces: Workspace[] } | Fail> {
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

  // A cortina cai por último: `--hidden` é o que torna `unhide` alcançável, já
  // que ninguém desconde um id que não consegue mais ver.
  return { ok: true, workspaces: workspaces.filter((w) => opts.includeHidden || !w.hidden) }
}

if (import.meta.main) {
  const out = await list({ includeHidden: has('hidden') })
  if (!out.ok) {
    console.error(`✗ ${out.error}`)
    process.exit(1)
  }
  for (const w of out.workspaces) {
    const mark = w.blocked ? '⊘' : w.hidden ? '·' : ' '
    console.log(`${mark} ${w.id.padEnd(6)} ${w.label.padEnd(24)} ${w.status.padEnd(8)} ${w.tabs}t ${w.panes}p`)
  }
}
