//! Abre um workspace sob um label.
//!
//!     my herdr workspaces create cockpit --cwd ~/src/me --focus
//!     my herdr workspaces create workflows --cwd ~/src/me --restart
//!     my herdr workspaces create a2a --cwd /root/my --remote fonseca-vps --mirror
//!
//! ELE NUNCA SOBE AGENTE. O que nasce é um workspace com uma aba e um pane de
//! SHELL — quem põe agente ali é `my herdr agents start`, um verbo separado, e a
//! separação é deliberada: criar é barato e reversível, subir agente gasta
//! contexto e credencial. Não existe `--no-agent` porque não existe o contrário.
//!
//! `--mirror` só faz sentido com `--remote`, e é a razão de ele existir aqui em
//! vez de virar dois comandos: um workspace criado na outra caixa é invisível
//! daqui até alguém espelhar, e o passo que se esquece é sempre o segundo. Com
//! ele, criar e ver são a mesma chamada. Confira depois com
//! `my herdr panes mirrors`.
//!
//! Label repetido é RECUSADO, e isso é a regra de chave natural do @CLAUDE.md
//! aplicada aqui: o label é o que o `resolve` casa, então dois workspaces
//! dividindo um transformam toda chamada seguinte numa ambiguidade que ninguém
//! pediu. Dedup na CRIAÇÃO, nunca depois.
//!
//! `--restart` FECHA o que tem aquele label e abre de novo. É a saída pro caso
//! comum de workspace de máquina — um que existe pra rodar trabalho e cujo
//! estado é lixo entre uma rodada e outra. Sem ele o jeito de recomeçar era
//! fechar à mão e lembrar do `--cwd`, e foi assim que em 17/08 um agente subiu
//! na pasta errada: recriar tinha atrito, então ninguém recriou.
//!
//! A cerca do `policy.ts` vale: `--restart` num workspace bloqueado FALHA, e é
//! pra falhar. Bloquear existe justamente pra que um verbo destrutivo pare.
//!
//! depends_on: src/herdr/run.ts · src/herdr/workspaces/resolve.ts · src/shared/argv.ts
//! impacts:    src/herdr/workspaces/CONTEXT.md

import { result } from '../run.ts'
import { upstream, type Fail } from '../../shared/result.ts'
import { resolve } from './resolve.ts'
import { close } from './close.ts'
import { has, value } from '../../shared/argv.ts'

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

if (import.meta.main) {
  const [label] = Bun.argv.slice(2)
  if (!label) {
    console.error('usage: create <label> [--cwd <path>] [--focus] [--restart] [--mirror]')
    process.exit(2)
  }
  const host = process.env.MY_HERDR_HOST
  if (has('mirror') && !host) {
    // Recusa em vez de ignorar a flag: espelhar a caixa local nela mesma é um
    // comando que sai 0 e não faz nada, e nada é o resultado mais difícil de
    // notar.
    console.error('--mirror precisa de --remote <host>: não há o que espelhar da caixa local')
    process.exit(2)
  }

  const out = await create(label, {
    cwd: value('cwd'),
    focus: has('focus'),
    restart: has('restart'),
  })
  if (!out.ok) {
    console.error(`✗ ${out.error}`)
    process.exit(1)
  }
  console.log(`${out.id} ${out.pane}`)

  if (has('mirror')) {
    const { mirror } = await import('../panes/mirror.ts')
    const espelho = await mirror(host!, out.pane, { label: `${label}@${host}` })
    // O workspace JÁ existe neste ponto, então falhar aqui não é falhar tudo: o
    // exit conta a segunda metade, e a linha acima já disse o que ficou de pé.
    console.log(espelho.ok ? `${espelho.pane}\t${out.pane}@${host}` : `✗ espelho: ${espelho.error}`)
    process.exit(espelho.ok ? 0 : 1)
  }
  process.exit(0)
}
