"""SAT: CNF, DPLL, consistência, consequência, contagem, DIMACS."""
import pytest
from conftest import carregar
from motor import sat as SAT


def test_dpll_formulas_simples():
    s = SAT.Solver(3, [[1, 2], [-1, 3], [-2, 3], [-3, 1]])
    ok, modelo = s.resolver_e_desfazer()
    assert ok and modelo[1] == 1 and modelo[3] == 1
    assert SAT.Solver(1, [[1], [-1]]).resolver_e_desfazer()[0] is False
    assert SAT.Solver(2, [[1, 2], [-1], [-2]]).resolver_e_desfazer()[0] is False


def test_dpll_pigeonhole_3_em_2_e_insat():
    # 3 pombos, 2 buracos: p_i_j = 2*i + j + 1
    C = [[1, 2], [3, 4], [5, 6]]
    for j in range(2):
        for a in range(3):
            for b in range(a + 1, 3):
                C.append([-(2 * a + j + 1), -(2 * b + j + 1)])
    assert SAT.Solver(6, C).resolver_e_desfazer()[0] is False


def test_oficial_e_consistente_e_guarda_pode_estar_no_hall():
    c = carregar("oficial")
    assert SAT.consistencia(c, "guarda")["sat"]
    m = SAT.minutos_possiveis(c, "guarda", "hall", 14, 30)
    assert SAT.intervalos(m) == [(14, 18), (22, 30)]
    assert SAT.minutos_possiveis(c, "curadora", "hall", 14, 30) == []


def test_inconsistencia_com_nucleo_minimo():
    r = SAT.consistencia(carregar("inconsistente"), "curadora")
    assert not r["sat"]
    assert sorted(r["nucleo"]) == ["registro: galeria no minuto 10", "registro: reserva no minuto 12"]


def test_consequencia_por_refutacao():
    c = carregar("oficial")
    # curadora: reserva em 20 e 31, e a reserva só sai por 4 ou 6 minutos -> em 25 pode estar na reserva ou na galeria
    assert SAT.consequencia(c, "curadora", "reserva", 25)["resposta"] == "possivel"
    assert SAT.consequencia(c, "curadora", "hall", 20)["resposta"] == "impossivel"
    assert SAT.consequencia(c, "guarda", "galeria", 20)["resposta"] == "necessario"
    assert SAT.consequencia(c, "guarda", "galeria", 20)["refutacao"]


def test_consequencia_com_depoimento_torna_necessario():
    c = carregar("oficial")
    assert SAT.consequencia(c, "faxineiro", "reserva", 22)["resposta"] == "possivel"
    assert SAT.consequencia(c, "faxineiro", "reserva", 22, com_depoimento=True)["resposta"] == "necessario"


def test_depoimento_refutado_pelo_sat_inclusive_por_tempo_de_viagem():
    c = carregar("oficial")
    r = SAT.depoimento_refutado_sat(c, "guarda", "cafe", 5, 40)
    assert r["refutado"] is True and "registro: galeria no minuto 20" in r["nucleo"]
    assert SAT.depoimento_refutado_sat(c, "faxineiro", "reserva", 10, 35)["refutado"] is False
    c2 = carregar("depoimento-impossivel-pelo-mapa")   # nenhum registro dentro do intervalo, mas não dá tempo
    assert SAT.depoimento_refutado_sat(c2, "guarda", "galeria", 12, 20)["refutado"] is True


def test_contagem_de_padroes_projetada():
    c = carregar("oficial")
    r = SAT.contar_padroes(c, "curadora", "hall", 14, 30)
    assert r == {"total": 1, "truncado": False}        # só o padrão "nunca no hall"
    r2 = SAT.contar_padroes(c, "guarda", "hall", 14, 18, limite=1000)
    assert r2["total"] > 1


def test_dimacs_bem_formado():
    cod = SAT.Codificacao(carregar("oficial"), "guarda")
    linhas = cod.dimacs().splitlines()
    cab = next(l for l in linhas if l.startswith("p cnf"))
    _, _, nv, nc = cab.split()
    cls = [l for l in linhas if l and not l.startswith(("c", "p"))]
    assert int(nc) == len(cls) and int(nv) == len(cod.idx)
    assert all(l.endswith(" 0") for l in cls)
