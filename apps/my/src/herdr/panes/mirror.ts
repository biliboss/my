#!/usr/bin/env bun
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

import { mirror } from "@biliboss/herdr/panes/mirror";
import { value } from "@biliboss/shared/argv";

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
