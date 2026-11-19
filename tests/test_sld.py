"""Motor SLD: laço, limites, embutidos, árvore de prova, tabela de aceitação do caso oficial."""
import pytest
from conftest import carregar
from motor.consultas import Caso
from motor.sld import Motor, ErroDeMotor
from motor.termos import ler_programa, ler_objetivos, formatar, aplicar


@pytest.fixture(scope="module")
def oficial():
    return Caso(carregar("oficial"))


# ---- tabela de aceitação (caso oficial) -------------------------------------------------------
def test_distancias_do_mapa(oficial):
    assert oficial.distancia("hall", "galeria") == 2
    assert oficial.distancia("hall", "cafe") == 3
    assert oficial.distancia("hall", "reserva") == 6      # 2+4 pela galeria, e não 3+6 pelo café
    assert oficial.distancia("cafe", "galeria") == 5
    assert oficial.distancia("reserva", "reserva") == 0


def test_distancia_e_simetrica(oficial):
    assert oficial.distancia("reserva", "hall") == oficial.distancia("hall", "reserva")


def test_guarda_pode_estar_no_hall_em_duas_janelas(oficial):
    assert oficial.janelas("guarda", "hall") == [(14, 18), (22, 30)]


def test_curadora_nao_chega_ao_hall(oficial):
    assert oficial.janelas("curadora", "hall") == []


def test_faxineiro_pode_estar_no_hall(oficial):
    assert oficial.janelas("faxineiro", "hall") == [(16, 29)]


def test_depoimento_do_guarda_e_refutado(oficial):
    assert oficial.refutados() == [("guarda", "cafe", 5, 40)]


def test_liberados(oficial):
    assert sorted(oficial.liberados()) == ["faxineiro", "visitante"]


def test_unico_suspeito(oficial):
    assert oficial.suspeitos() == ["guarda"]
    assert oficial.analise()["conclusao"]["tipo"] == "unico"


def test_nenhum_registro_impossivel(oficial):
    assert oficial.impossiveis() == []


# ---- laço, limite e embutidos ---------------------------------------------------------------
def test_laco_a_esquerda_termina_cortando_objetivo_variante():
    """Sem tabulação, cortar a variante perde soluções que dependem do laço; o que importa aqui é terminar."""
    m = Motor(ler_programa("anc(X, Y) :- anc(X, Z), pai(Z, Y). anc(X, Y) :- pai(X, Y). pai(a, b). pai(b, c)."))
    objs, _ = ler_objetivos("anc(a, Y)")
    r = [formatar(aplicar(objs[0], s)) for s, _ in m.resolver(objs)]
    assert "anc(a, b)" in r
    assert m.lacos_cortados > 0


def test_ciclo_de_mapa_termina_e_acha_o_caminho_curto():
    m = Motor(ler_programa(
        "liga(A,B,D) :- c(A,B,D). liga(A,B,D) :- c(B,A,D). member(X,[X|_]). member(X,[_|T]) :- member(X,T). "
        "cam(A,B,V,D) :- liga(A,B,D), \\+ member(B,V). "
        "cam(A,B,V,D) :- liga(A,C,D1), \\+ member(C,V), cam(C,B,[C|V],D2), D is D1 + D2. "
        "c(a,b,1). c(b,c,1). c(c,a,1)."))
    objs, vs = ler_objetivos("cam(a, c, [a], D)")
    assert sorted(formatar(aplicar(vs["D"], s)) for s, _ in m.resolver(objs)) == ["1", "2"]


def test_limite_de_profundidade_e_sinalizado():
    m = Motor(ler_programa("c(X) :- c(s(X))."), limite=30)
    assert list(m.resolver(ler_objetivos("c(a)")[0])) == []
    assert m.limite_atingido


def test_negacao_por_falha():
    m = Motor(ler_programa("a(1). a(2). b(2). c(X) :- a(X), \\+ b(X)."))
    objs, vs = ler_objetivos("c(X)")
    assert [formatar(aplicar(vs["X"], s)) for s, _ in m.resolver(objs)] == ["1"]


def test_aritmetica_e_comparacao():
    m = Motor(ler_programa("v(3). w(Y) :- v(X), Y is X * 2 + 1, Y > 6, Y =< 7."))
    objs, vs = ler_objetivos("w(Y)")
    assert [formatar(aplicar(vs["Y"], s)) for s, _ in m.resolver(objs)] == ["7"]


def test_findall_e_min_list():
    m = Motor(ler_programa("v(5). v(2). v(9). menor(M) :- findall(X, v(X), L), min_list(L, M)."))
    objs, vs = ler_objetivos("menor(M)")
    assert [formatar(aplicar(vs["M"], s)) for s, _ in m.resolver(objs)] == ["2"]


def test_variavel_sem_valor_em_aritmetica_da_erro():
    m = Motor(ler_programa("p(Y) :- Y is X + 1."))
    with pytest.raises(ErroDeMotor):
        list(m.resolver(ler_objetivos("p(Y)")[0]))


# ---- meta-interpretador / árvore de prova ------------------------------------------------
def test_arvore_de_prova_do_refutado(oficial):
    r = oficial.prova("refutado(guarda, S, De, Ate)")
    assert r["provado"] and r["valores"] == {"S": "cafe", "De": "5", "Ate": "40"}
    raiz = r["arvore"][0]
    assert raiz["tipo"] == "regra" and raiz["unificador"]["S2"] == "galeria"
    folhas = [f["objetivo"] for f in raiz["filhos"]]
    assert "depoimento(guarda, cafe, 5, 40)" in folhas and "registro(guarda, galeria, 20)" in folhas


def test_consulta_sem_prova(oficial):
    assert oficial.prova("refutado(faxineiro, S, De, Ate)")["provado"] is False
