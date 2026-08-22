import { result } from '../run.ts'
import { fence } from '../policy.ts'
import { upstream, type Fail } from "@biliboss/shared/result"
import { has, value } from "@biliboss/shared/argv"

export async function split(
  pane: string,
  opts: { direction?: 'right' | 'down'; ratio?: number; cwd?: string; focus?: boolean } = {},
): Promise<{ ok: true; pane: string } | Fail> {
  const fenced = fence(pane)
  if (fenced) return fenced

  const args = ['pane', 'split', pane, '--direction', opts.direction ?? 'right']
  if (opts.ratio) args.push('--ratio', String(opts.ratio))
  if (opts.cwd) args.push('--cwd', opts.cwd)
  args.push(opts.focus ? '--focus' : '--no-focus')

  const out = await result(args)
  if (!out.ok) return upstream(out.error)

  const id = out.result?.pane?.pane_id ?? out.result?.new_pane?.pane_id ?? out.result?.pane_id
  if (!id) return upstream(`herdr split the pane but returned no id: ${JSON.stringify(out.result).slice(0, 200)}`)
  return { ok: true, pane: id }
}

