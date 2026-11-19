"""M4 — SAT: codificação em CNF do mesmo problema + solucionador DPLL com propagação unitária.

Variável x(p, s, t) = "a pessoa p está na sala s no minuto t" (s pode ser 'transito', sala fictícia
que representa estar nos corredores). Restrições (cláusulas):
  1. pelo menos uma sala por minuto           (x1 ∨ x2 ∨ ... ∨ transito)
  2. no máximo uma sala por minuto            (¬xi ∨ ¬xj) para cada par
  3. tempo de deslocamento                    (¬x(s,t) ∨ ¬x(s',t')) se 0 < t'-t < dist(s,s')
  4. cada registro é uma cláusula unitária    (x(p,s,t))
  5. (opcional) depoimento: x(p,s,t) para todo t em [de, até]
"""
import itertools
from .base import atomo_seguro

TRANSITO = "transito"


def distancias(caso):
    """Floyd–Warshall sobre o mapa (grafo não-orientado)."""
    salas = []
    for a, b, _ in caso["corredores"]:
        for s in (a, b):
            if s not in salas:
                salas.append(s)
    INF = float("inf")
    d = {(a, b): (0 if a == b else INF) for a in salas for b in salas}
    for a, b, w in caso["corredores"]:
        d[(a, b)] = min(d[(a, b)], w); d[(b, a)] = min(d[(b, a)], w)
    for k in salas:
        for i in salas:
            for j in salas:
                if d[(i, k)] + d[(k, j)] < d[(i, j)]:
                    d[(i, j)] = d[(i, k)] + d[(k, j)]
    return salas, d


def horizonte(caso):
    ts = [caso["janela"][0], caso["janela"][1], 0]
    ts += [r[2] for r in caso["registros"]]
    for d in caso["depoimentos"]:
        ts += [d[2], d[3]]
    return min(ts), max(ts)


class Solver:
    """DPLL com propagação unitária por contadores, trilha e desfazer."""

    def __init__(self, nvars, clausulas):
        self.n = nvars
        self.cl = [list(c) for c in clausulas]
        self.val = [0] * (nvars + 1)          # 0 livre, 1 verdadeiro, -1 falso
        self.occ = {}
        for i, c in enumerate(self.cl):
            for l in c:
                self.occ.setdefault(l, []).append(i)
        self.sat = [0] * len(self.cl)         # literais verdadeiros na cláusula
        self.livres = [len(c) for c in self.cl]
        self.trilha = []
        self.fila = []
        self.stats = {"decisoes": 0, "propagacoes": 0, "conflitos": 0}
        self.ordem = sorted(range(1, nvars + 1), key=lambda v: -len(self.occ.get(v, ())) - len(self.occ.get(-v, ())))
        self.ok = True
        for i, c in enumerate(self.cl):        # unitárias e vazias iniciais
            if not c:
                self.ok = False
            elif len(c) == 1:
                self.fila.append(c[0])
        self.ok = self.ok and self._propagar()

    def _valor(self, l):
        v = self.val[abs(l)]
        return v if l > 0 else -v

    def _atribuir(self, l):
        """Coloca l como verdadeiro. Retorna False em conflito."""
        v = self._valor(l)
        if v == 1:
            return True
        if v == -1:
            return False
        self.val[abs(l)] = 1 if l > 0 else -1
        self.trilha.append(l)
        self.stats["propagacoes"] += 1
        for c in self.occ.get(l, ()):
            self.sat[c] += 1
            self.livres[c] -= 1
        conflito = False
        for c in self.occ.get(-l, ()):       # percorre tudo (os contadores precisam ficar coerentes p/ desfazer)
            self.livres[c] -= 1
            if self.sat[c] == 0:
                if self.livres[c] == 0:
                    conflito = True
                elif self.livres[c] == 1:
                    for m in self.cl[c]:
                        if self.val[abs(m)] == 0:
                            self.fila.append(m); break
        return not conflito

    def _propagar(self):
        while self.fila:
            l = self.fila.pop()
            if not self._atribuir(l):
                self.fila.clear(); self.stats["conflitos"] += 1
                return False
        return True

    def desfazer(self, ate):
        while len(self.trilha) > ate:
            l = self.trilha.pop()
            self.val[abs(l)] = 0
            for c in self.occ.get(l, ()):
                self.sat[c] -= 1; self.livres[c] += 1
            for c in self.occ.get(-l, ()):
                self.livres[c] += 1
        self.fila.clear()

    def supor(self, l):
        """Assume l e propaga. Retorna False (e desfaz) se houver conflito."""
        marca = len(self.trilha)
        self.fila.append(l)
        if self._propagar():
            return True
        self.desfazer(marca)
        return False

    def resolver(self):
        """Busca (iterativa) a partir do estado atual. True = SAT (atribuição fica na trilha)."""
        if not self.ok:
            return False
        base = len(self.trilha)
        pilha = []                             # (marca da trilha, variável, 1ª tentativa)
        while True:
            v = next((x for x in self.ordem if self.val[x] == 0), None)
            if v is None:
                return True
            self.stats["decisoes"] += 1
            pilha.append((len(self.trilha), v, True))
            self.fila.append(v)
            ok = self._propagar()
            while not ok:
                while pilha and not pilha[-1][2]:
                    pilha.pop()
                if not pilha:
                    self.desfazer(base)
                    return False
                marca, v, _ = pilha.pop()
                self.desfazer(marca)
                pilha.append((marca, v, False))
                self.fila.append(-v)
                ok = self._propagar()

    def resolver_e_desfazer(self):
        marca = len(self.trilha)
        r = self.resolver()
        modelo = list(self.val) if r else None
        self.desfazer(marca)
        return r, modelo


