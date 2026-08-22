//! Todo ponteiro que um run declara aponta pra algo que EXISTE?
//!
//!   bun run src/check/pointers.ts          # o veredito
//!   bun run src/check/pointers.ts --json   # --json | --jsonl | --tsv
//!
//!   --json → { total:int · dead:int · findings:[…] }
//!            catraca: pointers.dead = dead — ABSOLUTA (teto 0)
//!
//! Um run aponta pra fora de si a toda hora: `desenho:` pro call stack da feature,
//! `origem:` pro run que o gerou, `serve:` pra pasta que ele atende, `projeto:` pro
//! projeto. Nenhum desses era verificado — e `check citations` não os pega, porque
//! ele lê citação de MARKDOWN (`@caminho`, link), não campo de yaml.
//!
//! Medido em 17/08, e é o motivo deste arquivo existir: o único `desenho:` do
//! `02_product` apontava pra
//! `01_projects/vscode-terminal-automation/features/my_view.md`, e um refactor da
//! mesma tarde moveu esse arquivo pra `src/extension/CONTEXT.md`. O ponteiro ficou
//! pro vazio por horas, e o ÚNICO sinal foi uma seção sumindo de uma view — em
//! silêncio, que é a forma que ninguém percebe.
//!
//! O que este check NÃO faz: não valida conteúdo, não segue âncora (`#secao`), e não
//! olha ponteiro que mora dentro de lista (`unidades[].branch`, por exemplo — quem
//! mede branch é o git, não o disco). Campo novo entra em `FIELDS` quando doer.
//!
//! depends_on: 02_areas/00_workflows/00_main · src/shared/findings.ts
//! impacts:    src/check/pre-commit · CONTEXT.md

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { emit } from "../shared/findings.ts";
import { home, trees } from "../shared/file.ts";

const ROOT = home();
const MAINS = join(ROOT, "02_areas", "00_workflows", "00_main");

const argv = Bun.argv.slice(2);

/**
 * Os campos que carregam CAMINHO, e só eles.
 *
 * `repo:` fica fora de propósito: é slug do GitHub (`owner/name`), não caminho, e
 * tratá-lo como caminho reprovaria todo run publicado. `work_repo:` também fica
 * fora — ele aponta pra um checkout que pode não existir nesta máquina, e isso é
 * normal, não achado.
 */
const FIELDS = ["desenho", "origem", "serve", "projeto", "contexto", "alvo"] as const;

/** Os arquivos de um run que declaram ponteiro. */
const FILES = ["state.yaml", "sprints.yaml", "input.yaml", "issues.yaml", "interview.yaml"];

type Finding = {
  run: string;
  file: string;
  field: string;
  target: string;
  exists: boolean;
  /** O run já foi PROVADO. Um ponteiro morto num run fechado é registro, não bug. */
  closed: boolean;
};

function runFolders(): { main: string; id: string; dir: string }[] {
  if (!existsSync(MAINS)) return [];
  const found: { main: string; id: string; dir: string }[] = [];
  for (const main of readdirSync(MAINS)) {
    const output = join(MAINS, main, "output");
    if (!existsSync(output)) continue;
    for (const id of readdirSync(output)) {
      const dir = join(output, id);
      if (!/^\d+_/.test(id) || !statSync(dir).isDirectory()) continue;
      found.push({ main, id, dir });
    }
  }
  return found;
}

/**
 * `campo: valor` no TOPO do yaml, sem comentário e sem citação.
 *
 * Só o topo: um `projeto:` aninhado dentro de uma sprint é outro assunto (é o alvo
 * daquela sprint, não do run), e apanhá-lo aqui daria achado que ninguém sabe
 * consertar.
 */
