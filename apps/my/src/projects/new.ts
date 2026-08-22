//! Cria a pasta de um projeto — a parte MECÂNICA de @03_resources/templates/system/projects.
//!
//!   my projects okf-como-base --resultado "…" --prazo 2026-08-28 --area 04-experimentos
//!   my projects x --resultado "…" --area 04-experimentos --estrutura sprints
//!   my projects check          # a medida agregada: quem está torto, e como
//! depends_on: src/shared/template.ts
//
// ## Por que isto virou script
//
// Medido em 14/08: **6 projetos em `01_projects/`, ZERO criados pelo step.**
// Nenhum run tem `projects.yaml` — o sub-verb com 4 sub-steps e um gate nunca
// chegou ao fim, uma vez sequer, em 22 runs. Os seis nasceram à mão no meio da
// conversa, e o que se perdeu foi sempre a mesma coisa: `serve_area` (a regra
// diz que TODO projeto serve uma área) e a data que separa projeto de área.
//
// A leitura honesta não é "faltou disciplina": é que quando o processo custa
// mais que fazer à mão, todo mundo faz à mão. Então este script tira do
// processo só o que é DETERMINÍSTICO — pasta, esqueleto dos dois arquivos,
// link pra área, link pro run — e **recusa** o que a prosa só pedia:
//
//   - sem `--resultado`, sem `--prazo`, sem `--area` → não cria
//   - prazo no passado, ou área que não existe no disco → não cria
//   - pasta que já existe → não cria (o `mkdir` sem `recursive` é atômico)
//
// O que continua em markdown é o JULGAMENTO: se é projeto ou área, qual o
// resultado, qual o teste que decide. Um script não tem opinião sobre isso, e
// fingir que tem seria o segundo lugar onde o processo mora — que é justamente
// o que @CONTEXT.md proíbe.
//
// O esqueleto sai dos @03_resources/templates/system/projects/*.md, LIDOS do disco. Copiar o
// conteúdo pra cá criaria a segunda forma, e a forma diverge na primeira
// correção.
//
// De `*.md` este script escreve UM: o `CONTEXT.md`. O irmão
// @03_resources/templates/system/projects/CLAUDE.md é OPCIONAL de propósito e
// fica pra quem escreve à mão — ele guarda a armadilha que já custou uma rodada,
// e projeto sem armadilha não precisa dele. Gerar um vazio "por completude" é
// como se ensina um agente a pular CLAUDE.md, inclusive o próximo, que
// importava.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { doTemplate } from "../shared/template.ts";
import { AREAS, PROJETOS, RAIZ, TPL, hoje } from "./model.ts";


// O strip do que é do MOLDE (frontmatter + `<!-- TEMPLATE … -->`) e o `type` do
// que NASCE moram em @src/shared/template.ts: os três geradores carregavam a mesma
// linha copiada, e ela ficou errada nos três no mesmo dia.

/** `--chave valor` viram um objeto. Sem dependência: `parseArgs` do node serve,
 *  mas exige declarar cada opção, e aqui a lista é de cinco. */
function flags(argv: string[]) {
	const f: Record<string, string> = {};
	const livres: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith("--")) {
			const [k, v] = a.slice(2).split("=");
			f[k] = v ?? (argv[i + 1]?.startsWith("--") ? "true" : (argv[++i] ?? "true"));
		} else livres.push(a);
	}
	return { f, livres };
}

const morre = (msg: string): never => {
	console.error(msg);
	process.exit(1);
};

// ---------------------------------------------------------------------------
const { f, livres } = flags(process.argv.slice(2));
const slug = livres[0];
if (!slug) morre('uso: my projects <slug> --resultado "…" --area NN-slug [--prazo YYYY-MM-DD] [--dono X] [--run <run-id>] [--estrutura tasks|sprints]\n      my projects check');
if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(slug)) morre(`slug inválido: ${slug} (minúsculas, hífen, 2-49)`);

