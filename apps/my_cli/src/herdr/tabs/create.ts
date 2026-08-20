//! Abre uma aba.
//!
//!     bun run src/herdr/tabs/create.ts --workspace cockpit --label revisao
//!
//! O workspace é resolvido por id OU label antes de qualquer coisa, então a
//! cerca é checada contra o id real e não contra o que foi digitado.
//!
//! Sem `--workspace` o herdr usa a que está em foco. Certo pra um humano no
//! terminal, errado pra script: passe explícito quando for código.
//!
//! depends_on: src/herdr/run.ts · src/herdr/policy.ts · src/herdr/workspaces/resolve.ts · src/shared/argv.ts
//! impacts:    src/herdr/agents/start.ts

import { result } from '../run.ts'
import { fence } from '../policy.ts'
import { resolve } from '../workspaces/resolve.ts'
import { upstream, type Fail } from '../../shared/result.ts'
import { value } from '../../shared/argv.ts'

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

if (import.meta.main) {
  const out = await create({ workspace: value('workspace'), label: value('label'), cwd: value('cwd') })
  console.log(out.ok ? `${out.id} ${out.pane}` : `✗ ${out.error}`)
  process.exit(out.ok ? 0 : 1)
}
