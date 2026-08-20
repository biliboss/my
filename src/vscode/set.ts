//! Escreve a barra lateral: quais pastas, em que ordem, com que rótulo.
//!
//! LER já funciona; ESCREVER recusa e sai 1. O contrato inteiro está declarado em
//! commander — as flags são de verdade, então `my vscode set -h` é o help que o
//! commander renderiza (o mesmo formato do `claude --help`), e não uma foto dele
//! escrita à mão no docstring. Flag que não sobrevive à leitura do próprio help não
//! deveria custar implementação nenhuma.
//!
//! ── por que um verbo novo, e não mais uma flag do `regen` ──────────────────
//!
//! `regen` DESENHA: lê o disco e reescreve o `folders` inteiro obedecendo a
//! escolha guardada. `set` decide QUAL é a escolha. São dois tempos verbais, e
//! misturá-los foi o que produziu `regen --fixa <path>` — um efeito colateral na
//! boca do verbo de redesenhar, que é a única chamada que acontece sozinha.
//!
//! `regen` MORREU em 18/08 e `set` herdou a escrita do `main.code-workspace`:
//! segue existindo UM escritor do array `folders`, só que agora é este. O que
//! morreu junto foi a ideia de barra DERIVADA — blocos que liam o disco e
//! desenhavam seção por conta própria. Metade deles apontava pra pasta que não
//! existe mais (`notificacoes/`, `design/`, `steps/`, `references/`,
//! `templates/`, `scripts/` foram embora na reorganização), e um root
//! inexistente no `folders` é uma linha que não abre. A barra agora é o que
//! alguém DIGITOU, e nada mais.
//!
//! ── pasta com RÓTULO ───────────────────────────────────────────────────────
//!
//! Uma pasta da barra é um par: `{"name": "▸ workflows", "path":
//! "me/02_areas/00_workflows"}`. Sem override o rótulo é o nome da pasta;
//! `<path>:"<label>"` troca, e `<path>:""` volta pro nome da pasta.
//!
//! ── UMA fonte, e os modos compõem depois ──────────────────────────────────
//!
//! `[folder...]`, `--tagged`, `--from` e `--dirty` são quatro maneiras de dizer
//! QUAIS pastas, e são mutuamente exclusivas porque duas fontes na mesma chamada
//! não têm ordem óbvia — `.conflicts()` faz o commander recusar, em vez de a
//! gente escolher uma calado. Os modos (`--top`, `--bottom`, `--at`, `--drop`,
//! `--label`, `--tag`, `--untag`) não são fonte: dizem O QUE FAZER com as pastas
//! que a fonte trouxe.
//!
//! ── por que âncora E índice no `--at` ─────────────────────────────────────
//!
//! Só índice quebra na primeira mudança da lista: `--at 3` aponta pra outro lugar
//! amanhã. Só âncora não deixa dizer "primeiro" sem saber quem é o primeiro.
//!
//! ── TAG 0..N, e é ela que aposenta "layout salvo" ─────────────────────────
//!
//! Uma pasta carrega zero ou mais tags (`me/02_areas:"workflows"@trabalho@dia`),
//! e um LAYOUT passa a ser uma tag: `--tagged trabalho` é a barra do trabalho, sem
//! nenhuma lista congelada em lugar nenhum. Foi o que tirou `--focus` e `--save`
//! daqui — dois verbos a menos, e o conjunto deixa de ter duas grafias (a lista
//! salva e a query) que divergem na primeira mudança.
//!
//! Tag é ADITIVA por natureza — a mesma pasta é `@trabalho` e `@sistema` — então
//! ela é a única coisa aqui que não obriga a escolher. Foco é excludente por
//! natureza: a barra é uma. Duas ideias diferentes, e antes as duas usavam o mesmo
//! mecanismo.
//!
//! ── o ESTADO mora num sqlite em `~/.me` ───────────────────────────────────
//!
//! `~/.me/me.db`, por `bun:sqlite` (embutido no runtime — dependência nova, zero).
//! Três tabelas bastam: `folder(path, label, position)`, `folder_tag(path, tag)`,
//! `sidebar_history(at, json)`.
//!
//! Por que sair do YAML: tag 0..N é relação, e relação em YAML é lista aninhada
//! que só se lê inteira — filtrar por tag viraria varredura em memória a cada
//! chamada. E `UNIQUE(path, tag)` é a chave natural do par, então o banco recusa
//! duplicata na CRIAÇÃO em vez de a gente deduplicar depois.
//!
//! Fora do repo de propósito: `~/.me` é a máquina, não a casa versionada. A barra
//! lateral é estado de UM computador — commitá-la faria toda máquina brigar pelo
//! mesmo arquivo, que é o que `state.yaml` já provoca hoje quando duas sessões
//! trocam o foco.
//!
//! Com o histórico numa tabela, `-` é a linha anterior e `--dry-run` é imprimir
//! sem `INSERT`: nenhum dos dois precisa de código próprio.
//!
//! ── o que ainda não está decidido ─────────────────────────────────────────
//!
//! 1. O override de rótulo sobrevive a um `set` que não cita aquela pasta?
//!    Sobreviver é o que faz valer digitar; não sobreviver é o que mantém a
//!    promessa de que o comando É o estado.
//! 2. `--dirty` varre 173 pastas em `~/src` — `git status` em cada uma é o
//!    comando mais caro da casa. Precisa de teto, e o teto tem que aparecer na
//!    saída, senão lista truncada se lê como completa.
//! 3. `--from <run>` depende de "as pastas que o run cita" ter definição — e o
//!    leitor que saberia montar isso (`src/runs.ts`) já existe, é só ninguém ter
//!    ligado os dois.
//!
//! depends_on: src/shared/db.ts · ~/src/main.code-workspace
//! impacts:    CONTEXT.md · skills/my/SKILL.md

