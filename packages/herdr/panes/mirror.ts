import { run } from '../run.ts'
import { create } from '../tabs/create.ts'
import { create as createWorkspace } from '../workspaces/create.ts'
import { resolve } from '../workspaces/resolve.ts'
import { upstream, type Fail } from "@biliboss/shared/result"
import { value } from "@biliboss/shared/argv"

/** Onde o binário do espelho mora NESTA máquina. Caminho absoluto de propósito:
 *  ele é instalado fora de qualquer gerenciador, e um `command not found` aqui
 *  vira "o espelho não funciona" quando o problema era o `PATH`. */
const MIRROR = `${process.env.HOME}/.local/bin/herdr-mirror`

/** Roda a metade LOCAL com `MY_HERDR_HOST` fora do caminho, e devolve o ambiente
 *  como estava. Restaurar importa: um processo da CLI pode rodar mais de uma
 *  chamada, e deixar o host apagado faria a próxima falar com a caixa errada —
 *  silenciosamente, que é o modo de falha que este arquivo inteiro evita. */
async function local<T>(fn: () => Promise<T>): Promise<T> {
  const saved = process.env.MY_HERDR_HOST
  delete process.env.MY_HERDR_HOST
  try {
    return await fn()
  } finally {
    if (saved !== undefined) process.env.MY_HERDR_HOST = saved
  }
}

export async function mirror(
  host: string,
  pane: string,
  opts: { label?: string; workspace?: string; remoteBin?: string } = {},
): Promise<{ ok: true; pane: string; tab: string; workspace?: string } | Fail> {
  if (!/^w[A-Za-z0-9]+:p\d+$/.test(pane)) {
    return upstream(`\`${pane}\` não é id de pane — a forma é \`w3D:p1\`, e ela vale na caixa ${host}, não nesta`)
  }

  // UM WORKSPACE DE LÁ VIRA UM WORKSPACE AQUI, e não uma aba no que estava
  // aberto. Medido 22/08: espelhar sem isto pendurou `a2a@fonseca-vps` como aba
  // dentro de `me`, e a barra lateral — que é onde se procura por workspace —
  // seguia com três nomes locais. O espelho existia e não estava onde alguém
  // olharia por ele, que na prática é não existir.
  let workspace = opts.workspace
  if (workspace) {
    const found = await local(() => resolve(workspace!))
    if (!found.ok) {
      const novo = await local(() => createWorkspace(workspace!, { focus: false }))
      if (!novo.ok) return novo
      workspace = novo.id
      // O workspace já nasce com um pane de shell; o espelho vai pra ELE, e não
      // numa aba a mais — senão a primeira fica pendurada vazia.
      const cmd = `${MIRROR} pane ${host} ${pane} --remote-bin '${opts.remoteBin ?? 'herdr'}'`
      const rodou = await local(() => run(['pane', 'run', novo.pane, cmd]))
      if (!rodou.ok) return upstream(rodou.error ?? "herdr failed")
      return { ok: true, pane: novo.pane, tab: novo.pane, workspace: novo.id }
    }
    workspace = found.workspace.id
  }

  const tab = await local(() => create({ workspace, label: opts.label ?? `${pane}@${host}` }))
  if (!tab.ok) return tab

  const cmd = `${MIRROR} pane ${host} ${pane} --remote-bin '${opts.remoteBin ?? 'herdr'}'`
  const out = await local(() => run(['pane', 'run', tab.pane, cmd]))
  if (!out.ok) return upstream(out.error ?? "herdr failed")

  return { ok: true, pane: tab.pane, tab: tab.id }
}

