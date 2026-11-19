#!/usr/bin/env python3
"""Gata Estrela — CLI do motor de inferência (M5).

Exemplos:
  python main.py --entrada casos/oficial.json --pergunta quem-levou
  python main.py --entrada casos/oficial.json --pergunta consulta --objetivo "suspeito(P)"
  python main.py --entrada casos/oficial.json --pergunta prova --objetivo "refutado(guarda, S, De, Ate)"
  python main.py --entrada casos/oficial.json --pergunta sat --formato json
  python main.py --entrada casos/oficial.json --pergunta dimacs --pessoa guarda --saida guarda.cnf
"""
import argparse
import json
import sys
from motor.consultas import Caso
from motor.base import CasoInvalido, programa_texto
from motor import sat as SAT

PERGUNTAS = ["quem-levou", "distancia", "onde-pode", "refutados", "impossiveis", "liberados", "consulta", "prova",
             "sat", "sat-consequencia", "sat-contar", "dimacs", "depoimentos-decisivos", "programa"]


def arvore_txt(n, nivel=0):
    pad = "  " * nivel
    s = f"{pad}{n['objetivo']}   [{n['tipo']}]"
    if n["tipo"] == "regra":
        s += f"  por  {n['regra']}"
    if n["unificador"]:
        s += "   θ = {" + ", ".join(f"{k}/{v}" for k, v in n["unificador"].items()) + "}"
    return "\n".join([s] + [arvore_txt(f, nivel + 1) for f in n["filhos"]])


def faixas(v):
    return ", ".join(f"{a}–{b}" for a, b in v) if v else "nenhum"


def executar(c, a):
    P = a.pergunta
    if P == "quem-levou":
        r = c.analise()
        sat_s = c.sat_suspeitos()
        r["sat_suspeitos"] = sat_s
        txt = ["Resultado (motor SLD):"]
        for p in r["pessoas"]:
            txt.append(f"  {p['pessoa']:<10} {p['situacao']:<10} {p['motivo']}")
        txt += ["", "Conclusão: " + r["conclusao"]["texto"],
                "Conferência pelo caminho SAT: " + (", ".join(sat_s) if sat_s else "nenhum suspeito") +
                ("  (concorda)" if sorted(sat_s) == sorted(r["suspeitos"]) else "  (DIVERGE do SLD)")]
        return r, "\n".join(txt)
    if P == "distancia":
        d = c.distancia(a.de, a.ate)
        return {"de": a.de, "ate": a.ate, "minutos": d}, f"distância {a.de} → {a.ate}: " + ("sem caminho" if d is None else f"{d} minutos")
    if P == "onde-pode":
        r = {s: c.janelas(a.pessoa, s) for s in c.dados["corredores"] and sorted({x for k in c.dados["corredores"] for x in k[:2]})}
        return r, "\n".join(f"{a.pessoa} pode ter estado em {s} (na janela): {faixas(v)}" for s, v in r.items())
    if P == "refutados":
        r = c.refutados()
        return r, "\n".join(f"depoimento refutado: {p} disse '{s}' dos minutos {d} a {e}" for p, s, d, e in r) or "nenhum depoimento refutado"
    if P == "impossiveis":
        r = c.impossiveis()
        return r, "\n".join(f"registros incompatíveis: {p}: {s1}@{t1} → {s2}@{t2}" for p, s1, t1, s2, t2 in r) or "nenhum registro impossível"
    if P == "liberados":
        r = c.liberados()
        return r, ", ".join(r) or "ninguém liberado"
    if P == "consulta":
        r = c.consultar(a.objetivo)
        linhas = [("; ".join(f"{k} = {v}" for k, v in s.items()) or "verdadeiro") for s in r["solucoes"]] or ["falso (sem solução)"]
        return r, "\n".join(linhas) + f"\n[{r['inferencias']} inferências]"
    if P == "prova":
        r = c.prova(a.objetivo)
        if not r["provado"]:
            return r, "sem prova para " + a.objetivo
        return r, "\n".join(arvore_txt(n) for n in r["arvore"]) + f"\n[{r['inferencias']} inferências]"
    if P == "sat":
        r = c.sat_todos()
        linhas = []
        for p, x in r.items():
            linhas.append(f"{p}: {'consistente' if x['sat'] else 'INCONSISTENTE — núcleo: ' + '; '.join(x['nucleo'])} "
                          f"({x['variaveis']} variáveis, {x['clausulas']} cláusulas, {x['stats']['decisoes']} decisões)"
                          + (f" · pode estar em {c.dados['local_do_crime']} (na janela): {faixas(x['minutos_no_crime'])}" if x['sat'] else ""))
        return r, "\n".join(linhas)
    if P == "sat-consequencia":
        r = SAT.consequencia(c.dados, a.pessoa, a.sala, a.minuto, a.com_depoimento)
        return r, f"{a.pessoa} em {a.sala} no minuto {a.minuto}: {r['resposta']}" + (f" ({r['refutacao']})" if r["refutacao"] else "")
    if P == "sat-contar":
        j = c.dados["janela"]
        r = SAT.contar_padroes(c.dados, a.pessoa, c.dados["local_do_crime"], j[0], j[1], 2000)
        return r, f"padrões distintos de presença de {a.pessoa} no local do crime: {'≥ ' if r['truncado'] else ''}{r['total']}"
    if P == "dimacs":
        cod = SAT.Codificacao(c.dados, a.pessoa)
        t = cod.dimacs()
        if a.saida:
            open(a.saida, "w").write(t)
            return {"arquivo": a.saida}, f"CNF gravada em {a.saida}"
        return {"dimacs": t}, t
    if P == "depoimentos-decisivos":
        r = c.depoimentos_decisivos()
        atuais = ", ".join(r["suspeitos_atuais"]) or "ninguém"
        if not r["tamanho"]:
            return r, f"Suspeito(s) atual(is): {atuais}. Nenhum conjunto de depoimentos falsos mudaria isso."
        linhas = [f"Suspeito(s) atual(is): {atuais}.",
                  f"Menor conjunto de depoimentos que, se falsos, muda o resultado: {r['tamanho']} depoimento(s)."]
        for x in r["conjuntos"]:
            dep = "; ".join(f"{p} diz '{s}' de {de} a {ate}" for p, s, de, ate in x["depoimentos"])
            linhas.append(f"  - se for falso: {dep}  =>  suspeito(s): {', '.join(x['suspeitos']) or 'ninguém'}")
        return r, "\n".join(linhas)
    if P == "programa":
        t = programa_texto(c.dados)
        return {"programa": t}, t


