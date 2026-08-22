import { result } from '../run.ts'
import { upstream, type Fail } from "@my/shared/result"
import { resolve } from './resolve.ts'
import { close } from './close.ts'
import { has, value } from "@my/shared/argv"

export async function create(
  label: string,
  opts: { cwd?: string; focus?: boolean; restart?: boolean } = {},
): Promise<{ ok: true; id: string; label: string; pane: string } | Fail> {
  const taken = await resolve(label)
  if (taken.ok && opts.restart) {
    const gone = await close(taken.workspace.id)
    if (!gone.ok) return gone
  } else if (taken.ok || taken.reason === 'ambiguous') {
    // Ambíguo também é tomado — duas vezes. E ambíguo NÃO reinicia: fechar "o"
    // workspace quando existem dois é escolher um no escuro.
    return {
      ok: false,
      reason: 'ambiguous',
      error: `label "${label}" is already taken${opts.restart ? ' — and --restart refuses to pick between duplicates' : ''}`,
    }
  }

  const args = ['workspace', 'create', '--label', label]
  if (opts.cwd) args.push('--cwd', opts.cwd)
  if (opts.focus) args.push('--focus')

  const out = await result(args)
  if (!out.ok) return upstream(out.error)

  // O envelope carrega o workspace novo três vezes (`workspace`, `tab`,
  // `root_pane`); o primeiro é a autoridade, o pane é o fallback.
  const id = out.result?.workspace?.workspace_id ?? out.result?.root_pane?.workspace_id
  if (!id) return upstream('herdr created a workspace but returned no id')

  // O pane raiz volta JUNTO porque o herdr já abriu uma aba com ele — quem
  // criar outra deixa a primeira vazia pendurada na tela (visto em 17/08).
  const pane = out.result?.root_pane?.pane_id
  if (!pane) return upstream('herdr created a workspace but returned no root pane')
  return { ok: true, id, label, pane }
}