import { Command, Option } from "commander";
import { eq } from "drizzle-orm";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { db } from "../shared/db.ts";
import { folder, folderTag, sidebarHistory } from "../shared/schema.ts";

/** A barra é relativa a `~/src`, não à raiz deste repo: ela mostra pastas de vários
 *  repositórios (`me/…`, `fonseca-mono/…`), e é o que o `main.code-workspace` já usa. */
const SRC_ROOT = join(process.env.HOME!, "src");

/** Overridável pra o teste rodar contra um arquivo descartável — escrever o
 *  workspace de verdade é a única outra forma de testar isto. */
const WS = process.env.WS_FILE ?? join(SRC_ROOT, "main.code-workspace");

/**
 * Reescreve o array `folders` do `main.code-workspace` a partir do banco.
 *
 * O bloco ESCONDIDO (as pastas comentadas) é extraído por CONTEÚDO e recolocado,
 * e as `settings` nunca são tocadas. Cortar até o primeiro `// ---` era o que
 * fazia, e quando outra sessão escrevia o arquivo no meio o resultado eram DOIS
 * arrays `folders` no mesmo JSON.
 */
export function writeWorkspace(list: ReturnType<typeof current>): void {
  const src = readFileSync(WS, "utf8");
  const hidden = src.match(/\t\t\/\* *\n[\s\S]*?\*\//)?.[0] ?? "";
  const arrStart = src.indexOf('"folders": [');
  const arrEnd = src.indexOf("\n\t],", arrStart);
  if (arrStart < 0 || arrEnd < 0) throw new Error(`${WS}: não achei o array folders — formato inesperado`);

  const comment = hidden
    ? `\t\t// ------------------------------------------------------------------\n` +
      `\t\t// ESCONDIDAS, não removidas. VS Code não tem "ocultar pasta raiz" —\n` +
      `\t\t// descomente o bloco e a raiz reaparece.\n` +
      `\t\t// ------------------------------------------------------------------\n${hidden}\n`
    : "";
  const body = list
    .map((f) => {
      // RÓTULO COM ESPAÇO NA FRENTE INDENTA, e o espaço vai ANTES do `▸`.
      //
      // O VS Code não tem pasta aninhada em multi-root — toda raiz é irmã da
      // outra. Espaço no rótulo é o único jeito de mostrar "este código é DESTE
      // projeto", e ele só lê como hierarquia se o marcador andar junto: com o
      // `▸` colado à esquerda, a indentação depois dele parece rótulo torto, não
      // filho.
      const bruto = f.label ?? f.path.split("/").pop()!;
      const recuo = bruto.match(/^ +/)?.[0] ?? "";
      const name = `${recuo}▸ ${bruto.slice(recuo.length)}`;
      return `\t\t{\n\t\t\t"name": ${JSON.stringify(name)},\n\t\t\t"path": ${JSON.stringify(f.path)}\n\t\t},`;
    })
    .join("\n");
  writeFileSync(WS, src.slice(0, arrStart) + '"folders": [\n' + body + "\n\n" + comment + src.slice(arrEnd));
}

/** O comando, declarado — nada aqui executa. É o que o `-h` renderiza. */
export function command(): Command {
  const cmd = new Command("my vscode set")
    .description("Escreve a barra lateral: quais pastas, em que ordem, com que rótulo.")
    .argument(
      "[folder...]",
      'a barra, nesta ordem, relativo a ~/src: `<path>[:"<label>"][@tag...]`. ' +
        "Sem rótulo fica o gerado, que carrega contagem viva; tag é 0..N por pasta. " +
        "Sem argumento, imprime a atual",
    );

  cmd.optionsGroup("Modo (sem nenhum, a lista dada É a barra e o que ela não cita sai):");
  cmd
    .addOption(new Option("-t, --top", "as pastas citadas vão pro topo").conflicts(["bottom", "at", "drop", "label", "tag", "untag"]))
    .addOption(new Option("-b, --bottom", "as pastas citadas vão pro fim").conflicts(["at", "drop", "label", "tag", "untag"]))
    .addOption(
      new Option("-p, --at <where>", "posição: <n> (1-based) · after:<path> · before:<path>").conflicts(["drop", "label", "tag", "untag"]),
    )
    .addOption(new Option("-d, --drop", "manda as citadas pra lista escondida").conflicts(["label", "tag", "untag"]))
    .addOption(new Option("-L, --label", 'só o rótulo muda, nada se move. `<path>:""` volta pro gerado').conflicts(["tag", "untag"]));

  cmd.optionsGroup("Fonte (exclusivas entre si; sem nenhuma, a fonte são os <folder>):");
  cmd
    .addOption(
      new Option("-T, --tagged <tag...>", "as pastas que carregam a tag — a interseção de todas").conflicts([
        "from",
        "dirty",
      ]),
    )
    .addOption(new Option("-F, --from <run>", "as pastas que aquele run cita").conflicts(["tagged", "dirty"]))
    .addOption(new Option("--dirty", "os repos com mudança não commitada").conflicts(["tagged", "from"]));

  cmd.optionsGroup("Tag (0..N por pasta; layout É uma tag):");
  cmd
    .addOption(new Option("--tag", "só as tags mudam, nada se move — soma as `@tag` citadas").conflicts("untag"))
    .addOption(new Option("--untag", "tira as `@tag` citadas; sem nenhuma, tira todas"))
    .option("-l, --list", "as tags que existem, com quantas pastas cada uma");

  cmd.optionsGroup("Saída:");
  cmd
    .option("-n, --dry-run", "imprime a barra que escreveria, não escreve nada")
    .option("--json", "a lista resultante em JSON, com -n ou sem")
    .option("--hidden", "imprime também a lista escondida — onde --drop deixa as coisas");

  return cmd.addHelpText(
    "after",
    "\n  `-` no lugar de <folder> volta pra barra anterior, como `git switch -`.\n" +
      "  Nome que não é pasta em ~/src não escreve nada.\n",
  );
}

/** A barra COMO ESTÁ, do banco: caminho, rótulo quando há override, e as tags.
 *
 *  Uma query com `leftJoin`, e não duas mais um agrupamento em memória: a tag é
 *  0..N, então pasta sem tag tem que aparecer — é `left`, nunca `inner`. */
export function current(): { path: string; label: string | null; tags: string[] }[] {
  const rows = db()
    .select({ path: folder.path, label: folder.label, position: folder.position, tag: folderTag.tag })
    .from(folder)
    .leftJoin(folderTag, eq(folderTag.path, folder.path))
    .where(eq(folder.hidden, false))
    .orderBy(folder.position)
    .all();

  const out = new Map<string, { path: string; label: string | null; tags: string[] }>();
  for (const r of rows) {
    const entry = out.get(r.path) ?? { path: r.path, label: r.label, tags: [] };
    if (r.tag) entry.tags.push(r.tag);
    out.set(r.path, entry);
  }
  return [...out.values()];
}

/** Uma pasta por linha, na ordem da barra — o formato humano.
 *
 *  `--json` sai inteiro pro `jq`; sem flag sai alinhado. É a regra dos formatos
 *  desta casa, e o grão é a PASTA, que é o que alguém vai filtrar. */
function print(list: ReturnType<typeof current>, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }
  const width = Math.max(0, ...list.map((f) => f.path.length));
  for (const f of list) {
    const tags = f.tags.map((t) => `@${t}`).join(" ");
    console.log([f.path.padEnd(width), f.label ? `"${f.label}"` : "", tags].join("  ").trimEnd());
  }
}

