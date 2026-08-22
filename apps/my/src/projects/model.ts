//! O que um projeto É, aferido do disco — e as REGRAS de forma, num lugar só.
//!
//! Este arquivo existe porque a mesma pergunta ("este projeto está torto?")
//! passou a ter dois donos: o `my projects check` e o deck do `agent-deck`, que
//! reimplementou as regras em Svelte pra desenhar o achado. Duas
//! implementações de uma regra divergem na primeira correção — e a que o humano
//! vê é sempre a errada, porque é a que ninguém roda no terminal.
//!
//! Então a regra mora aqui, o `check` a IMPRIME (em quatro formatos, e em
//! stream), e quem desenha CONSOME. O deck não decide mais nada sobre forma.
//!
//! Achado é ESTRUTURADO: `slug`, `rule`, `problem`, e o campo que decide se dá
//! pra automatizar (`fix`, o comando) — porque achado que não tem comando é
//! decisão, e isso é informação, não omissão.
//!
//! O TETO DA SPRINT não é reimplementado aqui: a soma e a crítica moram em
//! @src/sprints/model.ts, e este arquivo só as traduz em `Finding`. Mesmo motivo
//! do parágrafo acima — uma regra, um lugar.
//!
//! depends_on: 01_projects/ · src/sprints/model.ts · 02_areas/00_workflows/ · src/sprints/list.ts
//! impacts:    src/check/projects.ts · 01_projects/_parked/agent-deck · src/projects/rename.ts
//!
//! O `agent-deck` está em `impacts` porque CONSOME o JSON deste check — a nota ia
//! entre parênteses na própria linha e o `citations.ts` leu "agent-deck (o deck
//! consome o JSON)" como se fosse caminho. Campo é lista de PATH; a prosa desce.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { frontMatter } from "../runs.ts";
import { CEILING_MIN, minutos, semDuration, sprints, tasksSoltas } from "../sprints/model.ts";
import { ARQUIVO as DONE } from "../shared/work/model.ts";
import { home, template } from "../shared/file.ts";

export const RAIZ = home();
export const PROJETOS = join(RAIZ, "01_projects");
export const AREAS = join(RAIZ, "02_areas");
export const TPL = template("system/projects");

export const hoje = () => new Date().toISOString().slice(0, 10);

/** As chaves que o front matter de um `CONTEXT.md` de projeto precisa carregar.
 *
 *  `name` e `description` porque um cartão não mostra `**Resultado:**` sem
 *  adivinhar marcador de negrito; `repo` e `repo_local` porque esta casa é o
 *  REGISTRO e o código mora em outro repositório, e o nome da pasta local não é
 *  derivável da URL (`acme` mora em `~/src/acme-mono`); `main_branch` porque
 *  nem todo repo integra em `main`, e quem assume errado abre PR no lugar errado.
 *
 *  `current_local_branch` NÃO está aqui de propósito: muda a cada `git switch`,
 *  então declarada nasce mentindo. Quem quer saber MEDE. */
export const CHAVES = ["name", "description", "repo", "repo_local", "main_branch"] as const;

/** A subpasta onde o que FECHOU vai morar, e o nome NÃO é escolha deste arquivo:
 *  vem de @src/shared/work/model.ts, que já move task fechada pra `done/` dentro da sprint
 *  (`sprints/991_share_external_v1/tasks/done/002_.../`). Issue reusa a mesma palavra e a
 *  mesma forma um nível acima — reescrever o literal aqui daria duas constantes com o
 *  mesmo valor, que divergem na primeira vez que uma delas mudar.
 *
 *  É a única entrada de `issues/` que não começa com número, então o check a trata à
 *  parte em vez de reprovar por nome.
 *
 *  Import E export, não `export { … } from`: aquela forma reexporta sem criar binding
 *  local, e o próprio arquivo fica sem enxergar o nome. */
export { DONE };

export type Finding = {
	slug: string;
	/** Identidade estável da regra — é por ela que um consumidor decide o que desenhar */
	rule:
		| "missing_context"
		| "legacy_doc"
		| "loose_tasks"
		| "unsprinted_tasks"
		| "task_outside_tasks"
		| "issues_without_repo"
		| "issue_without_context"
		| "issue_bad_name"
		| "issue_done_misplaced"
		| "issue_done_not_closed"
		| "sprint_over_ceiling"
		| "sprint_duration_missing"
		| "missing_frontmatter"
		| "dangling_path"
		| "no_area"
		| "no_deadline"
		| "expired"
		| "no_run";
	/** A frase que o humano lê. Uma redação por regra, em toda a casa */
	problem: string;
	/** O comando que fecha, quando existe um. Ausente = fechar é DECISÃO */
	fix?: string;
	/** Dado extra que o consumidor precisa pra montar instrução — a chave que falta, o caminho que não resolve */
	detail?: Record<string, string>;
};

