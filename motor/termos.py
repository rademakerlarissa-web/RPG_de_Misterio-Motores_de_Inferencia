"""Termos, unificação com verificação de ocorrência, composição de substituições e leitor de cláusulas (M3).

Representação:
  Var(nome)            variável (nome começa com maiúscula ou '_' no texto)
  int                  número inteiro
  Comp(functor, args)  átomo (args vazio) ou termo composto; listas usam '.'(Cabeça, Cauda) e '[]'
Substituição: dict {Var: termo}.
"""
import itertools
import re

_contador = itertools.count(1)


class Var:
    __slots__ = ("nome", "uid")

    def __init__(self, nome="_"):
        self.nome, self.uid = nome, next(_contador)

    def __repr__(self):
        return f"{self.nome}_{self.uid}"


class Comp:
    __slots__ = ("f", "args")

    def __init__(self, f, args=()):
        self.f, self.args = f, tuple(args)

    def __eq__(self, o):
        return isinstance(o, Comp) and self.f == o.f and self.args == o.args

    def __hash__(self):
        return hash((self.f, self.args))

    def __repr__(self):
        return formatar(self)


NIL = Comp("[]")


def lista(itens, cauda=NIL):
    r = cauda
    for x in reversed(list(itens)):
        r = Comp(".", (x, r))
    return r


def atomo(nome):
    return Comp(nome)


# ----------------------------------------------------------------- substituições
def caminhar(t, s):
    """Segue ligações de variáveis até um termo não ligado."""
    while isinstance(t, Var) and t in s:
        t = s[t]
    return t


def aplicar(t, s):
    """Aplica a substituição em profundidade."""
    t = caminhar(t, s)
    if isinstance(t, Comp) and t.args:
        return Comp(t.f, tuple(aplicar(a, s) for a in t.args))
    return t


def compor(s1, s2):
    """Composição s1∘s2: aplicar s1 e depois s2 equivale a aplicar o resultado de uma vez."""
    r = {v: aplicar(t, s2) for v, t in s1.items()}
    for v, t in s2.items():
        if v not in r:
            r[v] = t
    return {v: t for v, t in r.items() if not (isinstance(t, Var) and t == v)}


def ocorre(v, t, s):
    t = caminhar(t, s)
    if isinstance(t, Var):
        return t == v
    if isinstance(t, Comp):
        return any(ocorre(v, a, s) for a in t.args)
    return False


def unificar(a, b, s):
    """Unificador mais geral de a e b estendendo s, ou None. Com verificação de ocorrência."""
    a, b = caminhar(a, s), caminhar(b, s)
    if isinstance(a, Var) and isinstance(b, Var) and a == b:
        return s
    if isinstance(a, Var):
        if ocorre(a, b, s):
            return None
        r = dict(s); r[a] = b
        return r
    if isinstance(b, Var):
        return unificar(b, a, s)
    if isinstance(a, Comp) and isinstance(b, Comp):
        if a.f != b.f or len(a.args) != len(b.args):
            return None
        for x, y in zip(a.args, b.args):
            s = unificar(x, y, s)
            if s is None:
                return None
        return s
    return s if (type(a) is type(b) and a == b) else None


def variaveis(t, acc=None):
    acc = [] if acc is None else acc
    if isinstance(t, Var):
        if t not in acc:
            acc.append(t)
    elif isinstance(t, Comp):
        for a in t.args:
            variaveis(a, acc)
    return acc


def renomear(t, mapa):
    if isinstance(t, Var):
        if t not in mapa:
            mapa[t] = Var(t.nome)
        return mapa[t]
    if isinstance(t, Comp) and t.args:
        return Comp(t.f, tuple(renomear(a, mapa) for a in t.args))
    return t


def variante(a, b):
    """a e b são iguais a menos de renomear variáveis? (detecção de laço)"""
    m1, m2 = {}, {}

    def r(x, y):
        if isinstance(x, Var) and isinstance(y, Var):
            if m1.setdefault(x, y) != y or m2.setdefault(y, x) != x:
                return False
            return True
        if isinstance(x, Comp) and isinstance(y, Comp):
            return x.f == y.f and len(x.args) == len(y.args) and all(r(p, q) for p, q in zip(x.args, y.args))
        return type(x) is type(y) and not isinstance(x, (Var, Comp)) and x == y
    return r(a, b)


# ----------------------------------------------------------------- impressão
_OPS = {"is", "<", ">", "=<", ">=", "=:=", "=\\=", "=", "\\=", "+", "-", "*"}


def formatar(t, s=None):
    if s:
        t = aplicar(t, s)
    if isinstance(t, Var):
        return t.nome if t.nome != "_" else f"_G{t.uid}"
    if isinstance(t, int):
        return str(t)
    if t == NIL:
        return "[]"
    if t.f == "." and len(t.args) == 2:
        itens, c = [], t
        while isinstance(c, Comp) and c.f == "." and len(c.args) == 2:
            itens.append(formatar(c.args[0])); c = c.args[1]
        fim = "" if c == NIL else "|" + formatar(c)
        return "[" + ",".join(itens) + fim + "]"
    if t.f == "\\+" and len(t.args) == 1:
        return "\\+ " + formatar(t.args[0])
    if t.f in _OPS and len(t.args) == 2:
        return f"{formatar(t.args[0])} {t.f} {formatar(t.args[1])}"
    if not t.args:
        return t.f if re.fullmatch(r"[a-z][A-Za-z0-9_]*|\[\]", t.f) else "'" + t.f + "'"
    return t.f + "(" + ", ".join(formatar(a) for a in t.args) + ")"


