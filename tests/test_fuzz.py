"""Casos aleatórios (semente fixa): SLD × oráculo independente × SAT."""
import random
import pytest
from motor.consultas import Caso
from motor import sat as SAT, referencia


def sorteia(seed):
    r = random.Random(seed)
    n = r.randint(3, 5)
    salas = [f"s{i}" for i in range(n)]
    cor = [[salas[i], salas[i + 1], r.randint(1, 5)] for i in range(n - 1)]          # árvore conexa
    for _ in range(r.randint(0, 2)):                                                  # ciclos extras
        a, b = r.sample(salas, 2); cor.append([a, b, r.randint(1, 6)])
    pessoas = [f"p{i}" for i in range(r.randint(2, 4))]
    j1 = r.randint(6, 12); j2 = j1 + r.randint(0, 8)
    regs = []
    for p in pessoas:
        for _ in range(r.randint(0, 3)):
            regs.append([p, r.choice(salas), r.randint(0, 24)])
    deps = []
    for p in pessoas:
        if r.random() < 0.7:
            de = r.randint(0, 10); deps.append([p, r.choice(salas), de, de + r.randint(2, 20)])
    return {"corredores": cor, "local_do_crime": r.choice(salas), "janela": [j1, j2], "registros": regs, "depoimentos": deps}


@pytest.mark.parametrize("seed", range(60))
def test_sld_igual_ao_oraculo(seed):
    d = sorteia(seed)
    c = Caso(d)
    ref = referencia.analisar(d)
    assert sorted(c.suspeitos()) == sorted(ref["suspeitos"]), d
    assert sorted(c.liberados()) == sorted(p for p, i in ref["pessoas"].items() if i["liberado"])
    assert sorted(c.refutados()) == sorted((p, s, a, b) for p, i in ref["pessoas"].items() for s, a, b in i["refutados"])
    for p, i in ref["pessoas"].items():
        if not i["impossiveis"]:   # com registros contraditórios os intervalos não têm significado
            assert c.janelas(p, d["local_do_crime"]) == i["janela"][d["local_do_crime"]]


@pytest.mark.parametrize("seed", range(60, 90))
def test_sat_igual_ao_sld(seed):
    d = sorteia(seed)
    c = Caso(d)
    j1, j2 = d["janela"]
    for p, info in referencia.analisar(d)["pessoas"].items():
        r = SAT.consistencia(d, p)
        assert r["sat"] == (not info["impossiveis"]), (seed, p)
        if r["sat"]:
            m = set(SAT.minutos_possiveis(d, p, d["local_do_crime"], j1, j2))
            sld = {t for a, b in c.janelas(p, d["local_do_crime"]) for t in range(a, b + 1)}
            assert m == sld, (seed, p)
        # SAT refuta pelo menos tudo o que o SLD refuta (e pode refutar mais: tempo de viagem)
        if r["sat"]:
            for s, de, ate in info["refutados"]:
                assert SAT.depoimento_refutado_sat(d, p, s, de, ate)["refutado"] is True
