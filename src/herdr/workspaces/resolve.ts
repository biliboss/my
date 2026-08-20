//! Achar UM workspace por id **ou** por label — a função que todo verbo daqui
//! chama primeiro.
//!
//! Label é o que um humano lembra (`casinha`, `cockpit`); id é o que o herdr
//! entrega (`w34`). Aceitar os dois custa uma passada numa lista que já se
//! busca, e o ID É TENTADO PRIMEIRO, então label parecido com id nunca sombreia
//! o real.
//!
//! Dois workspaces podem dividir um label, e essa ambiguidade VOLTA, nunca é
//! chutada — escolher um no chute é como o pane errado morre. Escondido resolve:
//! cortina é filtro de listagem, não afirmação de existência.
//!
//! depends_on: src/herdr/workspaces/list.ts
//! impacts:    src/herdr/workspaces/CONTEXT.md · src/herdr/tabs/create.ts · src/herdr/workspaces/focus.ts · src/herdr/workspaces/block.ts · src/herdr/workspaces/create.ts

import type { Fail } from '../../shared/result.ts'
import { list, type Workspace } from './list.ts'

export async function resolve(key: string): Promise<{ ok: true; workspace: Workspace } | Fail> {
  const out = await list({ includeHidden: true })
  if (!out.ok) return out

  const byId = out.workspaces.find((w) => w.id === key)
  if (byId) return { ok: true, workspace: byId }

  const byLabel = out.workspaces.filter((w) => w.label === key)
  if (byLabel.length === 1) return { ok: true, workspace: byLabel[0]! }
  if (byLabel.length > 1) {
    return {
      ok: false,
      reason: 'ambiguous',
      error: `label "${key}" matches ${byLabel.length} workspaces — use the id`,
      ids: byLabel.map((w) => w.id),
    }
  }

  return { ok: false, reason: 'not_found', error: `unknown workspace: ${key}` }
}
