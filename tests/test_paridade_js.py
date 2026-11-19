"""Paridade Python × JavaScript: o site roda o motor em JS; aqui se confere que ele dá EXATAMENTE as mesmas respostas do Python
(análise, consultas com número de inferências, SAT com estatísticas, DIMACS, conjunto mínimo e árvore de prova)."""
import glob, json, os, shutil, subprocess
import pytest
from conftest import RAIZ
from motor.consultas import Caso
from motor.base import pessoas_do
from motor import sat as SAT

NODE = shutil.which("node")
CASOS = sorted(glob.glob(os.path.join(RAIZ, "casos", "*.json")))
QUERIES = ["suspeito(P)", "liberado(P)", "pode_na_janela(P, X, I, F)", "refutado(P, S, De, Ate)", "distancia(A, B, D)"]


def resumo_python(dados):
    c = Caso(dados)
    out = {"analise": c.analise(), "consultas": {}, "sat": c.sat_todos(), "sat_suspeitos": c.sat_suspeitos(), "dimacs": {}}
    for q in QUERIES:
        r = c.consultar(q)
        out["consultas"][q] = {"solucoes": r["solucoes"], "inferencias": r["inferencias"]}
    for p in pessoas_do(dados):
        out["dimacs"][p] = SAT.Codificacao(dados, p).dimacs()
    out["decisivos"] = c.depoimentos_decisivos()
    out["sozinha"] = c.saiu_sozinha()
    out["prova"] = c.prova("suspeito(P)")
    return json.loads(json.dumps(out, default=list))


@pytest.mark.skipif(NODE is None, reason="node não está instalado")
@pytest.mark.parametrize("arq", CASOS, ids=[os.path.basename(a)[:-5] for a in CASOS])
def test_js_igual_ao_python(arq):
    dados = json.load(open(arq, encoding="utf-8"))
    r = subprocess.run([NODE, os.path.join(RAIZ, "tests", "paridade.js"), arq], capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stderr
    js = json.loads(r.stdout)
    py = resumo_python(dados)
    for chave in py:
        assert js[chave] == py[chave], f"diverge em '{chave}'"
