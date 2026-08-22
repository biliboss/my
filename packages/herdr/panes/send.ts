import { did, host } from '../run.ts'
import { read } from './read.ts'
import { fence } from '../policy.ts'
import { upstream, type Fail } from "@my/shared/result"
import { has } from "@my/shared/argv"

/**
 *  Só o Enter, num pane que já tem o texto.
 *
 *  Existe porque com N panes o certo é mandar TODO o texto, esperar, e só então
 *  submeter todos — dois passes. Ver o comentário no `run.ts` do `00_compare`: com
 *  nove panes, texto-e-Enter pane por pane deixou oito parados, e mandar os Enter
 *  em rajada também aproxima os instantes de largada, que é o que a comparação
 *  precisa.
 */
export async function submit(pane: string): Promise<{ ok: true; pane: string } | Fail> {
  const fenced = fence(pane)
  if (fenced) return fenced

  const out = await did(['pane', 'send-keys', pane, 'enter'])
  return out.ok ? { ok: true, pane } : upstream(out.error ?? 'herdr failed')
}

/** Quanto se espera o texto APARECER na tela antes de bater o Enter.
 *
 *  O NÚMERO DOBRA NO REMOTO, e não por conforto: a espera é feita LENDO o pane, e
 *  cada leitura contra `--remote` é uma ida e volta de ssh. Medido 22/08 contra
 *  `fonseca-vps`: o texto chegou, os 5000ms acabaram antes de a leitura confirmar,
 *  e o verbo recusou com "Enter NÃO foi enviado" — deixando exatamente o pane
 *  digitado-e-parado que este bloco inteiro existe pra impedir. O espelho
 *  (`mirror.ts`) foi o que mostrou o texto lá, com o comando dizendo que falhou. */
const ARRIVAL_MS = () => (host() ? 20_000 : 5_000)
/** Quantas vezes se insiste no Enter quando o texto não saiu do prompt. */
const ENTER_TRIES = 3
/** A janela do fim da tela onde a CAIXA DE ENTRADA vive — medida no TUI do Claude
 *  Code: as duas réguas, a linha do prompt e a barra de status cabem em 6.
 *
 *  Seis e não dez porque o Claude Code re-imprime a mensagem JÁ ENVIADA logo acima
 *  da caixa: uma janela grande pega esse eco e leria "ainda no prompt" um texto que
 *  foi submetido. Errei exatamente assim ao medir isto. */
const PROMPT_LINES = 6

/**
 * O pedaço do texto que a confirmação procura na tela.
 *
 * A ÚLTIMA linha, e só o fim dela: se o fim chegou, tudo antes dele chegou junto
 * — é a ordem em que o terminal ingere. Curto de propósito, porque um pane
 * estreito QUEBRA a linha e um match do texto inteiro nunca casaria.
 */
export function tail(text: string): string {
  const line = text.split('\n').filter((l) => l.trim()).pop() ?? text
  return line.trim().slice(-40)
}

/** Tira a QUEBRA que o pane inseriu, pra comparar texto com texto.
 *
 *  Um pane de 80 colunas parte a linha onde a largura acaba, não onde o texto
 *  tem sentido — então o `needle` (os últimos 40 chars) quase sempre ATRAVESSA
 *  uma quebra na tela, e um `includes` cru nunca casa. Medido 19/08: cinco sends
 *  recusados em sequência, com o texto visivelmente na tela dos cinco.
 *
 *  Isso é por que a confirmação NÃO pode ser o `--match` do `wait-output`: ele
 *  casa do lado do servidor, contra a tela como ela está quebrada. A normalização
 *  tem que acontecer aqui, dos dois lados da comparação.
 *
 *  E ela REMOVE o espaço em vez de colapsar. Colapsar (`\s+` → ' ') deixa UM
 *  espaço onde o terminal quebrou a linha, e aí um id partido no meio
 *  (`…fd9e-4` + quebra + `6db…`) vira `…fd9e-4 6db…`, que não casa com o texto
 *  enviado. Medido 20/08 num pane de 40% de largura: o texto estava na tela, e o
 *  Enter foi recusado três vezes. Sem espaço nenhum dos dois lados, quebra de
 *  tela deixa de existir pra comparação. */
const flat = (s: string) => s.replace(/\s+/g, '')