class Codificacao:
    """CNF de uma pessoa dentro de um caso."""

    def __init__(self, caso, pessoa):
        self.caso, self.pessoa = caso, pessoa
        self.salas, self.dist = distancias(caso)
        self.tmin, self.tmax = horizonte(caso)
        self.locais = self.salas + [TRANSITO]
        self.idx, self.nome = {}, {}
        for t in range(self.tmin, self.tmax + 1):
            for s in self.locais:
                self.idx[(s, t)] = len(self.idx) + 1
                self.nome[self.idx[(s, t)]] = f"x({atomo_seguro(pessoa)},{atomo_seguro(s)},{t})"
        self.estrutura = []
        self._estrutura()
        # itens (hipóteses) = cláusulas unitárias nomeadas
        self.itens = {}
        for r in caso["registros"]:
            p, s, t = r[:3]
            if p == pessoa:
                self.itens[f"registro: {s} no minuto {t}"] = [[self.idx[(s, t)]]]

    def x(self, s, t):
        return self.idx[(s, t)]

    def _estrutura(self):
        E = self.estrutura
        for t in range(self.tmin, self.tmax + 1):
            E.append([self.x(s, t) for s in self.locais])
            for a, b in itertools.combinations(self.locais, 2):
                E.append([-self.x(a, t), -self.x(b, t)])
        for a in self.salas:
            for b in self.salas:
                d = self.dist[(a, b)]
                if a == b or d == float("inf"):
                    if d == float("inf"):  # sem caminho: nunca em a e depois em b
                        for t in range(self.tmin, self.tmax + 1):
                            for t2 in range(t + 1, self.tmax + 1):
                                E.append([-self.x(a, t), -self.x(b, t2)])
                    continue
                for t in range(self.tmin, self.tmax + 1):
                    for t2 in range(t + 1, min(t + d, self.tmax + 1)):  # 0 < t2-t < d
                        E.append([-self.x(a, t), -self.x(b, t2)])

    def depoimento(self, s, de, ate):
        return [[self.x(s, t)] for t in range(de, ate + 1)]

    def clausulas(self, itens=None, extras=()):
        itens = self.itens if itens is None else itens
        C = list(self.estrutura)
        for nome in itens:
            C += self.itens[nome] if nome in self.itens else itens[nome]
        C += [list(c) for c in extras]
        return C

    def solver(self, itens=None, extras=()):
        return Solver(len(self.idx), self.clausulas(itens, extras))

    def dimacs(self, itens=None, extras=()):
        C = self.clausulas(itens, extras)
        L = [f"c Gata Estrela — CNF de '{self.pessoa}' (minutos {self.tmin}..{self.tmax})",
             "c variável x(pessoa,sala,minuto) = a pessoa está na sala naquele minuto"]
        for v, n in sorted(self.nome.items()):
            L.append(f"c {v} = {n}")
        L.append(f"p cnf {len(self.idx)} {len(C)}")
        L += [" ".join(map(str, c)) + " 0" for c in C]
        return "\n".join(L) + "\n"


# ----------------------------------------------------------------- perguntas
def _trajetoria(cod, modelo):
    """Primeira sala (ou trânsito) por minuto, em segmentos [(sala, de, ate)]."""
    seg = []
    for t in range(cod.tmin, cod.tmax + 1):
        s = next(s for s in cod.locais if modelo[cod.x(s, t)] == 1)
        if seg and seg[-1][0] == s:
            seg[-1][2] = t
        else:
            seg.append([s, t, t])
    return [tuple(x) for x in seg]


