"""Resolução SLD sobre cláusulas de Horn (M3), com meta-interpretador `prova` (M2).

- renomeação de variáveis a cada uso de uma cláusula
- limite de profundidade e detecção de laço (objetivo variante de um ancestral)
- predicados embutidos: is/2, comparações, =/2, \\=/2, \\+/1 (negação por falha), findall/3, min_list/2, max_list/2
  (a unificação sozinha não faz aritmética; este é o "mecanismo de comparação" pedido para o Contexto 2)
- cada solução vem com a árvore de prova (objetivo, regra, unificador, filhos)
"""
import sys
from .termos import (Comp, Var, NIL, caminhar, aplicar, unificar, renomear, variante, formatar, lista, variaveis)

sys.setrecursionlimit(20000)
COMPARACOES = {"<", ">", "=<", ">=", "=:=", "=\\="}


class ErroDeMotor(Exception):
    pass


def avaliar(t, s):
    """Avalia uma expressão aritmética (inteiros, + - * max min abs)."""
    t = caminhar(t, s)
    if isinstance(t, int):
        return t
    if isinstance(t, Var):
        raise ErroDeMotor("variável sem valor numa expressão aritmética")
    if isinstance(t, Comp):
        if len(t.args) == 2 and t.f in ("+", "-", "*", "max", "min"):
            a, b = avaliar(t.args[0], s), avaliar(t.args[1], s)
            return {"+": a + b, "-": a - b, "*": a * b, "max": max(a, b), "min": min(a, b)}[t.f]
        if len(t.args) == 1 and t.f == "abs":
            return abs(avaliar(t.args[0], s))
    raise ErroDeMotor("expressão aritmética inválida: " + formatar(t, s))


def _itens(l, s):
    out, l = [], caminhar(l, s)
    while isinstance(l, Comp) and l.f == "." and len(l.args) == 2:
        out.append(aplicar(l.args[0], s)); l = caminhar(l.args[1], s)
    if l != NIL:
        raise ErroDeMotor("lista incompleta")
    return out


