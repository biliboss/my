#!/usr/bin/env bun
//! Cria a próxima sprint de um projeto — uma PASTA, e as tasks nascem dentro dela.
//!
//!     my sprints new "registry serves images locally" -P local-registry
//!     my sprints new "…" -f serve_images_locally
//!     my sprints new "…" -n 997
//!
//! `01_projects/<proj>/sprints/NNN_<slug>/CONTEXT.md`. O NNN CONTA PRA BAIXO
//! DESDE 999: mais novo = número menor = primeiro num `ls`, que é a convenção da
//! casa e o que põe a sprint que se está planejando agora no topo da sidebar. A
//! task dentro dela conta pra CIMA desde 001, porque lá o número É a ordem de
//! execução — #sprint_order_and_size.
//!
//! O NNN É O ENDEREÇO: `-n` num número ocupado RECUSA em vez de empurrar os
//! vizinhos, igual `my tasks new --priority`. Renumerar quebra toda citação.
//!
//! SLUG DE ATÉ 5 PALAVRAS, uma a mais que a task: a sprint nomeia um PACOTE de
//! capacidades, e as regras de nome são as mesmas — #task_naming.
//!
//! depends_on: src/sprints/model.ts · src/tasks/new.ts · src/shared/template.ts
//! impacts:    src/tasks/new.ts · 03_resources/templates/system/sprint/CONTEXT.md

import { Command } from 'commander'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROJETOS, RAIZ, lembra, projetoCorrente, projetos, rel } from '../tasks/model.ts'
import { criticaDoNome, nomeDePasta } from '../tasks/new.ts'
import { PRIMEIRA, proximoNNN, sprints, sprintsDir } from './model.ts'
import { doTemplate } from '../shared/template.ts'

const TPL = join(RAIZ, '03_resources/templates/system/sprint')
/** O teto de palavras do slug da sprint. Uma a mais que a task porque um pacote
 *  de capacidades precisa de uma palavra pra dizer o pacote. */
const MAX_PALAVRAS = 5

// O strip do que é do MOLDE e o `type` do que NASCE: @src/shared/template.ts

export function command(): Command {
  const cmd = new Command('new')
    .description('Cria a próxima sprint do projeto — uma pasta, e as tasks nascem dentro dela.')
    .argument('<titulo>', 'a CAPACIDADE do pacote, no presente, até 7 palavras — #task_naming')
    .option('-P, --project <slug>', 'o projeto. Passado uma vez, fica lembrado — senão vem do cwd')
    .option('-f, --folder <slug>', `o slug da pasta, no imperativo, até ${MAX_PALAVRAS} palavras. Omitido, sai do título`)
    .option('-n, --number <nnn>', `o número da sprint. Ocupado, RECUSA — o NNN é endereço. Omitido, conta pra cima desde ${PRIMEIRA}`)
  cmd.addHelpText(
    'after',
    `\n  A sprint e a task contam pra CIMA desde ${PRIMEIRA}: o número é a ordem em que se fez.\n  O teto de 10 min é a SOMA das durations das tasks: \`my sprints list\` soma e acusa.\n  Depois: my tasks new "<título>" -d <min> -p "<prova>"\n`,
  )
  return cmd
}

export function main(argv: string[]): number {
  const cmd = command().exitOverride()
  try {
    cmd.parse(argv, { from: 'user' })
  } catch (err) {
    return (err as { exitCode?: number }).exitCode ?? 1
  }
  const [titulo] = cmd.args
  const opts = cmd.opts()

  const { slug, porque } = projetoCorrente(opts.project)
  if (!slug)
    return console.error(
      `de que projeto é esta sprint? passe \`-P <slug>\` (fica lembrado), ou rode de dentro de 01_projects/<slug>/\n  existem: ${projetos().join(', ')}`,
    ), 1
  const dir = join(PROJETOS, slug)
  if (!existsSync(dir)) return console.error(`projeto não existe: 01_projects/${slug}/ (veio de ${porque})\n  existem: ${projetos().join(', ')}`), 1
  if (porque !== 'último usado') lembra(slug)

  const nome = opts.folder ?? nomeDePasta(titulo!, MAX_PALAVRAS)
  const critica = criticaDoNome(nome, MAX_PALAVRAS)
  if (critica) {
    console.error(`slug de sprint recusado: "${nome}" — ${critica}`)
    console.error(`  o que eu geraria do título: ${nomeDePasta(titulo!, MAX_PALAVRAS) || '(nada — o título é só stopword)'}`)
    console.error('  a forma inteira, com vinte exemplos: `my resources task_naming`')
    return 1
  }

  const n = opts.number ? Number(opts.number) : proximoNNN(slug)
  // O TETO é o do NOME (três dígitos), não o `PRIMEIRA`: desde que a contagem
  // virou pra cima, `PRIMEIRA` é 1, e usá-lo como limite recusava toda sprint a
  // partir da segunda — medido 20/08, `-S 002` respondeu "inteiro entre 1 e 1".
  if (!Number.isInteger(n) || n < 1 || n > 999)
    return console.error(`--number é inteiro entre 1 e 999, veio: ${opts.number ?? n}`), 1
  const nnn = String(n).padStart(3, '0')
  const ocupada = sprints(slug).find((s) => s.nnn === nnn)
  // Recusa em vez de empurrar: renumerar vizinha pra abrir espaço quebra toda
  // citação a ela — e a citação de uma sprint é a issue e o branch.
  if (ocupada) return console.error(`${nnn} já é ${ocupada.pasta} — o NNN é endereço, não posição. Escolha outro, ou omita e leve o próximo.`), 1

  const raiz = sprintsDir(slug)
  const pasta = join(raiz, `${nnn}_${nome}`)
  mkdirSync(raiz, { recursive: true })
  try {
    mkdirSync(pasta) // sem `recursive`: EEXIST é a trava atômica contra duas sessões
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return console.error(`já existe: ${rel(pasta)}`), 1
    throw e
  }

  // O `#` por REGEX e não por texto literal: `replace` de placeholder literal
  // falha CALADO quando a redação do template muda, e a pasta nasce titulada com
  // o próprio placeholder.
  const ctx = doTemplate(readFileSync(join(TPL, 'CONTEXT.md'), 'utf8'), 'sprint').replace(/^#\s+<.*>$/m, `# ${titulo}`)
  writeFileSync(join(pasta, 'CONTEXT.md'), ctx)

  console.log(rel(join(pasta, 'CONTEXT.md')))
  console.log(`projeto ${slug} (${porque}) · sprint ${nnn} · próxima será ${String(n + 1).padStart(3, '0')}`)
  console.log(`a primeira task: my tasks new "<título>" -S ${nnn} -d <min> -p "<prova>"`)
  return 0
}

if (import.meta.main) process.exit(main(process.argv.slice(2)))
