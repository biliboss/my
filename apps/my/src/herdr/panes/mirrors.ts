#!/usr/bin/env bun
//! QUAIS PANES DAQUI SÃO ESPELHO DE OUTRA CAIXA, e se o fio ainda está de pé.
//!
//!     bun run src/herdr/panes/mirrors.ts                  # os espelhos, com o estado
//!     bun run src/herdr/panes/mirrors.ts w3D:p1           # ESTE pane remoto tem espelho?
//!     bun run src/herdr/panes/mirrors.ts --json
//!
//! O ESTADO VEM DO PROCESSO, NÃO DE UM REGISTRO NOSSO. `herdr pane process-info`
//! devolve o argv vivo do pane, e o espelho aparece ali literalmente —
//! `herdr-mirror pane fonseca-vps w3D:p1`. Guardar um `mirrors.json` ao lado
//! seria um segundo registro do mesmo fato, e o dia em que o ssh cai sem ninguém
//! avisar é justamente o dia em que os dois discordam.
//!
//! `LIVE` EXIGE OS DOIS PROCESSOS. O `herdr-mirror` sozinho é o supervisor: ele
//! continua no pane depois que o `ssh` morre, e um pane com a última tela
//! congelada é indistinguível de um pane que ninguém tocou. Por isso `DEAD` não
//! é ausência do espelho — é o espelho presente com o transporte caído.
//!
//! E `DEAD` É INSTANTÂNEO, NÃO CRÔNICO. Medido 22/08: matando o `ssh` de um
//! espelho, a leitura imediata sai `DEAD` (exit 1) e a de três segundos depois
//! sai `live` de novo, com PID novo — o supervisor reconecta sozinho. Então um
//! `DEAD` isolado é uma reconexão em curso; o que significa problema é o mesmo
//! pane saindo `DEAD` em leituras seguidas.
//!
//! SEMPRE LOCAL. Espelho é uma coisa DAQUI, então este verbo ignora
//! `MY_HERDR_HOST`: perguntar "quem está espelhado" pra caixa de lá responde
//! outra pergunta com cara de resposta. Quem quiser o inverso pergunta de lá.
//!
//! Sai 1 quando um espelho existe e está `dead`, e 0 quando todos vivos — assim
//! um script consegue reagir sem reparsear texto.
//!
//! depends_on: src/herdr/run.ts · src/shared/argv.ts
//! impacts:    src/herdr/panes/mirror.ts · src/herdr/panes/CONTEXT.md

import { mirrors } from "@my/herdr/panes/mirrors";
import { has } from "@my/shared/argv";

if (import.meta.main) {
  const alvo = Bun.argv.slice(2).find((a) => !a.startsWith('-'))
  const out = await mirrors()
  if (!out.ok) {
    console.error(`✗ ${out.error}`)
    process.exit(1)
  }

  // Um pane remoto como argumento vira FILTRO, e a ausência dele é resposta:
  // "não está espelhado" é o que alguém pergunta antes de espelhar.
  const rows = alvo ? out.mirrors.filter((m) => m.remote === alvo || `${m.host}:${m.remote}` === alvo) : out.mirrors

  if (has('json')) console.log(JSON.stringify(rows, null, 2))
  else if (!rows.length) console.log(alvo ? `${alvo} NÃO tem espelho nesta caixa` : 'nenhum espelho nesta caixa')
  else for (const m of rows) console.log(`${m.pane}\t${m.host}\t${m.remote}\t${m.live ? 'live' : 'DEAD'}`)

  process.exit(rows.some((m) => !m.live) ? 1 : 0)
}