/** `<path>[:"<label>"][@tag...]` → as três partes.
 *
 *  A tag sai PRIMEIRO, pela direita: um rótulo pode conter `@` ("agente@casa") e
 *  um caminho não pode conter `:` — então cortar tag antes de rótulo é a única
 *  ordem em que as duas ambiguidades se resolvem sozinhas. */
export function parseToken(token: string): { path: string; label: string | null; tags: string[] } {
  const tags: string[] = [];
  let rest = token;
  for (let at = rest.lastIndexOf("@"); at > 0 && !rest.slice(at).includes('"'); at = rest.lastIndexOf("@")) {
    tags.unshift(rest.slice(at + 1));
    rest = rest.slice(0, at);
  }
  const colon = rest.indexOf(':');
  if (colon < 0) return { path: rest, label: null, tags };
  // `:""` é o DESFAZER do override — string vazia significa "volta pro gerado", e
  // por isso ela chega como `null` e não como "".
  const raw = rest.slice(colon + 1).replace(/^"|"$/g, "");
  return { path: rest.slice(0, colon), label: raw === "" ? null : raw, tags };
}

/** Os modos de escrita. `drop` e `label` não movem a barra — mexem no BANCO. */
export type Modo = "replace" | "top" | "bottom" | "at" | "drop" | "label";