def consistencia(caso, pessoa, com_depoimento=False):
    """Os registros (e, se pedido, os depoimentos) da pessoa cabem no mapa? Se não, devolve um núcleo mínimo."""
    cod = Codificacao(caso, pessoa)
    itens = dict(cod.itens)
    if com_depoimento:
        for p, s, de, ate in caso["depoimentos"]:
            if p == pessoa:
                itens[f"depoimento: {s} dos minutos {de} a {ate}"] = cod.depoimento(s, de, ate)
    sv = cod.solver(itens)
    ok, modelo = sv.resolver_e_desfazer()
    res = {"sat": bool(ok), "variaveis": len(cod.idx), "clausulas": len(cod.clausulas(itens)), "stats": dict(sv.stats)}
    if ok:
        res["trajetoria"] = _trajetoria(cod, modelo)
        res["nucleo"] = []
    else:  # redução por eliminação: tira um item e vê se continua insatisfatível
        nucleo = list(itens)
        for nome in list(nucleo):
            resto = {k: itens[k] for k in nucleo if k != nome}
            if not cod.solver(resto).resolver_e_desfazer()[0]:
                nucleo.remove(nome)
        res["nucleo"] = nucleo
    return res


def consequencia(caso, pessoa, sala, t, com_depoimento=False):
    """'necessario' (vale em todo modelo, provado por refutação), 'possivel' ou 'impossivel'."""
    cod = Codificacao(caso, pessoa)
    itens = dict(cod.itens)
    if com_depoimento:
        for p, s, de, ate in caso["depoimentos"]:
            if p == pessoa:
                itens[f"depoimento: {s} dos minutos {de} a {ate}"] = cod.depoimento(s, de, ate)
    if not cod.solver(itens).resolver_e_desfazer()[0]:
        return {"resposta": "inconsistente", "refutacao": None}
    x = cod.x(sala, t)
    pode = cod.solver(itens, [[x]]).resolver_e_desfazer()[0]
    nega = cod.solver(itens, [[-x]]).resolver_e_desfazer()[0]   # UNSAT aqui => consequência
    if not pode:
        return {"resposta": "impossivel", "refutacao": "com x verdadeiro a CNF fica insatisfatível"}
    if not nega:
        return {"resposta": "necessario", "refutacao": "somar ¬x à CNF a torna insatisfatível (refutação)"}
    return {"resposta": "possivel", "refutacao": None}


def minutos_possiveis(caso, pessoa, sala, a, b, com_depoimento=False):
    """Minutos t em [a,b] em que existe modelo com a pessoa em `sala`."""
    cod = Codificacao(caso, pessoa)
    itens = dict(cod.itens)
    if com_depoimento:
        for p, s, de, ate in caso["depoimentos"]:
            if p == pessoa:
                itens[f"depoimento: {s} dos minutos {de} a {ate}"] = cod.depoimento(s, de, ate)
    sv = cod.solver(itens)
    if not sv.resolver_e_desfazer()[0]:
        return []
    out = []
    for t in range(max(a, cod.tmin), min(b, cod.tmax) + 1):
        marca = len(sv.trilha)
        if sv.supor(cod.x(sala, t)) and sv.resolver():
            out.append(t)
        sv.desfazer(marca)
    return out


def intervalos(minutos):
    seg = []
    for t in minutos:
        if seg and seg[-1][1] == t - 1:
            seg[-1][1] = t
        else:
            seg.append([t, t])
    return [tuple(s) for s in seg]


def contar_padroes(caso, pessoa, sala, a, b, limite=5000):
    """Quantos padrões distintos de presença em `sala` nos minutos [a,b] os registros permitem
    (contagem de modelos projetada nas variáveis x(sala,t), com teto `limite`)."""
    cod = Codificacao(caso, pessoa)
    sv = cod.solver()
    if not sv.resolver_e_desfazer()[0]:
        return {"total": 0, "truncado": False}
    proj = [cod.x(sala, t) for t in range(max(a, cod.tmin), min(b, cod.tmax) + 1)]
    cont = [0]
    estourou = [False]

    def rec(i):
        if cont[0] >= limite:
            estourou[0] = True
            return
        if i == len(proj):
            if sv.resolver_e_desfazer()[0]:
                cont[0] += 1
            return
        for l in (proj[i], -proj[i]):
            marca = len(sv.trilha)
            if sv.supor(l):
                rec(i + 1)
            sv.desfazer(marca)
    rec(0)
    return {"total": cont[0], "truncado": estourou[0]}


def depoimento_refutado_sat(caso, pessoa, sala, de, ate):
    """Registros + depoimento insatisfatíveis? (mais forte que 'há um registro em outra sala')."""
    cod = Codificacao(caso, pessoa)
    itens = dict(cod.itens)
    if not cod.solver(itens).resolver_e_desfazer()[0]:
        return {"refutado": None, "motivo": "os próprios registros são inconsistentes"}
    chave = f"depoimento: {sala} dos minutos {de} a {ate}"
    itens[chave] = cod.depoimento(sala, de, ate)
    ok = cod.solver(itens).resolver_e_desfazer()[0]
    if ok:
        return {"refutado": False, "nucleo": []}
    nuc = list(itens)
    for nome in list(nuc):
        if nome == chave:
            continue
        resto = {k: itens[k] for k in nuc if k != nome}
        if not cod.solver(resto).resolver_e_desfazer()[0]:
            nuc.remove(nome)
    return {"refutado": True, "nucleo": nuc}
