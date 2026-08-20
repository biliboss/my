//! O que os checks de markdown compartilham: a espécie de um arquivo, a lista do que
//! o repo tem, e o carimbo `type:` do frontmatter.
//!
//! Mora em `src/shared/` e não em `src/check/`, e a razão é o `my check all`: a varredura
//! varre `src/check/*.ts` e rodava este arquivo como se fosse um check que não diz
//! nada. Filtrar por "quem exporta `main`" quebrou CINCO checks de uma vez —
//! `citations`, `context`, `rules`, `notes` e `pointers` são script de TOPO, sem
//! `main` nenhum. A pasta era o erro: @src/CONTEXT.md diz que `shared/` é primitiva
//! com DOIS chamadores, e esta tem quatro.
//!
//! depends_on: 03_resources/notes/2026-08-14T0111Z_okf-so-obriga-o-type-o-resto-e-recomendacao.md
//! impacts:    src/check/okf.ts · src/check/resources.ts · src/check/maps.ts · src/check/ratchet.ts

import { existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { home } from "./file.ts";

/** Reexportado porque quatro checks já importavam ROOT daqui; o VALOR é o de
 *  `file.ts#home`, a raiz da CASA — não a do checkout que roda este código. */
export const ROOT = home();

/** The house's `type` vocabulary, and the PATH that already declares it.
 *
 *  Nothing here is invented: every rule was read off the disk shapes, and the
 *  order is specific → general because the first match wins. `sprints/<n>/CONTEXT.md`
 *  is a sprint and everything else under it is a task — the shape the 18/08
 *  migration left ("a sprint é PASTA, a task nasce dentro dela").
 *
 *  `doc` is the catch-all, and it is REPORTED rather than hidden: a file nothing
 *  classifies is either a folder shape nobody wrote down or a file in the wrong
 *  place, and both are findings. `component`, `research` and `issue` exist because
 *  they SHOWED UP in that bucket — 143 files called `doc` was not a vocabulary,
 *  it was a place to not look. */
const TYPES: [RegExp, string][] = [
	[/^00_inbox\//, "request"],
	[/^META\.md$/, "meta"],
	[/SKILL\.md$/, "skill"],
	// Os registros ANTES das pastas que os contêm: um artefato de run debaixo de
	// `02_areas/…/output/` é run, não workflow.
	[/(?:^|\/)_events\//, "event"],
	[/(?:^|\/)(?:output|_agent_runs|_step_runs|_runs)\//, "run"],
	// As duas moradias de uma RFC: a pasta `rfc/` de uma feature, e o arquivo na raiz
	// de um projeto que ainda não tem pasta pra elas. A segunda casa `RFC.md` e
	// `RFC_002_<slug>.md` — a primeira versão exigia o nome exato e a RFC 002 caiu
	// em `doc` no minuto seguinte. Nomear pelo PADRÃO e não pelo arquivo é a
	// diferença entre uma regra e um caso especial.
	[/(?:^|\/)rfc\//, "rfc"],
	[/(?:^|\/)RFC(?:_[^/]*)?\.md$/, "rfc"],
	// Rascunho é ESPÉCIE, não documento: um `draft.md` é o que ainda não decidiu ser
	// nada, e chamá-lo de `doc` mistura-o com os 80 que já decidiram. Insensível a
	// caixa porque o disco tem `draft.md`, `DRAFT.md` e um `DRAfT.md` — a espécie não
	// pode depender de quem digitou o nome.
	[/(?:^|\/)DRAFT(?:_[^/]*)?\.md$/i, "draft"],
	[/(?:^|\/)references\//, "reference"],
	// O nível do meio é o ESTADO da sprint (`inprogress/`, `done/`), e uma sprint
	// fechada continua sprint. O regex aceita UM nível opcional de estado em vez de
	// listar os nomes, porque listar já falhou duas vezes: primeiro `done/` (as duas
	// sprints arquivadas do acme-corretor viraram `task`), depois `inprogress/`
	// no minuto em que o verbo `my sprints move` nasceu. `_parked/` fez o mesmo com
	// projeto. Esta casa cria pasta de agrupamento toda semana — a regra tem que
	// aceitar a próxima sem edição.
	[/^01_projects\/[^/]+\/sprints\/(?:[a-z_]+\/)?[^/]+\/CONTEXT\.md$/, "sprint"],
	[/^01_projects\/[^/]+\/(?:sprints|tasks)\//, "task"],
	[/^01_projects\/[^/]+\/features\//, "feature"],
	[/^01_projects\/[^/]+\/components\//, "component"],
	[/^01_projects\/[^/]+\/issues\//, "issue"],
	// `research/` puro entra junto com as duas formas antigas: a convenção de
	// @03_resources/project/research.md é `research/<NNN>_<slug>/`, e sem ela o
	// `CONTEXT.md` da pesquisa caía na última regra do arquivo e virava `context` —
	// mapa de pasta, quando o que ele carrega é o VEREDITO de uma medição.
	[/^01_projects\/[^/]+\/(?:research\/|researcher_[a-z]|workflows\/research)/, "research"],
	// O `INBOX.md` de um projeto é a MESMA espécie do que mora em `00_inbox/`: um
	// pedido que chegou, com as palavras de quem pediu. O que muda é o endereço — ele
	// já sabe a que projeto pertence. `my projects new` escreve um em TODO projeto,
	// então sem esta regra cada projeto novo nasce com um achado `doc`.
	[/^01_projects\/[^/]+\/INBOX\.md$/, "request"],
	// O `CONTEXT.md` de um CONTAINER (`01_projects/_parked/`, `04_archive/`) é mapa da
	// pasta, não doc de projeto — e vem ANTES da normalização por isso.
	[/^(?:01_projects\/_parked|04_archive)\/CONTEXT\.md$/, "context"],
	[/^01_projects\/[^/]+\/CONTEXT\.md$/, "project"],
	// As duas formas do doc principal de um projeto, e a segunda existe porque a
	// casa mudou de ideia: @01_projects/CONTEXT.md pedia `<slug>/<slug>.md`, e o
	// `my projects new` de 17/08 escreve `CONTEXT.md`. São o mesmo tipo.
	[/^01_projects\/([^/]+)\/\1\.md$/, "project"],
	[/^02_areas\/00_workflows\//, "workflow"],
	[/^02_areas\/\d\d-/, "area"],
	[/^03_resources\/rules\//, "rule"],
	[/^03_resources\/templates\//, "template"],
	[/^03_resources\/notes\//, "note"],
	// Ata é ESPÉCIE, e a casa já tinha decidido isso sozinha: 39 dos 40 markdowns de
	// `meetings/` declaravam `type: meeting` enquanto a tabela derivava `resource`, e
	// os 39 eram a MAIORIA do bucket `divergente` — um check acusando 39 arquivos de
	// discordar dele quando quem discordava era ele. A regra segue o padrão das
	// irmãs (`notes/`, `rules/`, `templates/`): a subpasta nomeia a espécie, e o
	// catch-all de `03_resources/` só pega o que não tem casa própria.
	[/^03_resources\/meetings\//, "meeting"],
	[/^03_resources\//, "resource"],
	// `CLAUDE.md` é o mapa de uma pasta pra quem vai mexer — mesmo papel do
	// `CONTEXT.md`, público diferente.
	[/(?:^|\/)CLAUDE\.md$/, "context"],
	[/CONTEXT\.md$/, "context"],
];

/** O CONTAINER que não muda a espécie do que está dentro.
 *
 *  `04_archive/my_check_v1/sprints/done/999_x/CONTEXT.md` é uma sprint — arquivar não
 *  transforma sprint em `context`. Sem esta normalização o `04_archive/` derrubou 28
 *  types de uma vez, no minuto em que o primeiro projeto foi arquivado.
 *
 *  É a QUARTA vez que um nível de pasta novo quebra a regra derivada do caminho:
 *  `_parked/` nos projetos, `done/` nas sprints, `inprogress/` que eu mesmo criei, e
 *  agora `04_archive/`. As três primeiras foram consertadas caso a caso; esta é a
 *  correção na raiz — o container é DESCASCADO antes de a regra rodar, então o
 *  próximo (`05_alguma_coisa/`) entra com uma linha nesta lista e nada mais.
 *
 *  O que ele assume, e vale escrever: o que se arquiva mantém a FORMA que tinha. Um
 *  projeto arquivado continua com `sprints/`, `tasks/`, `CONTEXT.md`. Se um dia uma
 *  ÁREA for arquivada, esta linha vai chamá-la de projeto — e o sinal será um
 *  `type: project` em cima de algo que não é. */
const CONTAINERS: [RegExp, string][] = [
	[/^04_archive\//, "01_projects/"],
	[/^01_projects\/_parked\//, "01_projects/"],
];

/** What `type` this file WOULD declare, read from where it lives. */
export function typeOf(file: string): string {
	const dentro = CONTAINERS.reduce((f, [re, para]) => f.replace(re, para), file);
	return TYPES.find(([re]) => re.test(dentro))?.[1] ?? "doc";
}

/** Todo markdown que este repo OWNS, perguntado ao git.
 *
 *  `git ls-files` e não uma varredura: o git já sabe o que é nosso, então
 *  `node_modules`, saída de build e toda cópia ignorada ficam de fora sem uma
 *  lista de excludes que envelhece no dia em que um projeto ganha pasta.
 *
 *  `--others --exclude-standard` junto com `--cached`, e isto foi MEDIDO: só o
 *  índice deixava de fora todo arquivo NOVO — o `RFC.md` recém-escrito e as quatro
 *  tasks desta pasta não entravam na conta, e o check dizia "0 sem type" sobre um
 *  disco onde cinco arquivos não tinham nenhum. Um check que só vê o que já foi
 *  commitado chega sempre depois do commit que ele devia ter barrado. */
export function trackedMarkdown(): string[] {
	const ls = Bun.spawnSync(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "*.md"], { cwd: ROOT });
	if (ls.exitCode !== 0) throw new Error(`git ls-files falhou (exit ${ls.exitCode}): ${ls.stderr.toString()}`);
	return ls.stdout.toString().split("\0").filter(Boolean);
}

/** Onde o frontmatter termina, ou `-1` se não existe um.
 *
 *  Um `---` na linha 1 pode ser uma RÉGUA horizontal. O que decide é fechar
 *  dentro de 80 linhas e todo o conteúdo entre as cercas parecer YAML. Não
 *  parecendo, o arquivo é DÚVIDA e não é tocado — inventar frontmatter no meio de
 *  um documento é o estrago que ninguém revisa em 800 arquivos. */
export function fenceEnd(lines: string[]): number {
	if (lines[0] !== "---") return -1;
	const end = lines.slice(1, 80).indexOf("---") + 1;
	if (end <= 0) return -1;
	// `>-`, `|` e a continuação indentada contam: o `fonte: >-` das notas é
	// exatamente isso, e rejeitá-lo tiraria 93 arquivos legítimos do carimbo.
	const yamlish = lines.slice(1, end).every((l) => l.trim() === "" || /^\s/.test(l) || /^[#-]/.test(l) || /^[A-Za-z_][\w.-]*:/.test(l));
	return yamlish ? end : -1;
}

export type Acao = "insert" | "create" | "troca" | "skip" | "duvida" | "link";
export type Carimbo = { file: string; type: string; acao: Acao; era?: string };

/** O que cada markdown precisa pro `type` ficar certo.
 *
 *  `troca` existe porque `skip` cego é irreparável: um arquivo que mudou de pasta,
 *  ou uma regra de `typeOf` que ficou mais precisa depois do carimbo, deixaria pra
 *  sempre o `type: doc` que a regra de hoje chama de `project`.
 *
 *  `files` existe pro PRE-COMMIT: lá a pergunta é "o que ESTE commit está
 *  trazendo", e varrer os 1192 markdown do repo pra julgar dois arquivos é como
 *  se ganha o hook que todo mundo desativa. Sem argumento, varre a casa inteira —
 *  que é o que o `my check all` quer. */
export function carimbos(files = trackedMarkdown()): Carimbo[] {
	return files.flatMap((file) => {
		const type = typeOf(file);
		// Rastreado e AUSENTE do disco é o estado normal de um arquivo entre o `rm` e o
		// `git rm --cached`: o índice ainda o lista e o `lstat` estoura. Derrubou o
		// check inteiro quando o relatório trocou de nome — e um check que morre por
		// causa de um arquivo em trânsito não mede nada durante toda a migração.
		if (!existsSync(join(ROOT, file))) return [];
		if (lstatSync(join(ROOT, file)).isSymbolicLink()) return [{ file, type, acao: "link" as const }];
		const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
		if (lines[0] !== "---") return [{ file, type, acao: "create" as const }];
		const end = fenceEnd(lines);
		if (end < 0) return [{ file, type, acao: "duvida" as const }];
		const declarado = lines
			.slice(1, end)
			.find((l) => /^type:\s*\S/.test(l))
			?.replace(/^type:\s*/, "")
			.trim();
		if (declarado === undefined) return [{ file, type, acao: "insert" as const }];
		return [declarado === type ? { file, type, acao: "skip" as const } : { file, type, acao: "troca" as const, era: declarado }];
	});
}

/** Escreve o carimbo. O `type` vai como PRIMEIRA chave: é o único campo que o OKF
 *  exige, e quem abre o arquivo tem que ver a espécie antes de qualquer coisa. */
export function carimba(c: Carimbo): void {
	const path = join(ROOT, c.file);
	const body = readFileSync(path, "utf8");
	if (c.acao === "insert") writeFileSync(path, body.replace(/^---\n/, `---\ntype: ${c.type}\n`));
	else if (c.acao === "create") writeFileSync(path, `---\ntype: ${c.type}\n---\n\n${body}`);
	// Sem `g` de propósito: um `type:` mais abaixo pode ser DADO do documento (um
	// exemplo de OKF, um campo de outro schema), e reescrevê-lo estraga o conteúdo.
	else if (c.acao === "troca") writeFileSync(path, body.replace(/^type:.*$/m, `type: ${c.type}`));
}