// As três recusas que a prosa pedia e ninguém cumpria.
const resultado = f.resultado?.trim();
const prazo = f.prazo?.trim();
const area = f.area?.trim();
if (!resultado) morre("faltou --resultado: o que existe no mundo quando isto acabar");
// `--prazo` é OPCIONAL desde 18/08: o fim de um projeto pode ser um ESTADO ("o
// registry responde no nome") em vez de uma data, e forçar data fazia nascer prazo
// de fantasia — que vence e faz a lista mentir. Sem prazo, o `state:` do front
// matter é quem diz se o projeto está de pé.
if (prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) morre(`--prazo em ISO (YYYY-MM-DD), veio: ${prazo}`);
if (prazo && prazo < hoje()) morre(`--prazo ${prazo} está no passado — projeto nasce com data que ainda vai acontecer`);
if (!area) morre("faltou --area: todo projeto serve uma área (@01_projects/CONTEXT.md)");

const areaSlug = area.replace(/^\d\d-/, "");
const areaDoc = join(AREAS, area, `${areaSlug}.md`);
if (!existsSync(areaDoc))
	morre(`área não existe no disco: 02_areas/${area}/${areaSlug}.md\n  existem: ${readdirSync(AREAS).filter((d) => /^\d\d-/.test(d)).join(", ")}`);

if (f.run && !existsSync(join(RAIZ, "_step_runs", f.run)))
	morre(`run não existe: _step_runs/${f.run}`);

// ---------------------------------------------------------------------------
// QUAL ESQUELETO: `tasks/` direto ou `sprints/`?
//
// As duas formas existem e a casa lê as duas: `tasks/NNN_x/` é trabalho solto —
// um estudo, uma medição, um spike que termina numa tarde; `sprints/999_s/tasks/`
// é trabalho que se ENTREGA em pacotes, com o teto de 10 min por sprint fazendo
// o corte. Nascer na forma errada custa uma migração de pasta e um achado de
// `unsprinted_tasks` que fica meses aberto.
//
// A escolha sai do CONTEXTO que o comando já recebe — o resultado escrito e o
// prazo —, e não de uma pergunta feita sempre: perguntar o que o texto já
// responde gasta rodada do humano. Abaixo de 80 de confiança, aí sim pergunta,
// com a recomendação em primeiro e o porquê dela junto.

const SINAIS: [RegExp, number, string][] = [
	// Trabalho que se entrega em pacote — pede sprint.
	[/\b(sistema|plataforma|aplicativo|app|produto|pipeline|integra[cç][aã]o|migra[cç][aã]o|migrar|refator|reescrev|lan[cç]ar|mvp|v1|cliente)\b/i, 2, "o resultado fala de entrega em pacote"],
	// Trabalho que termina numa tarde — pede task solta.
	[/\b(estud|medi[rçc]|medi[cç][aã]o|provar|prova|spike|experimento|poc|avaliar|comparar|investigar|entender|benchmark|decidir)\b/i, -2, "o resultado é de investigação, não de entrega"],
];

function estruturaSugerida(): { estrutura: "tasks" | "sprints"; confianca: number; porque: string } {
	if (f.estrutura) {
		if (f.estrutura !== "tasks" && f.estrutura !== "sprints") morre(`--estrutura só aceita \`tasks\` ou \`sprints\`, veio: ${f.estrutura}`);
		return { estrutura: f.estrutura as "tasks" | "sprints", confianca: 100, porque: "foi passado em --estrutura" };
	}
	let score = 0;
	const porques: string[] = [];
	for (const [re, peso, porque] of SINAIS)
		if (re.test(resultado!)) {
			score += peso;
			porques.push(porque);
		}
	// O PRAZO só desempata, e só quando o TEXTO não disse nada. Medido escrevendo
	// o teste: "medir se o viewer mostra X" com prazo de 2099 zerava o placar — o
	// calendário anulava a palavra que o humano escolheu. Um estudo com prazo
	// distante continua um estudo; o que ele descreve manda mais que quando vence.
	if (prazo && score === 0) {
		const dias = Math.round((Date.parse(prazo) - Date.parse(hoje())) / 86_400_000);
		if (dias <= 7) (score -= 2), porques.push(`vence em ${dias} dia(s)`);
		else if (dias >= 21) (score += 2), porques.push(`vence em ${dias} dias`);
	}
	// Resultado longo costuma ser resultado com mais de uma entrega dentro.
	if (resultado!.length > 140) (score += 1), porques.push("o resultado descreve mais de uma entrega");

	const estrutura = score > 0 ? "sprints" : "tasks";
	// Confiança é a FORÇA do sinal, não a contagem: 50 é moeda no ar, e cada ponto
	// de placar vale 15 até o teto de 95 — acima disso só o `--estrutura` explícito.
	const confianca = Math.min(95, 50 + Math.abs(score) * 15);
	return { estrutura, confianca, porque: porques.join(" · ") || "o resultado não dá sinal de nenhum dos dois lados" };
}

