//! O PANE DA OUTRA CAIXA, DENTRO DO HERDR DAQUI — uma aba local cujo conteúdo é
//! o terminal que está rodando na VPS.
//!
//!     bun run src/herdr/panes/mirror.ts fonseca-vps w3D:p1 --workspace a2a
//!     bun run src/herdr/panes/mirror.ts fonseca-vps w3D:p1 --label a2a-vps
//!
//! `--workspace <label>` é o que quase sempre se quer: workspace de lá vira
//! WORKSPACE aqui, criado se não existir, e o espelho vai no pane raiz dele. Sem
//! ele o espelho nasce como ABA do workspace corrente — que é onde ninguém
//! procura por uma máquina remota.
//!
//! É O QUE FALTAVA PRA "REMOTO" SER USÁVEL. `--remote <host>` (@src/cli/core/router.ts)
//! deixa um comando AGIR na outra caixa, e isso resolve script. Não resolve olhar:
//! um agente rodando lá é invisível daqui, e agente que ninguém vê é agente cujo
//! travamento só aparece quando alguém vai procurar. O espelho põe o pane de lá
//! na mesma tela dos daqui.
//!
//! ESTE VERBO FALA COM AS DUAS CAIXAS, e é o único que faz isso — por isso ele
//! IGNORA `MY_HERDR_HOST` na metade local. A aba tem que nascer AQUI mesmo quando
//! quem chamou passou `--remote`; criar a aba lá e mandar ela espelhar a si mesma
//! é um comando que sai 0 e não mostra nada.
//!
//! O ESPELHO É SOMENTE LEITURA na prática, e o plano de dados roda SEM daemon —
//! `herdr-mirror` abre um ssh e transmite o conteúdo do pane remoto. Medido em
//! 03/08: funciona de primeira, e o `process-info` do pane local mostra `ssh` +
//! `herdr-mirror`. Se o ssh cai, cai a JANELA, não o agente de lá.
//!
//! IDS DE PANE SÃO POR HOST. `w3D:p1` aqui e `w3D:p1` na VPS são panes diferentes
//! em máquinas diferentes, e nada avisa — por isso o host é ARGUMENTO POSICIONAL
//! e não uma flag opcional: quem espelha é obrigado a dizer de onde.
//!
//! depends_on: src/herdr/run.ts · src/herdr/tabs/create.ts · src/shared/argv.ts
//! impacts:    src/herdr/panes/CONTEXT.md

import { run } from '../run.ts'
import { create } from '../tabs/create.ts'
import { create as createWorkspace } from '../workspaces/create.ts'
import { resolve } from '../workspaces/resolve.ts'
import { upstream, type Fail } from '../../shared/result.ts'
import { value } from '../../shared/argv.ts'

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
      if (!rodou.ok) return upstream(rodou.error)
      return { ok: true, pane: novo.pane, tab: novo.pane, workspace: novo.id }
    }
    workspace = found.workspace.id
  }

  const tab = await local(() => create({ workspace, label: opts.label ?? `${pane}@${host}` }))
  if (!tab.ok) return tab

  const cmd = `${MIRROR} pane ${host} ${pane} --remote-bin '${opts.remoteBin ?? 'herdr'}'`
  const out = await local(() => run(['pane', 'run', tab.pane, cmd]))
  if (!out.ok) return upstream(out.error)

  return { ok: true, pane: tab.pane, tab: tab.id }
}

if (import.meta.main) {
  const [host, pane] = Bun.argv.slice(2).filter((a) => !a.startsWith('-'))
  if (!host || !pane) {
    console.error('usage: mirror.ts <host> <pane-id> [--label <l>] [--workspace <w>] [--remote-bin <path>]')
    process.exit(2)
  }
  const out = await mirror(host, pane, {
    label: value('label'),
    workspace: value('workspace'),
    remoteBin: value('remote-bin'),
  })
  if (!out.ok) {
    console.error(`✗ ${out.error}`)
    process.exit(1)
  }
  console.log(`${out.workspace ? `${out.workspace} ` : ''}${out.pane}\t${pane}@${host}`)
  process.exit(0)
}