/** `~/x` → `/Users/…/x`. Front matter é escrito por humano e humano escreve `~`;
 *  `existsSync("~/src/acme-mono")` é sempre falso e falha calado. */
export const expandir = (p: string) =>
	p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;

/** O valor de uma chave do front matter como STRING, ou `undefined` quando ela
 *  falta ou está vazia.
 *
 *  Existe porque `Bun.YAML` COAGE tipo, e todo consumidor aqui quer texto:
 *  `expandir()` chama `.startsWith`, e um número cru estoura. Chave com valor
 *  vazio vira `null` no YAML e sai como `undefined` aqui — `repo:` seguido de
 *  nada é o mesmo buraco que não ter a chave, e é o caso mais comum, porque
 *  alguém digitou a chave e parou.
 *
 *  MEDIDO em 19/08 contra `Bun.YAML`, porque a intuição erra em dois pontos:
 *  `~/src/acme-mono` NÃO vira null (só um `~` sozinho vira), e `2024-01-01` sai
 *  string, não `Date`. Os dois casos que assustam no papel estão cobertos.
 *
 *  ponytail: `0817` vira número 817 — o zero à esquerda MORRE, e nenhum `String()`
 *  o traz de volta. É o contrato do YAML (escalar sem aspas é tipado), o mesmo que
 *  o resto da casa já aceita, e o estrago é visível: o caminho não resolve e vira
 *  `dangling_path`. Se algum dia um valor de verdade precisar do zero, a saída é
 *  aspas no front matter, não um segundo parser aqui. */
export const campo = (fm: Record<string, any>, k: string): string | undefined => {
	const v = fm[k];
	if (v === undefined || v === null || v === "") return undefined;
	const texto = String(v);
	// PLACEHOLDER DO MOLDE não é declaração. `repo: <owner>/<name>` é o template
	// passando por resposta: a chave existe, então todo consumidor acredita nela e
	// vai buscar um repositório chamado literalmente `<owner>/<name>`.
	//
	// Medido 19/08: 2 projetos (`auto-system`, `nimbus-v1`), e o check os dava
	// como tendo `repo`. Tratar como AUSENTE não inventa achado novo — os dois já
	// caíam em `missing_frontmatter` por outras chaves; agora a mensagem lista
	// `repo` junto, que é a verdade. O número não muda; o que muda é ele não
	// mentir. Mesma família do `_parked` da task 039: o defeito era do check.
	return /^<.+>$/.test(texto) ? undefined : texto;
};

/** Os projetos de `01_projects/` — e só eles.
 *
 *  `_` na frente é NAMESPACE, não projeto: é a mesma convenção de `_runs`,
 *  `_meta` e `_events`. Quem paga por isso é o `_parked/`, cuja razão de existir,
 *  escrita no próprio `CONTEXT.md` dele, é "sair da lista de `01_projects/` sem
 *  virar mentira" — e ele estava DENTRO da lista, cobrando front matter, área,
 *  prazo e run de uma pasta que é gaveta. Os projetos parados moram um nível
 *  abaixo e continuam fora da conta, que é o ponto de estarem lá. */
export const slugs = () =>
	readdirSync(PROJETOS)
		.filter((d) => !d.startsWith(".") && !d.startsWith("_"))
		.filter((d) => !d.endsWith(".md"));

/** Quais projetos algum run CITA.
 *
 *  O run não declara o projeto num campo — ele menciona o caminho
 *  `01_projects/<slug>` no pedido, no guardrail, na saída. Casar pelo NOME da
 *  pasta do run daria falso negativo em `2026-08-13T2355Z-usar-o-pipeline-do-acme-mono`,
 *  que é do `acme-refatoracao` e não tem o slug no nome. */
