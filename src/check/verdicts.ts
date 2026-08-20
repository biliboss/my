//! Todo veredito de QA declara o RECORTE que ele mediu?
//!
//!   bun run src/check/verdicts.ts          # o veredito sobre os vereditos
//!   bun run src/check/verdicts.ts --json   # pro jq
//!
//!   --json → { total:int · findings:[…] }
//!            (fora da catraca — nenhuma medida sai deste --json)
//!
//! Um `veredito:` num run de `03_qa` é a frase mais forte que esta casa escreve: ela
//! atravessa pro comentário da issue e daí pro cliente. E ela é escrita num campo de
//! uma palavra, que não carrega sobre O QUÊ foi medido.
//!
//! Medido em 19/08, e é o motivo deste arquivo existir. O `998_meta_ads_afericao`
//! gravou `veredito: nao_reproduzido` pra #178. A aferição estava impecável — controle
//! negativo forçado, três telas distintas fotografadas — e ESCREVEU no achado que o
//! recorte não era o do cliente: mediu `period=all`, um agregado de todo o histórico,
//! contra uma reclamação sobre 12/08. No dia seguinte alguém leu o `state.yaml`, não o
//! achado, e disse ao dono que o Meta estava bem. Estava quebrado: o pull não havia
//! rodado em 11/08, a véspera da reclamação, e três de cinco jobs do Dagster falhavam.
//!
//! O `qa_issue_proof` JÁ proibia isso, em prosa, na linha 23: "Reproducing on a
//! different period than the client used produces exactly that: a confident verdict
//! about a screen nobody complained about." A regra existia e foi violada — então o
//! que falta não é regra, é PORTÃO. Regra que ninguém cumpre e nada verifica não é
//! regra, e essa lição esta casa já pagou uma vez com `_events/`.
//!
//! Por isso o portão é estrutural em vez de mais um parágrafo: `nao_reproduzido` fica
//! IMPOSSÍVEL de escrever sobre uma janela que não foi medida. Quem não cobre a
//! reclamação tem um veredito só disponível — `bloqueado` — e ele é honesto.
//!
//! O que este check NÃO faz: não julga se o `escopo` está certo (ninguém do lado de
//! fora sabe qual período o cliente abriu — é justamente o que se pergunta a ele), e
//! não olha run que não seja de `03_qa`, porque `veredito` fora de aferição é outra
//! palavra com o mesmo nome.
//!
//! depends_on: 02_areas/00_workflows/00_main/03_qa
//! impacts:    src/check/pre-commit · 02_areas/00_workflows/00_main/03_qa/references/qa_issue_proof.md

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { home } from "../shared/file.ts";

const ROOT = home();
const QA = join(ROOT, "02_areas", "00_workflows", "00_main", "03_qa", "output");

const argv = Bun.argv.slice(2);
const wantsJson = argv.includes("--json");

/**
 * Os dois campos que um veredito precisa ao lado, e o porquê de serem DOIS.
 *
 * `escopo` é descritivo — o recorte medido, em texto (`period=all, tenant=fia`). Ele
 * existe pra quem lê depois. `cobre_a_reclamacao` é o booleano, e é ele que o portão
 * consegue apertar: humano nenhum lê "period=all" e conclui sozinho que isso não
 * contém 12/08 — mas escrever `false` é uma decisão que a pessoa toma de olhos abertos.
 */
const ESCOPO = "escopo";
const COBRE = "cobre_a_reclamacao";

/** O veredito que MENTE quando o recorte não cobre a reclamação. Os outros dois não. */
const FRAGIL = "nao_reproduzido";

/**
 * Os três vereditos de AFERIÇÃO, e só eles. `veredito:` é palavra reusada: o
 * `qa_proof` a usa pra PR (`aprovado` / `reprovado`), e PR não tem janela de
 * reclamação pra cobrir — cobrar `cobre_a_reclamacao` de uma aprovação de PR é
 * pedir um campo que não tem resposta possível.
 *
 * Foi o primeiro falso positivo deste check: o `996_pr183_linkedin` reprovou por
 * não declarar o recorte de uma reclamação que nunca existiu.
 */
const AFERICAO = ["reproduzido", FRAGIL, "bloqueado"] as const;

