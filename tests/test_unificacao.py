"""Unificação, composição e leitor (M3)."""
from motor.termos import Var, Comp, unificar, compor, aplicar, formatar, ler_termo, variante, NIL, lista, ler_programa


def T(txt):
    return ler_termo(txt)


def test_variavel_com_constante():
    t1, v = T("f(X, b)"); t2, _ = T("f(a, Y)")
    s = unificar(t1, t2, {})
    assert formatar(aplicar(t1, s)) == "f(a, b)"


def test_constantes_diferentes_falham():
    assert unificar(T("a")[0], T("b")[0], {}) is None


def test_functores_ou_aridades_diferentes_falham():
    assert unificar(T("f(a)")[0], T("g(a)")[0], {}) is None
    assert unificar(T("f(a)")[0], T("f(a, b)")[0], {}) is None


def test_verificacao_de_ocorrencia():
    t, _ = T("q(X, f(X))")
    assert unificar(t.args[0], t.args[1], {}) is None
    t1, _ = T("f(X, g(X))"); t2, _ = T("f(Y, Y)")
    assert unificar(t1, t2, {}) is None


def test_mesma_variavel_dos_dois_lados():
    x = Var("X")
    assert unificar(x, x, {}) == {}


def test_listas():
    t1, _ = T("[H|T]"); t2, _ = T("[1, 2, 3]")
    s = unificar(t1, t2, {})
    assert formatar(aplicar(t1, s)) == "[1,2,3]"


def test_composicao_de_substituicoes():
    x, y, z = Var("X"), Var("Y"), Var("Z")
    s1 = {x: Comp("f", (y,))}
    s2 = {y: Comp("a")}
    s = compor(s1, s2)
    assert formatar(aplicar(x, s)) == "f(a)"
    assert formatar(aplicar(y, s)) == "a"


def test_composicao_com_vazia():
    x = Var("X")
    assert compor({}, {}) == {}
    assert compor({x: Comp("a")}, {}) == {x: Comp("a")}


def test_variante_detecta_renomeacao():
    assert variante(T("p(X, Y)")[0], T("p(A, B)")[0])
    assert not variante(T("p(X, X)")[0], T("p(A, B)")[0])
    assert not variante(T("p(a)")[0], T("p(b)")[0])


def test_leitor_de_programa_com_negacao_e_aritmetica():
    cls = ler_programa("a(X) :- b(X, Z), \\+ c(Z), W is Z + 1, W =< 5. b(1, 2).")
    assert len(cls) == 2 and len(cls[0].corpo) == 4 and not cls[1].corpo
