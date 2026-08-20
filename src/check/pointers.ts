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
import { home } from "../shared/file.ts";

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

const findings: Finding[] = [];

for (const run of runFolders()) {
  for (const name of FILES) {
    const file = join(run.dir, name);
    if (!existsSync(file)) continue;
    for (const { field, target } of pointersOf(readFileSync(file, "utf8"))) {
      // Três formas aparecem em disco e as três valem: relativo à RAIZ da casa (como a
      // casa escreve), relativo ao próprio run, e ABSOLUTO — um `projeto:` pode apontar
      // pra fora daqui (`/Users/…/src/cockpit`), e `join(ROOT, "/abs")` engoliria a raiz
      // e reprovaria um caminho que existe. Foi o primeiro falso positivo deste check.
      const exists = target.startsWith("/")
        ? existsSync(target)
        : existsSync(join(ROOT, target)) || existsSync(join(run.dir, target));
      findings.push({ run: `${run.main}/${run.id}`, file: name, field, target, exists });
    }
  }
}

const dead = findings.filter((finding) => !finding.exists);

// O ACHADO é o ponteiro MORTO, não todo ponteiro: `--jsonl`/`--tsv` saem só com os
// mortos, e o total de ponteiros lidos fica no `--json` como contexto. Emitir os vivos
// junto faria `wc -l` responder "quantos ponteiros existem" quando a pergunta do check
// é "quantos apontam pro vazio".
//
// Sai 1 quando algo aponta pro vazio: é o que faz disto um portão e não um relatório.
process.exit(
  emit(argv, {
    json: { total: findings.length, dead: dead.length },
    findings: dead,
    cols: (f) => [f.run, f.file, f.field, f.target],
    human: () => {
      for (const finding of dead) {
        console.log(`${finding.run}/${finding.file}`);
        console.log(`  ${finding.field}: ${finding.target}`);
        console.log("  ✗ não existe");
      }
      console.log(`${findings.length} ponteiros · ${dead.length} pro vazio`);
    },
  }),
);
