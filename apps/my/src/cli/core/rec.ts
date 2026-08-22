//! Roda o arquivo como PROCESSO, pro script que ainda não exporta `main`.
//!
//! ISTO ERA O ESCRITOR DE RECIBOS, e ele morreu em 17/08 junto com `_events/`.
//! O que ele fazia: uma pasta por execução de comando, com `state.yaml` e
//! `result.yaml` dizendo quem rodou, quando e com que exit. Gerou 151 pastas e
//! 3,3 MB, e o que se aprendeu com elas foi zero — o `git log` já diz o que
//! mudou, e a pasta do run já diz o que o ciclo decidiu. Recibo de leitura era
//! registro de ruído sobre ruído.
//!
//! O golpe final foi medido: as 10 tasks do lote de código de 17/08 deviam ter
//! deixado um recibo cada, o contrato pedia, o prompt do agente citava — e
//! saíram ZERO. Regra que ninguém cumpre e nada verifica não é regra.
//!
//! O que substitui: **o commit é o relatório** (#commit_is_the_report) e a pasta
//! do run é o rastro (`output/NNN_<slug>/`).
//!
//! impacts: src/cli/core/router.ts

import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ME = process.env.ME_ROOT ?? join(import.meta.dir, "../../..");

/** Roda o arquivo como PROCESSO. É o degrau: script que ainda não exporta
 *  `main` continua funcionando, e o dia em que o último migrar esta função sai
 *  junto com o único `bun` que sobrou dentro da CLI. */
export function spawn(script: string, args: string[]): number {
  // `env` EXPLÍCITO, e não o default de herdar. Medido 22/08: o roteador escreve
  // `MY_HERDR_HOST` em `process.env` durante a execução (é o `--remote`), e o
  // filho subia SEM ele — o default herda o bloco de ambiente com que o processo
  // NASCEU, não o mutado. O sintoma foi o pior possível: `my herdr workspaces
  // list --remote fonseca-vps` respondeu a lista LOCAL, com exit 0.
  const r = spawnSync("bun", ["run", join(ME, "src", script), ...args], {
    stdio: "inherit",
    cwd: ME,
    env: { ...process.env },
  });
  return r.status ?? 1;
}