type Finding = { run: string; file: string; line: number; veredito: string; problema: string };

function qaRuns(): { id: string; dir: string }[] {
  if (!existsSync(QA)) return [];
  return readdirSync(QA)
    .filter((id) => /^\d+_/.test(id) && statSync(join(QA, id)).isDirectory())
    .map((id) => ({ id, dir: join(QA, id) }));
}

const indentOf = (line: string) => line.length - line.trimStart().length;

/**
 * O BLOCO que contém um `veredito:` — do pai dele até o próximo irmão do pai.
 *
 * Um `state.yaml` de aferição carrega VÁRIOS vereditos, um por issue aferida (o 998
 * tem três: o do topo, `issue_180:` e `issue_182:`). Olhar só o topo do arquivo, como
 * o `check pointers` faz de propósito, deixaria dois de cada três passarem — e o
 * segundo veredito de um run é tão publicado quanto o primeiro.
 */
function blockOf(lines: string[], at: number): string[] {
  const depth = indentOf(lines[at]);
  let start = at;
  while (start > 0 && indentOf(lines[start - 1]) >= depth) start--;
  let end = at;
  while (end + 1 < lines.length) {
    const next = lines[end + 1];
    if (next.trim() && indentOf(next) < depth) break;
    end++;
  }
  return lines.slice(start, end + 1).filter((line) => indentOf(line) === depth);
}

const findings: Finding[] = [];
let total = 0;

for (const run of qaRuns()) {
  const file = join(run.dir, "state.yaml");
  if (!existsSync(file)) continue;
  const lines = readFileSync(file, "utf8").split("\n");

  for (const [index, line] of lines.entries()) {
    // `veredito_anterior:` é REGISTRO de um veredito corrigido, não uma afirmação
    // viva — cobrar escopo dele obrigaria a reescrever a história pra passar no check.
    const match = /^(\s*)veredito:\s*(.+)$/.exec(line);
    if (!match) continue;
    const veredito = match[2].replace(/\s+#.*$/, "").trim();
    if (!veredito || veredito === "null") continue;
    if (!AFERICAO.includes(veredito as (typeof AFERICAO)[number])) continue;
    total++;

    const siblings = blockOf(lines, index);
    // `declara`, não `has`: isto pergunta se o BLOCO do veredito traz um campo,
    // e nada aqui lê a linha de comando. O nome `has` fez este arquivo aparecer na
    // varredura do helper de flag em `src/shared/argv.ts` como se fosse a nona
    // cópia dele — não era, e o nome era o único motivo.
    const declara = (field: string) => siblings.some((s) => s.trimStart().startsWith(`${field}:`));
    const cobre = siblings
      .find((s) => s.trimStart().startsWith(`${COBRE}:`))
      ?.split(":")[1]
      ?.replace(/\s+#.*$/, "")
      .trim();

    const where = { run: run.id, file: "state.yaml", line: index + 1, veredito };

    if (!declara(ESCOPO)) {
      findings.push({ ...where, problema: `sem \`${ESCOPO}:\` — não se sabe o que foi medido` });
    }
    if (!declara(COBRE)) {
      findings.push({ ...where, problema: `sem \`${COBRE}:\` — não se sabe se mediu a janela da reclamação` });
    } else if (veredito === FRAGIL && cobre !== "true") {
      // O achado que este arquivo existe pra pegar, e o único que é ERRO e não lacuna.
      findings.push({
        ...where,
        problema: `\`${FRAGIL}\` com \`${COBRE}: ${cobre}\` — fora da janela do cliente o veredito honesto é \`bloqueado\``,
      });
    }
  }
}

if (wantsJson) {
  console.log(JSON.stringify({ total, findings }, null, 2));
} else {
  for (const finding of findings) {
    console.log(`03_qa/${finding.run}/${finding.file}:${finding.line}`);
    console.log(`  veredito: ${finding.veredito}`);
    console.log(`  ✗ ${finding.problema}`);
  }
  console.log(`${total} vereditos · ${findings.length} sem recorte declarado`);
}

// Sai 1 e não 0: um veredito sem recorte é publicável, e é isso que o torna caro.
process.exit(findings.length ? 1 : 0);