class Motor:
    def __init__(self, clausulas, limite=300, max_inferencias=2_000_000):
        self.limite, self.max_inf = limite, max_inferencias
        self.indice = {}
        for c in clausulas:
            self.indice.setdefault((c.cabeca.f, len(c.cabeca.args)), []).append(c)
        self.inferencias = 0
        self.limite_atingido = False
        self.lacos_cortados = 0

    # ---------------------------------------------------------- API
    def resolver(self, objetivos, s=None):
        """Gera (substituição, [árvores de prova]) para cada solução, em ordem de busca em profundidade."""
        for s2, provas in self._conj(list(objetivos), s or {}, 0, ()):
            yield s2, provas

    def todas(self, objetivos, vars_=None):
        """Lista de soluções: cada uma é {nome_var: termo} + árvores de prova."""
        res = []
        for s, provas in self.resolver(objetivos):
            res.append((s, provas))
        return res

    def prova(self, objetivo):
        """Meta-interpretador: devolve (substituição, árvore) da primeira prova de `objetivo`, ou None."""
        for s, provas in self.resolver([objetivo]):
            return s, provas[0]
        return None

    # ---------------------------------------------------------- núcleo
    def _conj(self, goals, s, prof, anc):
        if not goals:
            yield s, []
            return
        g, resto = goals[0], goals[1:]
        for s1, no in self._um(g, s, prof, anc):
            for s2, nos in self._conj(resto, s1, prof, anc):
                yield s2, [no] + nos

    def _um(self, g, s, prof, anc):
        g = caminhar(g, s)
        if isinstance(g, Var):
            raise ErroDeMotor("objetivo é uma variável livre")
        self.inferencias += 1
        if self.inferencias > self.max_inf:
            raise ErroDeMotor("excedeu o máximo de inferências")
        f, n = g.f, len(g.args)
        # ---- embutidos
        if f == "is" and n == 2:
            v = avaliar(g.args[1], s)
            s2 = unificar(g.args[0], v, s)
            if s2 is not None:
                yield s2, self._no(g, s2, "embutido: is/2 (avalia a expressão)", [])
            return
        if f in COMPARACOES and n == 2:
            a, b = avaliar(g.args[0], s), avaliar(g.args[1], s)
            ok = {"<": a < b, ">": a > b, "=<": a <= b, ">=": a >= b, "=:=": a == b, "=\\=": a != b}[f]
            if ok:
                yield s, self._no(g, s, f"embutido: comparação {f}", [])
            return
        if f == "=" and n == 2:
            s2 = unificar(g.args[0], g.args[1], s)
            if s2 is not None:
                yield s2, self._no(g, s2, "embutido: unificação", [])
            return
        if f == "\\=" and n == 2:
            if unificar(g.args[0], g.args[1], s) is None:
                yield s, self._no(g, s, "embutido: não unifica", [])
            return
        if f == "\\+" and n == 1:
            for _ in self._um(g.args[0], s, prof + 1, anc):
                return
            yield s, self._no(g, s, "negação por falha: o objetivo interno não tem prova", [])
            return
        if f == "findall" and n == 3:
            achados = [aplicar(g.args[0], s2) for s2, _ in self._um(g.args[1], s, prof + 1, anc)]
            s2 = unificar(g.args[2], lista(achados), s)
            if s2 is not None:
                yield s2, self._no(g, s2, "embutido: findall/3 (coleta todas as soluções)", [])
            return
        if f in ("min_list", "max_list") and n == 2:
            xs = [avaliar(x, s) for x in _itens(g.args[0], s)]
            if xs:
                s2 = unificar(g.args[1], (min if f == "min_list" else max)(xs), s)
                if s2 is not None:
                    yield s2, self._no(g, s2, f"embutido: {f}/2", [])
            return
        # ---- cláusulas da base
        if prof >= self.limite:
            self.limite_atingido = True
            return
        for a in anc:
            if variante(aplicar(g, s), a):
                self.lacos_cortados += 1
                return
        anc2 = anc + (aplicar(g, s),)
        for c in self.indice.get((f, n), ()):
            m = {}
            cab = renomear(c.cabeca, m)
            s1 = unificar(g, cab, s)
            if s1 is None:
                continue
            corpo = [renomear(x, m) for x in c.corpo]
            for s2, filhos in self._conj(corpo, s1, prof + 1, anc2):
                yield s2, self._no(g, s2, c, filhos, m)

    # ---------------------------------------------------------- árvore de prova
    def _no(self, g, s, regra, filhos, m=None):
        """Nó: objetivo já instanciado, regra usada, unificador (só as variáveis da cláusula) e filhos.
        O objetivo é instanciado de forma preguiçosa: guardamos (g, s) e resolvemos ao exportar."""
        return {"_g": g, "_s": s, "_regra": regra, "_m": m, "filhos": filhos}


def exportar(no, s_final=None):
    """Converte o nó em dicionário simples (JSON): objetivo, regra, unificador, filhos."""
    s = no["_s"] if s_final is None else s_final
    # usa a substituição final da solução para instanciar tudo
    obj = formatar(aplicar(no["_g"], s))
    r = no["_regra"]
    if isinstance(r, str):
        regra, tipo = r, "embutido"
    elif r.corpo:
        regra, tipo = repr_clausula(r), "regra"
    else:
        regra, tipo = "fato", "fato"
    uni = {}
    if no["_m"]:
        for v_orig, v_novo in no["_m"].items():
            val = aplicar(v_novo, s)
            if v_orig.nome != "_" and not isinstance(val, Var):
                uni[v_orig.nome] = formatar(val)
    return {"objetivo": obj, "tipo": tipo, "regra": regra, "unificador": uni, "filhos": [exportar(f, s) for f in no["filhos"]]}


def repr_clausula(c):
    import re
    return re.sub(r"_G\d+", "_", formatar(c.cabeca) + " :- " + ", ".join(formatar(x) for x in c.corpo) + ".")
