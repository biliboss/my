#!/usr/bin/env python3
"""Publica o quadro do `do-sprint`. NÃO lê o plano, NÃO desenha.

Duas coisas, e nada além delas:

    1. `my meta board <run> --json` diz em que coluna cada task está
    2. `03_resources/templates/cockpit/do_sprint.json` diz como isso se parece

O QUE ESTE ARQUIVO NÃO FAZ, e é o ponto. A primeira versão, de 16/08, abria o
`sprints.yaml` e o parseava com regex — um SEGUNDO leitor de um arquivo que o
`meta.ts` já lê. Dois parsers do mesmo arquivo divergem na primeira mudança de
forma, e o que ninguém roda `--check` contra é o que apodrece. A derivação do
estado (worktree · recibo · commit) mora no `meta.ts#board`, que é o único lugar
da casa que sabe ler uma run.

    python3 src/do_sprint.py            publica o quadro da run mais nova com plano
    python3 src/do_sprint.py 010        publica a de uma run específica
    python3 src/do_sprint.py --watch    republica quando `_meta/` ou as worktrees mudam

O `just do-sprint` que abria isto morreu com o runner em 19/08, e NÃO ganhou verbo
em `my`: verbo se escreve pra quem chama, e neste ficheiro o único chamador era a
receita. No dia em que alguém publicar quadro de novo, o verbo nasce em
`src/sprints/`.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ME = Path(__file__).resolve().parent.parent
COCKPIT = os.environ.get("COCKPIT", "http://localhost:5199")
TEMPLATE = ME / "03_resources/templates/cockpit/do_sprint.json"
# O template tem quatro raias desenhadas. Sprint além disso não aparece — e o
# script DIZ, em vez de cortar em silêncio.
RAIAS = 4


def board(run: str | None) -> dict:
    argv = ["bun", "run", str(ME / "src/meta.ts"), "board", run or ultima(), "--json"]
    return json.loads(subprocess.run(argv, cwd=ME, capture_output=True, text=True).stdout)


def tem_plano(d: str) -> bool:
    """`sprints.yaml` OU `sprints_001.yaml` — um plano pode chegar em pacotes.

    Era `sprints.yaml` literal, nos dois lugares que listam runs. Quando
    #sprint_package renomeou o plano para `sprints_NNN.yaml`, as runs 013 e 014
    sumiram do menu sem nada quebrar: o filtro devolvia menos, não errado. É o
    mesmo modo de falha que deixou a Mel sem KNOWLEDGE.md por duas semanas —
    um caminho que deixou de existir e um `exists()` que responde `False` em
    silêncio."""
    return bool(list((ME / "_meta" / d).glob("sprints*.yaml")))


def runs_com_plano() -> list[str]:
    return sorted(d for d in os.listdir(ME / "_meta") if d[:3].isdigit() and tem_plano(d))


def ultima() -> str:
    """A run mais nova COM plano. Sem plano não há quadro — e mostrar a anterior
    seria mostrar o passado como se fosse o presente."""
    return runs_com_plano()[-1]


def compoe(b: dict) -> tuple[list, int, int]:
    tasks = [t for s in b["sprints"] for t in s["tasks"]]
    feitos = len([t for t in tasks if t["column"] == "done"])
    # AS RUNS, MAIS NOVA NO TOPO. A ordem é a do disco invertida — quem abre um
    # menu de ciclos quer o de agora, e o de agora é o último número.
    runs = list(reversed(runs_com_plano()))
    # O NÚMERO NÃO DIZ NADA SOZINHO. `010` é a chave primária; `research select
    # component` é o que a pessoa lembra. No menu fechado e em cada item da lista
    # os dois andam juntos — é a mesma razão pela qual a pasta virou
    # `NNN_<tipo>_<slug>` em vez de `NNN_run`: chave é para o computador achar,
    # nome é para o humano reconhecer.
    def rotulo(r: str) -> str:
        return f"{r[:3]}  {r[4:].replace('_', ' ')}"

    data = {
        # O RÓTULO FECHADO É SÓ `run`. A identidade inteira já está no cabeçalho
        # do quadro, em corpo grande, dois centímetros abaixo — repeti-la na barra
        # era a mesma frase duas vezes, uma em cima da outra. Fechado o menu diz o
        # que ele SELECIONA; aberto, ele mostra entre o quê.
        # O GLIFO DIZ O QUE É antes de a palavra ser lida. `\uf04b` (play, Nerd
        # Font) porque uma run é uma coisa que RODA — e num menu de um item só, o
        # ícone é o que dá a ele um lugar reconhecível na barra em vez de ser mais
        # uma palavra solta.
        "menu_label": "\uf04b run",
        "runs": [
            {"label": rotulo(r), "href": f"?run={r[:3]}", "current": r == b["run"]}
            for r in runs
        ],
        "run": b["run"][:3],
        "assunto": b["run"][4:].replace("_", " "),
        "feitos": str(feitos),
        "total": f"de {len(tasks)}",
    }
    for i in range(RAIAS):
        k = f"s{i + 1}"
        s = b["sprints"][i] if i < len(b["sprints"]) else None
        data[k] = s["id"] if s else ""
        for col in ("backlog", "in_progress", "done"):
            # O TEMPO VEM PRIMEIRO no cartão: em obra, há quanto tempo está nesta
            # fase; em done, o ciclo inteiro. É a única coluna que muda sozinha,
            # e lê-la primeiro é o que transforma o quadro num relógio.
            #
            # O RELÓGIO É UM GLIFO (`\uf017`, Nerd Font), não a palavra "tempo".
            # Num cartão de uma linha, três letras de rótulo custam três letras de
            # título — e o desenho de um relógio não precisa de tradução nem de
            # legenda. A fonte está instalada nesta máquina e encabeça a pilha do
            # `--font-mono`; onde ela não estiver, cai num quadrado, que é feio e
            # não esconde nada.
            data[f"{k}_{col}"] = [
                f'\uf017 {t["age"]:>5}  {t["title"]}' if t["age"] else t["title"]
                for t in (s["tasks"] if s else []) if t["column"] == col
            ]

    corpo = json.loads(TEMPLATE.read_text())
    cru = json.dumps(corpo)
    for k in ("run", "assunto", "feitos", "total", "menu_label", *(f"s{i + 1}" for i in range(RAIAS))):
        cru = cru.replace("{{%s}}" % k, str(data[k]).replace('"', "'"))
    corpo = json.loads(cru)
    corpo[1]["updateDataModel"]["contents"].update(
        {k: v for k, v in data.items() if isinstance(v, list)}
    )
    return corpo, feitos, len(tasks)


def publica(run: str | None = None) -> str:
    b = board(run)
    if len(b["sprints"]) > RAIAS:
        print(f"aviso: {len(b['sprints'])} sprints, {RAIAS} raias — as últimas não aparecem",
              file=sys.stderr)
    corpo, feitos, total = compoe(b)
    req = urllib.request.Request(
        f"{COCKPIT}/api/panel", data=json.dumps(corpo).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    urllib.request.urlopen(req)
    return f"{b['run']}  {feitos}/{total}"


def impressao_digital(run: str) -> str:
    """O que faz o quadro mudar, num string só: as worktrees e o disco da run.

    Um `fs.watch` não vê `git worktree add` — a worktree nasce fora da pasta que
    interessaria vigiar, e o único sinal é o próprio git. Então o laço compara
    uma impressão digital em vez de escutar um evento: mais burro, e é o que
    pega as três fontes com a mesma linha."""
    d = ME / "_meta" / run
    wt = subprocess.run(["git", "worktree", "list"], cwd=ME, capture_output=True, text=True).stdout
    ev = sorted(os.listdir(d / "_events")) if (d / "_events").exists() else []
    plano = (d / "sprints.yaml").stat().st_mtime if (d / "sprints.yaml").exists() else 0
    return f"{wt}|{ev}|{plano}"


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--watch"]
    run = args[0] if args else None
    if "--watch" not in sys.argv:
        print(publica(run))
        raise SystemExit(0)

    alvo = run or ultima()
    print(publica(alvo), "· vigiando")
    anterior = impressao_digital(alvo)
    while True:
        time.sleep(2)
        agora = impressao_digital(alvo)
        if agora == anterior:
            continue
        anterior = agora
        print(publica(alvo), "· mudou")
