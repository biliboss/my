//! As abas do herdr, achatadas.
//!
//!     bun run src/herdr/tabs/list.ts          todas
//!     bun run src/herdr/tabs/list.ts w3K      só as de um workspace
//!
//! Um id de aba é SEMPRE `<workspace>:<tab>` — `w1R:t2` — então o id carrega o
//! pai e nada aqui precisa ser informado de qual workspace é. É esse fato que
//! deixa a superfície inteira plana.
//!
//! Sem cerca: ler não muda nada, e um workspace bloqueado é exatamente o que
//! alguém quer OLHAR sem tocar.
//!
//! depends_on: src/herdr/run.ts
//! impacts:    src/herdr/tabs/CONTEXT.md

import { result } from '../run.ts'
import { upstream, type Fail } from '../../shared/result.ts'

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

if (import.meta.main) {
  const out = await list(Bun.argv[2])
  if (!out.ok) {
    console.error(`✗ ${out.error}`)
    process.exit(1)
  }
  for (const t of out.tabs) console.log(`${t.id.padEnd(10)} ${t.label.padEnd(24)} ${t.status.padEnd(8)} ${t.panes}p`)
}