def main(argv=None):
    ap = argparse.ArgumentParser(description="Motor de inferência — linha do tempo do museu")
    ap.add_argument("--entrada", required=True, help="arquivo JSON do caso")
    ap.add_argument("--pergunta", choices=PERGUNTAS, default="quem-levou")
    ap.add_argument("--formato", choices=["texto", "json"], default="texto")
    ap.add_argument("--objetivo", help="objetivo Prolog (consulta / prova)")
    ap.add_argument("--pessoa"); ap.add_argument("--sala"); ap.add_argument("--minuto", type=int)
    ap.add_argument("--de"); ap.add_argument("--ate")
    ap.add_argument("--com-depoimento", action="store_true")
    ap.add_argument("--saida", help="arquivo de saída (dimacs)")
    a = ap.parse_args(argv)
    try:
        dados = json.load(open(a.entrada, encoding="utf-8"))
    except FileNotFoundError:
        print(f"erro: arquivo '{a.entrada}' não encontrado", file=sys.stderr); return 2
    except json.JSONDecodeError as e:
        print(f"erro: JSON inválido ({e})", file=sys.stderr); return 2
    try:
        c = Caso(dados)
    except CasoInvalido as e:
        print(f"erro no caso: {e}", file=sys.stderr); return 2
    exigidos = {"distancia": ("de", "ate"), "onde-pode": ("pessoa",), "consulta": ("objetivo",), "prova": ("objetivo",),
                "sat-consequencia": ("pessoa", "sala", "minuto"), "sat-contar": ("pessoa",), "dimacs": ("pessoa",)}
    faltam = [x for x in exigidos.get(a.pergunta, ()) if getattr(a, x) is None]
    if faltam:
        print("erro: esta pergunta precisa de " + ", ".join("--" + f for f in faltam), file=sys.stderr); return 2
    try:
        r, txt = executar(c, a)
    except (ValueError, Exception) as e:
        print(f"erro ao executar: {e}", file=sys.stderr); return 1
    print(json.dumps(r, ensure_ascii=False, indent=2, default=list) if a.formato == "json" else txt)
    return 0


if __name__ == "__main__":
    sys.exit(main())
