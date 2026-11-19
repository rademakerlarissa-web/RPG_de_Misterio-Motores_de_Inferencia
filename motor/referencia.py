"""Implementação de REFERÊNCIA (independente do motor SLD): Floyd–Warshall + lógica de intervalos.
Serve de oráculo nos testes: o motor de inferência precisa dar as mesmas respostas."""
from .sat import distancias

INF = 1000


def analisar(caso, pessoas=None):
    salas, d = distancias(caso)
    j1, j2 = caso["janela"]
    crime = caso["local_do_crime"]
    if pessoas is None:
        pessoas = []
        for r in caso["registros"]:
            if r[0] not in pessoas: pessoas.append(r[0])
        for r in caso["depoimentos"]:
            if r[0] not in pessoas: pessoas.append(r[0])
    out = {"pessoas": {}, "suspeitos": []}
    for p in pessoas:
        regs = sorted({(r[2], r[1]) for r in caso["registros"] if r[0] == p})
        inter = {s: [] for s in salas}
        imp = []
        for x in salas:
            if not regs:
                inter[x].append((-INF, INF))
            if regs:
                t0, s0 = regs[0]
                if d[(x, s0)] != float("inf") and -INF <= t0 - d[(x, s0)]:
                    inter[x].append((-INF, t0 - d[(x, s0)]))
                t1, s1 = regs[-1]
                if d[(s1, x)] != float("inf"):
                    inter[x].append((t1 + d[(s1, x)], INF))
            for (ta, sa), (tb, sb) in zip(regs, regs[1:]):
                if ta == tb:
                    continue
                if d[(sa, x)] != float("inf") and d[(x, sb)] != float("inf"):
                    a, b = ta + d[(sa, x)], tb - d[(x, sb)]
                    if a <= b:
                        inter[x].append((a, b))
        for (ta, sa), (tb, sb) in zip(regs, regs[1:]):
            if ta != tb and (d[(sa, sb)] == float("inf") or tb - ta < d[(sa, sb)]):
                imp.append((sa, ta, sb, tb))
        for i, (ta, sa) in enumerate(regs):                     # mesmo minuto, salas diferentes
            for tb, sb in regs[i + 1:]:
                if ta == tb and sa != sb:
                    imp.append((sa, ta, sb, tb))
        janela = {}
        for x in salas:
            v = []
            for a, b in inter[x]:
                a, b = max(a, j1), min(b, j2)
                if a <= b:
                    v.append((a, b))
            janela[x] = sorted(set(v))
        refut = []
        for q, s, de, ate in caso["depoimentos"]:
            if q == p and any(s2 != s and de <= t <= ate for t, s2 in regs):
                refut.append((s, de, ate))
        lib = any(q == p and (q, s, de, ate) and (s, de, ate) not in refut and de <= j1 and j2 <= ate and s != crime
                  for q, s, de, ate in caso["depoimentos"])
        susp = (not lib) and bool(janela[crime]) and not imp
        out["pessoas"][p] = {"liberado": lib, "refutados": refut, "janela": janela, "impossiveis": imp, "suspeito": susp}
        if susp:
            out["suspeitos"].append(p)
    return out
