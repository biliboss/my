//! O mapa NOME → pane dos agentes que esta casa subiu.
//!
//! Existe porque o herdr não devolve o nome. `herdr agent start <nome>` aceita um,
//! e `herdr agent list` não traz de volta — nem pros agentes que ele mesmo
//! nomeou (medido em 17/08: as quatorze chaves do envelope, e `name` não está
//! entre elas). Sem este arquivo, falar com um agente exige saber o id do pane, que
//! é exatamente a dificuldade que a CLI não deve expor.
//!
//! EM DISCO, e pelo mesmo motivo da cerca em `policy.ts`: um mapa que evapora no
//! restart obriga quem voltou a redescobrir o id do pane olhando a tela — e aí a
//! CLI volta a falar id.
//!
//! O agente MORTO some daqui na primeira listagem que não o encontra. Nome que
//! aponta pra pane que já morreu é pior que nome nenhum: `say` num pane recém
//! reciclado escreve no agente errado.
//!
//! O ESTADO DE MÁQUINA MUDOU DE CASA em 20/08: era `_data/` DENTRO do checkout, e
//! agora é `~/.me/` via `home.store()`. Enquanto código e casa eram a mesma pasta o
//! erro não aparecia; publicado o código, um roster de panes desta máquina viraria
//! arquivo de repositório — e sumiria no primeiro clone. `adopt()` muda o que já
//! existe, uma vez, sem apagar a origem.
//!
//! depends_on: src/herdr/agents/list.ts
//! impacts:    src/herdr/agents/cli.ts

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { adopt, code } from '../../home/paths.ts'

import { list } from './list.ts'

const STORE = () => adopt(join(code(), '_data', 'agents.json'), 'agents')

export type Entry = { pane: string; workspace: string; at: string }
type Roster = Record<string, Entry>

function load(): Roster {
  try {
    return JSON.parse(readFileSync(STORE(), 'utf8'))
  } catch {
    // Arquivo ausente e arquivo corrompido querem dizer a mesma coisa — nenhum
    // agente conhecido — e é o estado em que o sistema começa.
    return {}
  }
}

function save(roster: Roster): void {
  mkdirSync(dirname(STORE()), { recursive: true })
  writeFileSync(STORE(), JSON.stringify(roster, null, 2))
}

/** OS NOMES GUARDADOS, sem falar com o herdr e sem reconciliar nada.
 *
 *  `roster()` logo abaixo é a leitura NORMAL — ela cruza com a frota viva e
 *  esquece quem sumiu, o que é certo pra "quem posso cutucar agora". Mas ela tem
 *  dois efeitos que um leitor às vezes não pode pagar: devolve `[]` inteiro
 *  quando o herdr está fora, e APAGA entradas na passagem. Quem só quer saber
 *  como um agente se chama — o cartão A2A, entre outros — precisa da resposta
 *  que sobrevive à frota estar fechada. */
export function stored(): Roster {
  return load()
}

export function remember(name: string, pane: string): void {
  const roster = load()
  roster[name] = { pane, workspace: pane.split(':')[0]!, at: new Date().toISOString() }
  save(roster)
}

export function forget(names: string[]): void {
  const roster = load()
  for (const n of names) delete roster[n]
  save(roster)
}

/**
 *  Os nomes conhecidos, RECONCILIADOS com o que o herdr diz estar vivo.
 *
 *  A reconciliação é o ponto: o herdr é a verdade sobre quem existe, este arquivo é
 *  a verdade sobre como se chama. Quem sumiu de um sai do outro na mesma passada —
 *  sem passo de limpeza, sem cron, sem comando de manutenção.
 */
export async function roster(): Promise<{ name: string; pane: string; status: string; agent: string; title: string }[]> {
  const live = await list()
  if (!live.ok) return []

  const known = load()
  const alive = new Set(live.agents.map((a) => a.pane))
  const stale = Object.entries(known)
    .filter(([, e]) => !alive.has(e.pane))
    .map(([n]) => n)
  if (stale.length) forget(stale)

  return live.agents.map((a) => ({
    name: Object.entries(known).find(([, e]) => e.pane === a.pane)?.[0] ?? '—',
    pane: a.pane,
    status: a.status,
    agent: a.agent,
    title: a.title,
  }))
}

/** Onde mora o agente chamado `name`, ou nada. */
export async function paneOf(name: string): Promise<string | undefined> {
  return (await roster()).find((a) => a.name === name)?.pane
}