export function citados(): Set<string> {
	const achados = new Set<string>();

	const varrer = (dir: string, profundidade = 0) => {
		if (!existsSync(dir) || profundidade > 4) return;
		for (const entrada of readdirSync(dir)) {
			if (entrada.startsWith(".") || entrada === "node_modules") continue;
			const caminho = join(dir, entrada);
			let info: ReturnType<typeof statSync>;
			try {
				info = statSync(caminho);
			} catch {
				continue; // symlink pro vazio: um run apontando pra fora não invalida a varredura
			}
			if (info.isDirectory()) {
				varrer(caminho, profundidade + 1);
				continue;
			}
			if (!/\.(ya?ml|md)$/.test(entrada)) continue;
			// `_` no conjunto: sem ele, um slug com underscore casa só até o primeiro
			// `_` e o projeto some do conjunto em silêncio. Achado em 14/08.
			for (const m of readFileSync(caminho, "utf8").matchAll(/01_projects\/([a-z0-9_-]+)/g))
				achados.add(m[1]);
		}
	};

	varrer(join(RAIZ, "_step_runs"));
	varrer(join(RAIZ, "03_resources", "00_company"));

	return achados;
}

/** Todo achado de um projeto. É A regra de forma desta casa, e o único lugar dela. */
export function findingsDe(slug: string, jaCitados: Set<string>): Finding[] {
	const dir = join(PROJETOS, slug);
	const rel = `01_projects/${slug}`;
	const achados: Finding[] = [];

	// `CONTEXT.md`, e não `<slug>.md`: o nome do arquivo que explica uma pasta é o
	// mesmo em toda a casa, então quem chega sabe o que abrir sem saber o slug. O
	// `<slug>.md` continua sendo LIDO enquanto existir — e aparece como achado, que
	// é o que faz a migração ser verificável em vez de lembrada.
	const doc = join(dir, "CONTEXT.md");
	const velho = join(dir, `${slug}.md`);
	const temDoc = existsSync(doc);
	const temVelho = existsSync(velho);
	const texto = temDoc ? readFileSync(doc, "utf8") : temVelho ? readFileSync(velho, "utf8") : "";

	if (!temDoc && !temVelho)
		achados.push({ slug, rule: "missing_context", problem: "sem CONTEXT.md — a pasta não diz o que é" });
	else if (!temDoc)
		achados.push({
			slug,
			rule: "legacy_doc",
			problem: `ainda em ${slug}.md — o nome virou CONTEXT.md`,
			fix: `git mv ${rel}/${slug}.md ${rel}/CONTEXT.md`,
			detail: { legacy: `${slug}.md` },
		});

	if (existsSync(join(dir, "tasks.md")))
		achados.push({
			slug,
			rule: "loose_tasks",
			problem: "ainda tem tasks.md — a task virou pasta em tasks/NNN_<nome>/",
			detail: { file: `${rel}/tasks.md` },
		});

	// `01_projects/<proj>/tasks/NNN_<nome>/` é LEGAL desde 19/08: as duas raízes que
	// recebem task — o projeto e a sprint — falam `tasks/`, e a do projeto é a que
	// ainda não foi puxada pra dentro de uma sprint. Ela não é defeito de forma; é
	// trabalho escrito e não pacotado, que é uma informação diferente e ainda vale
	// dizer. Por isso continua aparecendo, e por isso NÃO tem `fix`: pôr a task numa
	// sprint exige DECIDIR de qual, e um `git mv` gerado escolheria sozinho.
	// O INVARIANTE, verificado: uma task mora SEMPRE sob um `tasks/`. Sem esta
	// checagem a regra seria só prosa — dentro da sprint, uma pasta de task e uma
	// pasta de docs tinham a mesma forma, e distinguir era adivinhar pelo `NNN_`.
	// 37 pastas foram movidas em 19/08 pra isto valer; o que reintroduzir a forma
	// velha aparece aqui, com o `git mv` pronto.
	for (const s of sprints(slug))
		for (const fora of existsSync(s.dir)
			? readdirSync(s.dir).filter((d) => /^\d+_/.test(d))
			: [])
			achados.push({
				slug,
				rule: "task_outside_tasks",
				problem: `${s.pasta}/${fora}/ é task fora de \`tasks/\` — a task mora sempre em \`tasks/<NNN_nome>/\` (#task_is_a_capability)`,
				detail: { dir: `${rel}/sprints/${s.pasta}/${fora}` },
				fix: `git mv ${rel}/sprints/${s.pasta}/${fora} ${rel}/sprints/${s.pasta}/tasks/${fora}`,
			});

	const soltas = tasksSoltas(slug);
	if (soltas.length)
		achados.push({
			slug,
			rule: "unsprinted_tasks",
			problem: `${soltas.length} task(s) em tasks/ sem sprint — legal, mas fora de qualquer pacote: nenhuma delas tem teto de 10 min a respeitar`,
			detail: { tasks: soltas.map((t) => t.id).join(","), dir: `${rel}/tasks` },
		});

	// `issues/` é OPCIONAL — só projeto que acompanha número de um repo de OUTRA
	// gente tem uma. Quem não tem não é achado; quem tem e está torto, sim. A forma
	// inteira em `my resources project issues`, e o porquê de não copiar o corpo da
	// issue está lá: cópia de conteúdo que o GitHub já é dono envelhece calada.
	const issuesDir = join(dir, "issues");
	if (existsSync(issuesDir)) {
		// Sem `repo:`, os números da pasta não pertencem a GitHub nenhum — e o número
		// é a ÚNICA coisa que esta casa e o GitHub chamam pelo mesmo nome.
		if (!/^repo:\s*\S+/m.test(texto))
			achados.push({
				slug,
				rule: "issues_without_repo",
				problem: "tem issues/ e não declara `repo:` — os números não pertencem a GitHub nenhum",
				detail: { dir: `${rel}/issues` },
			});

		// `issues/` tem as VIVAS; `issues/done/` as fechadas. Duas pastas e não um
		// campo porque o `ls` é a lista de trabalho — issue fechada misturada com
		// aberta faz a pasta crescer pra sempre e a pergunta "o que falta?" custar uma
		// leitura de todas. Mover é `git mv`, e o estado que manda mover é o NOSSO
		// (`nosso_estado: fechada`), não o `closed` do GitHub: uma issue pode fechar lá
		// com trabalho pendente aqui, e o contrário também.
		for (const [base, dentroDeDone] of [
			[issuesDir, false],
			[join(issuesDir, DONE), true],
		] as const) {
			if (!existsSync(base)) continue;
			for (const e of readdirSync(base, { withFileTypes: true })) {
				if (!e.isDirectory() || e.name.startsWith(".")) continue;
				if (!dentroDeDone && e.name === DONE) continue; // a própria `done/`
				const onde = dentroDeDone ? `issues/${DONE}/${e.name}` : `issues/${e.name}`;

				// O NÚMERO abre o nome, e o slug depois dele é só pro `ls` ser legível. Sem
				// o número, a pasta perde a única chave compartilhada com o GitHub — e ela
				// sobrevive a alguém renomear a issue, que o slug não.
				if (!/^\d+_/.test(e.name))
					achados.push({
						slug,
						rule: "issue_bad_name",
						problem: `${onde} não começa com o número da issue — <numero>_<slug>/`,
						detail: { folder: `${rel}/${onde}` },
					});

				const ctx = join(base, e.name, "CONTEXT.md");
				if (!existsSync(ctx)) {
					achados.push({
						slug,
						rule: "issue_without_context",
						problem: `${onde} sem CONTEXT.md — a pasta não diz o nosso estado da issue`,
						detail: { folder: `${rel}/${onde}` },
					});
					continue;
				}

				// O invariante que o disco consegue provar sozinho: `fechada` e `done/`
				// andam juntos. Sem isto, "mover quando fechar" é combinado que ninguém
				// verifica — e a casa já enterrou o `_events/` por exatamente isso.
				const fechada = /^\s*nosso_estado:\s*fechada\s*$/m.test(readFileSync(ctx, "utf8"));
				if (fechada && !dentroDeDone)
					achados.push({
						slug,
						rule: "issue_done_misplaced",
						problem: `${onde} está \`fechada\` e fora de done/ — issue fechada sai da lista de trabalho`,
						fix: `git mv ${rel}/issues/${e.name} ${rel}/issues/${DONE}/${e.name}`,
						detail: { folder: `${rel}/${onde}` },
					});
				if (!fechada && dentroDeDone)
					achados.push({
						slug,
						rule: "issue_done_not_closed",
						problem: `${onde} está em done/ e não declara \`nosso_estado: fechada\``,
						detail: { folder: `${rel}/${onde}` },
					});
			}
		}
	}

	// O TETO de 10 min é da SPRINT, e na sprint-pasta ele é a soma das `duration`
	// das tasks de dentro. A regra e a soma moram em @src/sprints/model.ts; aqui só
	// se traduz em achado — duas implementações de uma regra divergem na primeira
	// correção, e a que o humano vê é sempre a errada.
	for (const s of sprints(slug)) {
		const m = minutos(s);
		const faltam = semDuration(s);
		if (m > CEILING_MIN)
			achados.push({
				slug,
				rule: "sprint_over_ceiling",
				problem: `${s.pasta} soma ${m} min, acima do teto de ${CEILING_MIN} — a alavanca é PARTIR em outra sprint`,
				detail: { sprint: s.pasta, minutes: String(m), ceiling: String(CEILING_MIN) },
			});
		// Sem `duration` a soma existe e não vale. "Não verificável" é achado, não
		// silêncio: é exatamente o caso em que a sprint estoura sem ninguém ver.
		if (faltam.length)
			achados.push({
				slug,
				rule: "sprint_duration_missing",
				problem: `${s.pasta}: ${faltam.length} task(s) sem \`duration\` (${faltam.join(", ")}) — sem ela o teto de ${CEILING_MIN} min não é verificável`,
				detail: { sprint: s.pasta, tasks: faltam.join(","), minutes: String(m) },
			});
	}

	// O front matter só é cobrado quando existe documento pra carregá-lo: acusar
	// chave faltando num projeto que não tem doc nenhum é o mesmo achado duas vezes.
	if (texto) {
		// `body === texto` é como se sabe que NÃO havia cerca: `frontMatter` só
		// fatia o corpo quando o bloco casou. É a diferença entre "sem front matter
		// nenhum" e "tem o bloco, faltam chaves" — dois achados diferentes.
		const { fm, body } = frontMatter(texto);
		const bare = body === texto;
		const faltando = CHAVES.filter((c) => !campo(fm, c));
		if (faltando.length)
			achados.push({
				slug,
				rule: "missing_frontmatter",
				problem: bare
					? "CONTEXT.md sem front matter — o deck não tem de onde ler nada como dado"
					: `front matter sem ${faltando.join(", ")}`,
				detail: { keys: faltando.join(","), bare: String(bare) },
			});

		// Caminho declarado que não resolve é pior que chave ausente: a chave existe,
		// então todo consumidor acredita nela, e a leitura falha calada. `none` é
		// ausência DECLARADA, e vale — projeto sem código é um fato, não um buraco.
		const local = campo(fm, "repo_local");
		if (local && local !== "none" && !existsSync(expandir(local)))
			achados.push({
				slug,
				rule: "dangling_path",
				problem: `repo_local aponta pro vazio — ${local} não existe nesta máquina`,
				detail: { key: "repo_local", value: local, repo: campo(fm, "repo") ?? "" },
			});

		if (!/\*\*Serve a área:\*\*/.test(texto))
			achados.push({ slug, rule: "no_area", problem: "sem área — trabalho sem dono depois de pronto" });

		// Prazo no front matter ou na prosa, e OPCIONAL quando o front matter declara
		// `state:`: o fim de um projeto pode ser um ESTADO ("o registry responde") em
		// vez de uma data, e aí é `state:` que diz se ele ainda está de pé.
		const prazo =
			texto.match(/^prazo:\s*(\d{4}-\d{2}-\d{2})/m)?.[1] ??
			texto.match(/\*\*Prazo:\*\*\s*(\d{4}-\d{2}-\d{2})/)?.[1];
		const temState = /^state:\s*\S/m.test(texto);

		if (!prazo && !temState)
			achados.push({
				slug,
				rule: "no_deadline",
				problem: "sem prazo e sem state — sem um dos dois é ÁREA, não projeto",
			});
		else if (prazo && prazo < hoje())
			achados.push({
				slug,
				rule: "expired",
				problem: `prazo venceu em ${prazo} — projeto morto na pasta faz a lista mentir`,
				detail: { prazo },
			});
	}

	// Projeto sem run é o inverso do trabalho invisível: existe intenção registrada
	// e nenhuma execução. Vale saber, não é erro.
	if (!jaCitados.has(slug))
		achados.push({ slug, rule: "no_run", problem: "nenhum run cita este projeto — intenção sem execução" });

	return achados;
}

/** Os achados da casa inteira, ou de um projeto só. */
export function findings(apenas?: string): Finding[] {
	const jaCitados = citados();
	const alvos = apenas ? slugs().filter((s) => s === apenas) : slugs();
	return alvos.flatMap((slug) => findingsDe(slug, jaCitados));
}
