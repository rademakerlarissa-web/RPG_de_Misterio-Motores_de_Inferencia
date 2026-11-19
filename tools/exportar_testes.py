#!/usr/bin/env python3
"""Roda o pytest de verdade e grava o resultado em data/testes.js (a tabela do módulo M6 lê esse arquivo).
Nada é preenchido à mão: cada linha é um teste executado (ou pulado) com o tempo medido."""
import datetime, json, os, platform, subprocess, sys, tempfile
import xml.etree.ElementTree as ET
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
xml = os.path.join(tempfile.mkdtemp(), "r.xml")
t0 = datetime.datetime.now()
proc = subprocess.run([sys.executable, "-m", "pytest", "tests", "-q", "--junitxml", xml, "-p", "no:cacheprovider"], cwd=RAIZ, capture_output=True, text=True)
casos = []
for tc in ET.parse(xml).getroot().iter("testcase"):
    estado = "passou"; motivo = ""
    for filho in tc:
        if filho.tag in ("failure", "error"): estado = "falhou"; motivo = (filho.get("message") or "")[:200]
        elif filho.tag == "skipped": estado = "pulado"; motivo = filho.get("message") or ""
    arq = tc.get("classname", "").split(".")[-1]
    casos.append({"arquivo": arq, "nome": tc.get("name"), "estado": estado, "tempo": round(float(tc.get("time", 0)), 3), "motivo": motivo})
res = {
    "quando": t0.strftime("%d/%m/%Y %H:%M"), "python": platform.python_version(),
    "comando": "python -m pytest tests",
    "total": len(casos), "passaram": sum(c["estado"] == "passou" for c in casos),
    "falharam": sum(c["estado"] == "falhou" for c in casos), "pulados": sum(c["estado"] == "pulado" for c in casos),
    "casos": casos,
}
open(os.path.join(RAIZ, "data/testes.js"), "w", encoding="utf-8").write("window.GE_TESTES = " + json.dumps(res, ensure_ascii=False) + ";\n")
print(res["passaram"], "passaram,", res["falharam"], "falharam,", res["pulados"], "pulados")
sys.exit(0 if res["falharam"] == 0 else 1)