# ----------------------------------------------------------------- leitor
class Clausula:
    __slots__ = ("cabeca", "corpo", "texto")

    def __init__(self, cabeca, corpo=(), texto=None):
        self.cabeca, self.corpo, self.texto = cabeca, tuple(corpo), texto

    def __repr__(self):
        return self.texto or (formatar(self.cabeca) + (" :- " + ", ".join(map(formatar, self.corpo)) if self.corpo else "") + ".")


_TOK = re.compile(r"\s*(?:(%[^\n]*)|(\d+)|([A-Za-z_][A-Za-z0-9_]*)|'([^']*)'|(:-|\\\+|=\\=|=:=|=<|>=|\\=|[()\[\],.|<>=+\-*]))")


def _tokens(txt):
    pos, out = 0, []
    while pos < len(txt):
        if not txt[pos:].strip():
            break
        m = _TOK.match(txt, pos)
        if not m:
            raise ValueError("símbolo inesperado perto de: " + txt[pos:pos + 20].strip())
        pos = m.end()
        com, num, ident, quo, pont = m.groups()
        if com:
            continue
        if num is not None: out.append(("n", int(num)))
        elif ident is not None: out.append(("v" if ident[0].isupper() or ident[0] == "_" else "a", ident))
        elif quo is not None: out.append(("a", quo))
        else: out.append(("p", pont))
    return out


class _Leitor:
    def __init__(self, toks):
        self.t, self.i, self.vars = toks, 0, {}

    def ver(self):
        return self.t[self.i] if self.i < len(self.t) else ("fim", None)

    def comer(self, tipo=None, val=None):
        k = self.ver()
        if (tipo and k[0] != tipo) or (val is not None and k[1] != val):
            raise ValueError(f"esperava {val or tipo}, achei {k[1]!r}")
        self.i += 1
        return k

    def termo(self, prec=1200):
        esq = self.primario()
        while True:
            k = self.ver()
            op = k[1] if k[0] in ("p", "a") else None
            tab = {"is": 700, "<": 700, ">": 700, "=<": 700, ">=": 700, "=:=": 700, "=\\=": 700, "=": 700, "\\=": 700, "+": 500, "-": 500, "*": 400}
            if op in tab and tab[op] <= prec and not (k[0] == "a" and op != "is"):
                self.i += 1
                dir_ = self.termo(tab[op] - 1)
                esq = Comp(op, (esq, dir_))
            else:
                return esq

    def primario(self):
        k = self.ver()
        if k == ("p", "\\+"):
            self.i += 1
            return Comp("\\+", (self.termo(699),))
        if k[0] == "n":
            self.i += 1; return k[1]
        if k == ("p", "-") and self.t[self.i + 1][0] == "n":
            self.i += 2; return -self.t[self.i - 1][1]
        if k == ("p", "("):
            self.i += 1; r = self.termo(); self.comer("p", ")"); return r
        if k == ("p", "["):
            self.i += 1
            if self.ver() == ("p", "]"):
                self.i += 1; return NIL
            itens = [self.termo(999)]
            while self.ver() == ("p", ","):
                self.i += 1; itens.append(self.termo(999))
            cauda = NIL
            if self.ver() == ("p", "|"):
                self.i += 1; cauda = self.termo(999)
            self.comer("p", "]")
            return lista(itens, cauda)
        if k[0] == "v":
            self.i += 1
            if k[1] == "_":
                return Var("_")
            return self.vars.setdefault(k[1], Var(k[1]))
        if k[0] == "a":
            self.i += 1
            if self.ver() == ("p", "("):
                self.i += 1
                args = [self.termo(999)]
                while self.ver() == ("p", ","):
                    self.i += 1; args.append(self.termo(999))
                self.comer("p", ")")
                return Comp(k[1], args)
            return Comp(k[1])
        raise ValueError(f"termo inesperado: {k[1]!r}")

    def corpo(self):
        gs = [self.termo(999)]
        while self.ver() == ("p", ","):
            self.i += 1; gs.append(self.termo(999))
        return gs


def ler_termo(txt):
    """Lê um termo (ou objetivo) de texto. Retorna (termo, {nome: Var})."""
    L = _Leitor(_tokens(txt.strip().rstrip(".")))
    t = L.termo()
    if L.i != len(L.t):
        raise ValueError("sobrou texto: " + str(L.t[L.i][1]))
    return t, L.vars


def ler_objetivos(txt):
    L = _Leitor(_tokens(txt.strip().rstrip(".")))
    g = L.corpo()
    if L.i != len(L.t):
        raise ValueError("sobrou texto: " + str(L.t[L.i][1]))
    return g, L.vars


def ler_programa(txt):
    """Lê cláusulas 'cabeça.' ou 'cabeça :- corpo.' separadas por ponto final."""
    toks, partes, atual = _tokens(txt), [], []
    for k in toks:
        if k == ("p", "."):
            partes.append(atual); atual = []
        else:
            atual.append(k)
    if atual:
        raise ValueError("cláusula sem ponto final")
    out = []
    for p in partes:
        L = _Leitor(p)
        cab = L.termo(999)
        corpo = []
        if L.ver() == ("p", ":-"):
            L.i += 1; corpo = L.corpo()
        if L.i != len(p):
            raise ValueError("cláusula mal formada")
        out.append(Clausula(cab, corpo))
    return out