/** Pergunta binária, recomendação primeiro. As quatro saídas do `askuser` são
 *  contrato: `2` (pulou) e `3` (expirou) NÃO são o padrão silencioso — ninguém
 *  decidiu, então nada nasce. `1` é "não consegui perguntar", que num script sem
 *  tela é o caso normal, e aí a saída é passar `--estrutura`. */
function perguntaEstrutura(sug: ReturnType<typeof estruturaSugerida>): "tasks" | "sprints" {
	const outra = sug.estrutura === "sprints" ? "tasks" : "sprints";
	const rotulo = {
		sprints: "sprints/ — pacote com teto de 10 min por sprint",
		tasks: "tasks/ direto — trabalho solto, sem pacote",
	};
	const r = Bun.spawnSync(
		[
			"bun", "run", join(RAIZ, "src/cli/my.ts"), "askuser", "ask",
			`projeto \`${slug}\`: o trabalho nasce em pacote ou solto?`,
			"-H", "estrutura",
			"-o", `${rotulo[sug.estrutura]}|recomendado (${sug.confianca}%) — ${sug.porque}`,
			"-o", `${rotulo[outra]}|a outra forma; a casa lê as duas`,
			// 15 min e não os 30 do padrão: isto trava a criação de um projeto, e
			// projeto que espera meia hora por uma pasta é projeto que nasce à mão.
			"-t", "15",
			"--json",
		],
		{ env: { ...process.env, ASKUSER_WINDOWED: "1" } },
	);
	const saida = new TextDecoder().decode(r.stdout).trim();
	if (r.exitCode === 2 || r.exitCode === 3)
		morre(`ninguém decidiu a estrutura (${r.exitCode === 2 ? "pulou" : "expirou"}) — nada foi criado.\n  rode de novo com --estrutura ${sug.estrutura}`);
	if (r.exitCode !== 0)
		morre(`não consegui perguntar a estrutura. Recomendada: ${sug.estrutura} (${sug.confianca}%, ${sug.porque})\n  rode de novo com --estrutura ${sug.estrutura}`);
	// A escolha volta como o RÓTULO inteiro; o que importa é qual das duas formas
	// ele nomeia, e `sprints/` só aparece no rótulo da opção de sprint.
	return saida.includes("sprints/") ? "sprints" : "tasks";
}

const sugestao = estruturaSugerida();
const estrutura = sugestao.confianca >= 80 ? sugestao.estrutura : perguntaEstrutura(sugestao);

const dir = join(PROJETOS, slug);
// `mkdir` SEM `recursive` falha com EEXIST — a mesma trava atômica que o
// `notify/create.ts` (morto em 16/08, @src/CONTEXT.md) usava pra numerar
// notificação sem colisão — e aqui ela impede duas sessões de criarem o
// mesmo projeto e uma sobrescrever o doc da outra.
try {
	mkdirSync(dir);
} catch (e) {
	if ((e as NodeJS.ErrnoException).code === "EEXIST") morre(`já existe: 01_projects/${slug}/`);
	throw e;
}