function pointersOf(yaml: string): { field: string; target: string }[] {
  const found: { field: string; target: string }[] = [];
  for (const line of yaml.split("\n")) {
    const match = /^([a-z_]+):\s*(.+)$/i.exec(line);
    if (!match) continue;
    const field = match[1];
    if (!FIELDS.includes(field as (typeof FIELDS)[number])) continue;
    const target = match[2]
      .replace(/\s+#.*$/, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    // `null`, vazio, prosa de uma linha, slug de repo e URL não são caminho.
    if (!target || target === "null" || target.includes(" ") || target.startsWith("http")) continue;
    if (!target.includes("/")) continue;
    found.push({ field, target: target.replace(/#.*$/, "") });
  }
  return found;
}

/** UM RUN FECHADO É REGISTRO, e registro não tem obrigação de continuar
 *  resolvendo. `prova:` no `state.yaml` é o carimbo de fechamento desta casa — um
 *  run só a ganha quando alguém provou o resultado.
 *
 *  A DISTINÇÃO NASCEU DE UM CASO REAL, 20/08: a extensão do VS Code foi removida
 *  por decisão, e três runs de `02_product` que a construíram passaram a apontar
 *  pro vazio. Os ponteiros estão CERTOS — aquele run trabalhou em `src/extension`,
 *  e naquele dia ele existia. Reescrevê-los seria falsificar o registro, e manter o
 *  check vermelho seria dizer que nenhum código desta casa pode ser deletado sem
 *  reescrever a história.
 *
 *  O ACHADO QUE IMPORTA continua sendo o do run ABERTO: ali o alvo mudou de lugar
 *  enquanto o trabalho corre, e quem moveu não estava editando o arquivo que
 *  aponta. Foi assim que o `desenho:` do 980 ficou pro vazio por horas em 17/08,
 *  com uma seção de view sumindo como único sinal. */
function fechado(dir: string): boolean {
  const state = join(dir, "state.yaml");
  if (!existsSync(state)) return false;
  return /^prova:\s*\S/m.test(readFileSync(state, "utf8"));
}

const findings: Finding[] = [];

for (const run of runFolders()) {
  for (const name of FILES) {
    const file = join(run.dir, name);
    if (!existsSync(file)) continue;
    for (const { field, target } of pointersOf(readFileSync(file, "utf8"))) {
      // Quatro formas aparecem em disco e as quatro valem: relativo à RAIZ da casa
      // (como a casa escreve), relativo ao próprio run, relativo ao CHECKOUT DO
      // CÓDIGO, e ABSOLUTO — um `projeto:` pode apontar pra fora daqui
      // (`/Users/…/src/cockpit`), e `join(ROOT, "/abs")` engoliria a raiz e
      // reprovaria um caminho que existe. Foi o primeiro falso positivo deste check.
      //
      // A DO CÓDIGO ENTROU EM 20/08, e o segundo falso positivo é o que a pediu: o
      // código saiu desta casa pro `biliboss/my`, e três runs de 02_product apontam
      // `projeto: src/extension`. Os ponteiros estão CERTOS — aquele projeto era
      // `src/extension` — e reescrevê-los pra caber num resolvedor de uma raiz só
      // seria falsificar registro. Quem estava errado era o resolvedor.
      const exists = target.startsWith("/")
        ? existsSync(target)
        : trees().some((t) => existsSync(join(t, target))) || existsSync(join(run.dir, target));
      findings.push({ run: `${run.main}/${run.id}`, file: name, field, target, exists, closed: fechado(run.dir) });
    }
  }
}

// Só o run ABERTO derruba. O fechado sai na lista com a marca, porque silêncio se
// lê como "não achei" — e alguém vai querer saber que aquele run aponta pra código
// que não existe mais.
const dead = findings.filter((finding) => !finding.exists && !finding.closed);
const arquivados = findings.filter((finding) => !finding.exists && finding.closed);

// O ACHADO é o ponteiro MORTO, não todo ponteiro: `--jsonl`/`--tsv` saem só com os
// mortos, e o total de ponteiros lidos fica no `--json` como contexto. Emitir os vivos
// junto faria `wc -l` responder "quantos ponteiros existem" quando a pergunta do check
// é "quantos apontam pro vazio".
//
// Sai 1 quando algo aponta pro vazio: é o que faz disto um portão e não um relatório.
process.exit(
  emit(argv, {
    json: { total: findings.length, dead: dead.length, arquivados: arquivados.length },
    findings: dead,
    cols: (f) => [f.run, f.file, f.field, f.target],
    human: () => {
      for (const finding of dead) {
        console.log(`${finding.run}/${finding.file}`);
        console.log(`  ${finding.field}: ${finding.target}`);
        console.log("  ✗ não existe");
      }
      // O ARQUIVADO APARECE, e não derruba. Silêncio se lê como "não achei", e
      // alguém vai querer saber que um run fechado aponta pra código que não
      // existe mais — só não é isso que segura um commit.
      for (const f of arquivados) console.log(`· ${f.run}/${f.file}  ${f.field}: ${f.target}  (run fechado)`);
      console.log(
        `${findings.length} ponteiros · ${dead.length} pro vazio` +
          (arquivados.length ? ` · ${arquivados.length} em run fechado (não derruba)` : ""),
      );
    },
  }),
);
