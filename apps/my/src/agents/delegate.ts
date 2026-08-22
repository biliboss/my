#!/usr/bin/env bun
//! `my agents delegate` — entrega UM stage a um agente que roda e termina.
//!
//!     my agents delegate 02_build "leia a sprint 999 e abra o PR"
//!     my agents delegate qa "..." --model sonnet --brief @~/.claude/qa.md
//!     my agents delegate espelho --workflow @feature_delivery --run @969_… --cwd ~/w
//!
//! O PEDIDO NÃO VAI NO PROMPT. Com `--workflow` e `--run` o ask são três linhas
//! — qual processo, entra onde, sai onde — e o agente abre cada endereço na
//! hora, lendo a versão de hoje. Colar a issue no argv diverge e não cabe:
//! 6,4 KB fizeram o herdr recusar com `arguments cannot be encoded safely`.
//!     my agents delegate --live                 # quem está rodando agora
//!
//! ELE MORA NUM WORKSPACE SÓ. `my-agents`, segundo na sidebar, uma aba por
//! delegação. É o que faz o teto ser contável: `--max` conta as ABAS do pool, e
//! não um número guardado que derrapa quando um agente morre calado.
//!
//! A ABA DE QUEM TERMINOU É FECHADA ANTES DE CONTAR. Sem isso `--max` passa a
//! significar "quantos já começaram", e o pool trava cheio de agentes mortos.
//!
//! depends_on: packages/agents/agents.ts
//! impacts:    —

import { Command } from "commander";

import { agents, AgentsDelegation } from "@my/agents";

export function command(): Command {
	return new Command("delegate")
		.description("Entrega um stage a um agente que roda no pool e termina.")
		.argument("[stage]", "o nome do stage — vira o nome da aba e o `MY_AGENT`")
		.argument("[prompt]", "o pedido; `@caminho` lê do disco. Prefira --workflow/--run")
		.option("--workflow <path>", "o CONTEXT.md do processo a executar")
		.option("--run <path>", "a pasta do run — entrada e saída do agente")
		.option("--live", "só lista quem está rodando")
		.option("--max <n>", "teto de agentes simultâneos", "10")
		.option("--harness <cli>", "claude, codex, …")
		.option("--model <name>")
		.option("--effort <level>")
		.option("--permission <mode>", "--permission-mode do vendor")
		.option("--brief <text>", "instrução de sistema; `@caminho` lê do disco")
		.option("--cwd <path>", "o diretório onde ele nasce — o repo do trabalho")
		.option("--wait", "bloqueia até o agente terminar e fecha a aba dele");
}

export async function main(argv: string[]): Promise<number> {
	const cmd = command().exitOverride();
	try {
		cmd.parse(argv, { from: "user" });
	} catch (err) {
		return (err as { exitCode?: number }).exitCode ?? 1;
	}

	const opts = cmd.opts();
	const pool = new AgentsDelegation(agents, "my-agents", Number(opts.max));

	if (opts.live) {
		const running = await pool.live();
		for (const a of running) console.log(`${a.stage}\t${a.harness}`);
		console.log(`${running.length} de ${pool.max}`);
		return 0;
	}

	const [stage, given] = cmd.args;
	// `--workflow` e `--run` andam juntos: um run sem processo não diz o que fazer
	// com ele, e um processo sem run não diz sobre o quê.
	if (Boolean(opts.workflow) !== Boolean(opts.run)) {
		console.error("--workflow e --run vêm sempre juntos");
		return 2;
	}
	const prompt = opts.workflow ? pool.ask(opts.workflow, opts.run) : given;
	if (!stage || !prompt) {
		console.error("faltou o stage e o pedido: `my agents delegate <stage> --workflow <ctx> --run <pasta>`");
		return 2;
	}

	try {
		const agent = await pool.delegate(stage, prompt, {
			harness: opts.harness,
			model: opts.model,
			effort: opts.effort,
			permission: opts.permission,
			brief: opts.brief,
			cwd: opts.cwd,
		});
		console.log(`${agent.stage} — ${agent.pane}, ${agent.harness} ${agent.model}/${agent.effort}`);
		if (!opts.wait) return 0;

		const done = await pool.finish(agent.stage);
		console.log(done ? `${agent.stage} terminou; aba fechada` : `${agent.stage} não chegou a \`done\` no prazo — a aba fica`);
		return done ? 0 : 1;
	} catch (err) {
		console.error((err as Error).message);
		return 1;
	}
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