const doc = doTemplate(readFileSync(join(TPL, "CONTEXT.md"), "utf8"), "project")
	.replace("# <O projeto, dito como resultado e não como assunto>", `# ${f.titulo ?? slug}`)
	.replace("**Resultado:** <o que existe no mundo quando isto acabar>", `**Resultado:** ${resultado}`)
	.replace("projeto: <slug>", `projeto: ${slug}`)
	.replace("area: NN-<slug>", `area: ${area}`)
	.replace("dono: <nome>", `dono: ${f.dono ?? "Gabriel"}`)
	.replace(
		/prazo: <YYYY-MM-DD>.*(\n\s+#.*)*/,
		prazo ? `prazo: ${prazo}` : "# sem `prazo:`: o fim deste projeto é um ESTADO, não uma data",
	)
	.replace(
		"**Serve a área:** [<area>](../../02_areas/NN-<slug>/<slug>.md)",
		`**Serve a área:** [${areaSlug}](../../02_areas/${area}/${areaSlug}.md)`
	)
	.replace("- @02_areas/NN-<slug>/<slug>.md — a área que este projeto serve", `- @02_areas/${area}/${areaSlug}.md — a área que este projeto serve`)
	// O run é o par do projeto: um guarda a INTENÇÃO, o outro a execução. Sem
	// este link, quem abre o projeto não acha o raciocínio que o gerou.
	.replace("## References", f.run ? `## References\n\n- @_step_runs/${f.run}/input.yaml — o run que desenhou este projeto` : "## References");

// `CONTEXT.md` e não `<slug>.md`: o arquivo que explica uma pasta tem o mesmo nome
// em toda a casa, então quem chega sabe o que abrir sem saber o slug.
writeFileSync(join(dir, "CONTEXT.md"), doc);
// E `tasks/` em vez de `tasks.md`: a task virou PASTA (`my kanban add`), porque uma
// linha de checkbox não carrega prova, worktree, nem os dois shas do diff. Em
// `sprints/`, a pasta nasce VAZIA — quem numera a primeira sprint é
// `my sprints new`, e criar uma aqui seria inventar título no lugar de quem sabe.
mkdirSync(join(dir, estrutura));

console.log(`01_projects/${slug}/CONTEXT.md`);
console.log(`01_projects/${slug}/${estrutura}/  (${sugestao.confianca >= 80 ? `${sugestao.confianca}% · ${sugestao.porque}` : "escolhido no popup"})`);
console.log(`área: 02_areas/${area}/${areaSlug}.md · ${prazo ? `prazo: ${prazo}` : "sem prazo (state: ativo)"}`);
console.log(
	estrutura === "sprints"
		? `primeira sprint: my sprints new "<o pacote, no presente>" -P ${slug}`
		: `primeira task: my kanban add "<o resultado, no presente>" -P ${slug}`,
);
console.log("o esqueleto está lá; o escopo é julgamento — escreva.");
console.log(`depois, pra ele aparecer na barra: my vscode set me/01_projects/${slug} -t`);

if (process.env.PROJETO_SELFTEST) {
	// Auto-teste do que importa: as recusas. Um script que só sabe criar não
	// mede nada — o valor aqui é ele dizer NÃO ao projeto sem área e sem data.
	const { spawnSync } = await import("node:child_process");
	const eu = ["run", join(import.meta.dir, "projeto.ts")];
	const roda = (...a: string[]) => spawnSync("bun", [...eu, ...a], { encoding: "utf8" });
	console.assert(roda("x2", "--prazo", "2099-01-01", "--area", area).status === 1, "aceitou sem resultado");
	console.assert(roda("x2", "--resultado", "r", "--area", area).status === 1, "aceitou sem prazo");
	console.assert(roda("x2", "--resultado", "r", "--prazo", "2000-01-01", "--area", area).status === 1, "aceitou prazo no passado");
	console.assert(roda("x2", "--resultado", "r", "--prazo", "2099-01-01", "--area", "99-nao-existe").status === 1, "aceitou área inexistente");
	console.assert(roda(slug, "--resultado", "r", "--prazo", "2099-01-01", "--area", area).status === 1, "aceitou pasta existente");
	console.log("auto-teste ok — as cinco recusas recusam");
}