/** O texto está na tela? Lê e compara normalizado, até o prazo. */
async function onScreen(pane: string, needle: string, timeoutMs: number, janela = PROMPT_LINES): Promise<boolean> {
  const alvo = flat(needle)
  const fim = Date.now() + timeoutMs
  do {
    const out = await read(pane, { lines: janela })
    if (out.ok && flat(out.text).includes(alvo)) return true
    await Bun.sleep(150)
  } while (Date.now() < fim)
  return false
}

/** O texto saiu do prompt? Lê o fim da tela; erro de leitura conta como "não sei". */
async function leftThePrompt(pane: string, needle: string): Promise<boolean> {
  const out = await read(pane, { lines: PROMPT_LINES })
  return out.ok ? !flat(out.text).includes(flat(needle)) : false
}

/** Espera o texto SUMIR do fim da tela, e não uma vez só.
 *
 *  Medido 20/08 clonando uma sessão: `claude -r <id>` leva alguns segundos até
 *  pintar o TUI, e nesse meio-tempo a linha que o shell ecoou continua nas
 *  últimas seis linhas — com o comando JÁ rodando. Uma checagem única lia isso
 *  como "não submeteu", batia mais Enter, e no fim recusava um envio que tinha
 *  dado certo. O comando lento é o caso normal, não a exceção. */
async function waitLeftThePrompt(pane: string, needle: string, timeoutMs: number): Promise<boolean> {
  const fim = Date.now() + timeoutMs
  do {
    if (await leftThePrompt(pane, needle)) return true
    await Bun.sleep(200)
  } while (Date.now() < fim)
  return false
}

export async function send(
  pane: string,
  text: string,
  // `window`: quantas linhas do fim da tela a confirmação lê. O padrão serve pro
  // prompt de shell e pra caixa do Claude; um SLASH COMMAND precisa de mais — o
  // menu de autocomplete que ele abre empurra a linha digitada pra fora das seis
  // (medido 20/08: `/rename` recusado com o texto visível na tela).
  opts: { enter?: boolean; window?: number } = {},
): Promise<{ ok: true; pane: string; enter: boolean } | Fail> {
  const fenced = fence(pane)
  if (fenced) return fenced

  // `did` e não `result` nas DUAS: `send-text` e `send-keys` respondem com
  // stdout VAZIO quando dão certo, e exigir JSON transformava um envio que
  // funcionou em `herdr printed no JSON:` — medido em 17/08, com o prompt
  // digitado e não submetido nos dois panes de uma comparação.
  const typed = await did(['pane', 'send-text', pane, text])
  if (!typed.ok) return upstream(typed.error ?? 'herdr failed')

  const enter = opts.enter !== false
  if (!enter) return { ok: true, pane, enter }

  const needle = tail(text)

  // AQUI MORAVA UM `Bun.sleep(400)`, e ele falhou duas vezes.
  //
  // Em 17/08 nove panes receberam o texto e OITO ficaram com ele digitado e não
  // submetido — `send-keys` respondeu ok nos nove. O sleep de 400ms foi a
  // correção, e 400 era o menor valor que funcionava NAQUELA carga. Em 19/08,
  // com cinco agentes e um repo maior, ele perdeu de novo: quatro workers
  // ficaram parados com uma ordem na tela, todos com `rc=0` no send.
  //
  // Sleep cego não é confirmação, é uma aposta calibrada num dia. Então o Enter
  // só sai depois que o texto APARECE na tela — e se ele não aparecer, este
  // verbo falha em vez de bater Enter no escuro. O sintoma que isso mata é o pior
  // possível: sucesso em toda chamada e um agente parado com a pergunta na tela,
  // indistinguível de um agente pensando.
  const arrival = ARRIVAL_MS()
  if (!(await onScreen(pane, needle, arrival, opts.window))) {
    return upstream(`o texto não apareceu em ${pane} em ${arrival}ms — Enter NÃO foi enviado`)
  }

  // E confirma que SAIU. Um Enter que o TUI engoliu responde ok igual, então a
  // prova é o prompt ficar limpo. Insiste com espera crescente: um Enter a mais
  // num prompt já vazio é inofensivo, um texto não submetido não é.
  for (let attempt = 1; attempt <= ENTER_TRIES; attempt++) {
    const pressed = await did(['pane', 'send-keys', pane, 'enter'])
    if (!pressed.ok) return upstream(pressed.error ?? 'herdr failed')
    if (await waitLeftThePrompt(pane, needle, attempt * 2_000)) return { ok: true, pane, enter }
  }

  return upstream(`${pane}: o texto continua no prompt depois de ${ENTER_TRIES} Enter`)
}