/** Caminho ABSOLUTO vira relativo a `~/src`.
 *
 *  É o que a task do VS Code manda (`${fileDirname}` só existe em absoluto) e é
 *  o que sai de um `pwd`. Guardar o absoluto escreveria um `path` que o
 *  `main.code-workspace` não aceita — lá tudo é relativo à pasta do workspace. */
export const relativo = (p: string) => (p.startsWith(`${SRC_ROOT}/`) ? p.slice(SRC_ROOT.length + 1) : p);

type Item = { path: string; label: string | null; tags: string[] };

/**
 * A barra RESULTANTE, ou uma mensagem de recusa.
 *
 * Separado de `write` porque é a única parte que dá pra testar sem tocar em
 * banco nem em workspace — e é onde mora toda a decisão de ORDEM, que é o que
 * quebra em silêncio quando erra.
 *
 * `--at <n>` é o "space" da barra: 1-based, e o número é o LUGAR. Fora da faixa
 * RECUSA em vez de grudar na ponta — pedir a posição 9 numa barra de 3 e receber
 * a 4ª é o comando decidindo por você, e barra é memória muscular: a pessoa
 * clica onde estava, não onde faz sentido.
 */
export function arranja(before: Item[], citadas: Item[], mode: Modo, at?: string): Item[] | string {
  const outras = before.filter((f) => !citadas.some((p) => p.path === f.path));
  if (mode === "replace") return citadas;
  if (mode === "top") return [...citadas, ...outras];
  if (mode === "bottom") return [...outras, ...citadas];
  if (mode === "drop") return outras;
  // `label` mantém a ORDEM de antes e troca só o rótulo de quem foi citado: é a
  // diferença entre renomear e mover, e misturar as duas é como um rename vira
  // reordenação que ninguém pediu.
  if (mode === "label")
    return before.map((f) => {
      const hit = citadas.find((c) => c.path === f.path);
      return hit ? { ...f, label: hit.label } : f;
    });

  // `at`
  const ancora = /^(after|before):(.+)$/.exec(at ?? "");
  if (ancora) {
    const i = outras.findIndex((f) => f.path === ancora[2]);
    if (i < 0) return `--at ${at}: \`${ancora[2]}\` não está na barra`;
    const corte = ancora[1] === "after" ? i + 1 : i;
    return [...outras.slice(0, corte), ...citadas, ...outras.slice(corte)];
  }
  const n = Number(at);
  if (!Number.isInteger(n) || n < 1) return `--at ${at}: use <n> 1-based, after:<path> ou before:<path>`;
  if (n > outras.length + 1) return `--at ${n}: a barra tem ${outras.length + 1} posição(ões) depois desta chamada`;
  return [...outras.slice(0, n - 1), ...citadas, ...outras.slice(n - 1)];
}

/** Escreve a barra. `mode` decide o que acontece com quem NÃO foi citado:
 *  `replace` tira da barra, `top`/`bottom` mantêm na ordem em que já estavam.
 *
 *  Tudo numa transação, com o snapshot da barra ANTERIOR gravado dentro dela: é o
 *  snapshot que faz `set -` existir, e gravá-lo fora da transação abriria a janela
 *  em que a barra mudou e o desfazer aponta pro estado errado. */
