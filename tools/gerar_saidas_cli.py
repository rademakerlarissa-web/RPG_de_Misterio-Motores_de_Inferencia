#!/usr/bin/env python3
"""Executa a CLI de verdade (main.py) para alguns comandos e grava as saídas em data/saidas-cli.js,
que o site mostra no módulo M5 (rotuladas como 'saída gravada')."""
import datetime, json, os, platform, subprocess, sys
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CMDS = [
    ["--entrada", "casos/oficial.json", "--pergunta", "quem-levou"],
    ["--entrada", "casos/oficial.json", "--pergunta", "prova", "--objetivo", "refutado(guarda, S, De, Ate)"],
    ["--entrada", "casos/oficial.json", "--pergunta", "consulta", "--objetivo", "distancia(hall, reserva, D)"],
    ["--entrada", "casos/oficial.json", "--pergunta", "sat"],
    ["--entrada", "casos/oficial.json", "--pergunta", "sat-consequencia", "--pessoa", "guarda", "--sala", "galeria", "--minuto", "20"],
    ["--entrada", "casos/sem-registro-guarda.json", "--pergunta", "quem-levou"],
    ["--entrada", "casos/inconsistente.json", "--pergunta", "quem-levou"],
    ["--entrada", "casos/mais-de-um-suspeito.json", "--pergunta", "quem-levou"],
    ["--entrada", "casos/oficial.json", "--pergunta", "depoimentos-decisivos"],
]
saidas = []
for c in CMDS:
    r = subprocess.run([sys.executable, "main.py"] + c, cwd=RAIZ, capture_output=True, text=True)
    saidas.append({"comando": "python main.py " + " ".join(f'"{x}"' if " " in x else x for x in c),
                   "saida": (r.stdout or r.stderr).rstrip(), "codigo": r.returncode})
d = {"quando": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"), "python": platform.python_version(), "saidas": saidas}
open(os.path.join(RAIZ, "data/saidas-cli.js"), "w", encoding="utf-8").write("window.GE_CLI = " + json.dumps(d, ensure_ascii=False, indent=1) + ";\n")
print("ok", len(saidas), "saídas")
