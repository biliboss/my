import { result } from '../run.ts'
import { fence } from '../policy.ts'
import { resolve } from '../workspaces/resolve.ts'
import { upstream, type Fail } from "@my/shared/result"
import { value } from "@my/shared/argv"

export async function create(
  opts: { workspace?: string; label?: string; cwd?: string; env?: Record<string, string> } = {},
): Promise<{ ok: true; id: string; pane: string } | Fail> {
  let workspace = opts.workspace
  if (workspace) {
    const found = await resolve(workspace)
    if (!found.ok) return found
    const fenced = fence(found.workspace.id)
    if (fenced) return fenced
    workspace = found.workspace.id
  }

  const args = ['tab', 'create']
  if (workspace) args.push('--workspace', workspace)
  if (opts.label) args.push('--label', opts.label)
  if (opts.cwd) args.push('--cwd', opts.cwd)
  for (const [k, v] of Object.entries(opts.env ?? {})) args.push('--env', `${k}=${v}`)

  const out = await result(args)
  if (!out.ok) return upstream(out.error)

  const id = out.result?.tab?.tab_id ?? out.result?.root_pane?.tab_id
  const pane = out.result?.root_pane?.pane_id
  if (!id || !pane) return upstream('herdr created a tab but returned no id')
  // O pane volta JUNTO com a aba porque `agent start` precisa de um, e pedir de
  // novo é um segundo round-trip e uma segunda chance de corrida.
  return { ok: true, id, pane }
}