function write(tokens: string[], mode: Modo, opts: { at?: string } = {}): number {
  // Caminho ABSOLUTO vira relativo a `~/src`: é o que a task do VS Code manda
  // (`${fileDirname}` só existe em absoluto) e é o que sai de um `pwd`. Guardar
  // o absoluto no banco escreveria um `path` que o `main.code-workspace` não
  // aceita — lá tudo é relativo à pasta do workspace.
  const parsed = tokens.map(parseToken).map((p) => ({ ...p, path: relativo(p.path) }));
  const missing = parsed.filter((p) => !existsSync(join(SRC_ROOT, p.path)));
  if (missing.length) {
    // Recusa a chamada INTEIRA, não só o item torto: barra meio escrita é pior que
    // barra não escrita, porque ninguém sabe qual metade valeu.
    console.error(`my vscode set: não é pasta em ~/src — ${missing.map((m) => m.path).join(", ")}`);
    return 1;
  }

  const before = current();
  const ordered = arranja(before, parsed, mode, opts.at);
  if (typeof ordered === "string") return (console.error(`my vscode set: ${ordered}`), 1);

  db().transaction((tx) => {
    tx.insert(sidebarHistory).values({ folders: before }).run();
    tx.delete(folder).run(); // `folder_tag` vai junto pelo cascade — daí o pragma.
    // `position` esparso (10, 20, 30…): mover pro meio depois não reescreve a lista.
    tx.insert(folder)
      .values(ordered.map((f, i) => ({ path: f.path, label: f.label, position: (i + 1) * 10 })))
      .run();
    const tags = ordered.flatMap((f) => f.tags.map((tag) => ({ path: f.path, tag })));
    if (tags.length) tx.insert(folderTag).values(tags).run();
  });
  return 0;
}

/** TODO: o que ainda recusa, na ordem em que se sustenta:
 *
 *  TODO 1. --tag / --untag / --tagged / --list
 *  TODO 2. --from / --dirty (os seletores caros, com teto declarado)
 *  TODO 3. `-`, que já tem o histórico gravado esperando por ele
 *
 *  `--at`, `--drop`, `--label` e `--dry-run` saíram desta lista em 19/08, e não
 *  por capricho: os quatro foram pedidos numa sessão real e recusaram. Flag
 *  declarada que recusa é honesta uma vez; na segunda ela é uma promessa. */
export function main(argv: string[]): number {
  const cmd = command().exitOverride();
  try {
    cmd.parse(argv, { from: "user" });
  } catch (err) {
    // `-h` e erro de flag chegam aqui como CommanderError: o `exitOverride` troca
    // o `process.exit` do commander por um throw, e quem decide o código de saída
    // desta casa é o `main` — o router lê o retorno, nunca o exit.
    return (err as { exitCode?: number }).exitCode ?? 1;
  }

  const opts = cmd.opts();
  // Sem argumento e sem fonte, `set` é LEITURA.
  if (!cmd.args.length && !opts.tagged && !opts.from && !opts.dirty) {
    print(current(), Boolean(opts.json));
    return 0;
  }

  const pending = (["tag", "untag", "tagged", "from", "dirty", "list"] as const).find((f) => opts[f]);
  if (pending) {
    console.error(`my vscode set: --${pending} ainda não implementado — \`my vscode set -h\` é o contrato`);
    return 1;
  }

  const mode: Modo = opts.at
    ? "at"
    : opts.drop
      ? "drop"
      : opts.label
        ? "label"
        : opts.top
          ? "top"
          : opts.bottom
            ? "bottom"
            : "replace";

  if (opts.dryRun) {
    // Sem escrever: imprime a barra que SAIRIA. É o que deixa conferir um `set`
    // declarativo ANTES de perder a lista atual — e a lista atual é a única
    // cópia que existe, porque a barra é o que alguém digitou, não derivada.
    const parsed = cmd.args.map(parseToken).map((p) => ({ ...p, path: relativo(p.path) }));
    const saida = arranja(current(), parsed, mode, opts.at);
    if (typeof saida === "string") return (console.error(`my vscode set: ${saida}`), 1);
    print(saida, Boolean(opts.json));
    return 0;
  }

  const code = write(cmd.args, mode, { at: opts.at });
  if (code !== 0) return code;
  const list = current();
  writeWorkspace(list);
  print(list, Boolean(opts.json));
  return 0;
}
