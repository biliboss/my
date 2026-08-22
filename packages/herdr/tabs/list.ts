import { result } from '../run.ts'
import { upstream, type Fail } from "@biliboss/shared/result"

export type Tab = {
  /** Sempre `<workspace>:<tab>`, ex. `w1R:t2` — o id carrega o pai. */
  id: string
  label: string
  number: number
  focused: boolean
  status: string
  panes: number
  workspace: string
}

export async function list(workspace?: string): Promise<{ ok: true; tabs: Tab[] } | Fail> {
  const out = await result(['tab', 'list', ...(workspace ? ['--workspace', workspace] : [])])
  if (!out.ok) return upstream(out.error)

  const raw = out.result?.tabs
  if (!Array.isArray(raw)) return upstream('herdr returned no tab list')

  return {
    ok: true,
    tabs: raw.map((t: any) => ({
      id: t.tab_id,
      label: t.label ?? '',
      number: t.number ?? 0,
      focused: Boolean(t.focused),
      status: t.agent_status ?? 'unknown',
      panes: t.pane_count ?? 0,
      workspace: t.workspace_id,
    })),
  }
}

