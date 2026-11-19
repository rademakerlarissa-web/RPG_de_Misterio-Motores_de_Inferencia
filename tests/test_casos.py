"""Casos próprios (casos/*.json): resultado esperado escrito à mão + conferência com o oráculo e com o SAT."""
import pytest
from conftest import carregar
from motor.consultas import Caso
from motor import sat as SAT, referencia
from motor.base import validar, CasoInvalido

# esperado, raciocinado à mão para cada mapa
ESPERADO = {
    "oficial": {"suspeitos": ["guarda"], "inconsistentes": []},
    "sem-registro-guarda": {"suspeitos": [], "inconsistentes": []},
    "inconsistente": {"suspeitos": [], "inconsistentes": ["curadora"]},
    "mais-de-um-suspeito": {"suspeitos": ["guarda", "visitante"], "inconsistentes": []},
    "sem-depoimentos": {"suspeitos": ["guarda", "curadora", "faxineiro"], "inconsistentes": []},
    "mapa-linear": {"suspeitos": ["curadora"], "inconsistentes": []},
    "um-registro-por-pessoa": {"suspeitos": ["guarda", "curadora", "visitante"], "inconsistentes": []},
    "depoimento-no-local-do-crime": {"suspeitos": ["guarda"], "inconsistentes": []},
    "mapa-com-ciclo": {"suspeitos": ["p2"], "inconsistentes": []},
    "nomes-acentuados": {"suspeitos": ["Seu Barros"], "inconsistentes": []},
    "janela-de-um-minuto": {"suspeitos": ["guarda"], "inconsistentes": []},
    "depoimento-impossivel-pelo-mapa": {"suspeitos": ["guarda"], "inconsistentes": []},
}


@pytest.mark.parametrize("nome", sorted(ESPERADO))
def test_suspeitos_esperados(nome):
    c = Caso(carregar(nome))
    assert sorted(c.suspeitos()) == sorted(ESPERADO[nome]["suspeitos"])
    assert sorted({x[0] for x in c.impossiveis()}) == ESPERADO[nome]["inconsistentes"]


@pytest.mark.parametrize("nome", sorted(ESPERADO))
def test_oraculo_concorda_com_o_motor_sld(nome):
    d = carregar(nome)
    c = Caso(d)
    ref = referencia.analisar(d)
    assert sorted(c.suspeitos()) == sorted(ref["suspeitos"])
    for p, info in ref["pessoas"].items():
        assert c.janelas(p, d["local_do_crime"]) == info["janela"][d["local_do_crime"]]
        assert (p in c.liberados()) == info["liberado"]


@pytest.mark.parametrize("nome", sorted(ESPERADO))
def test_sat_concorda_com_o_sld(nome):
    d = carregar(nome)
    c = Caso(d)
    j1, j2 = d["janela"]
    for p, info in referencia.analisar(d)["pessoas"].items():
        r = SAT.consistencia(d, p)
        assert r["sat"] == (not info["impossiveis"])
        if r["sat"]:
            m = set(SAT.minutos_possiveis(d, p, d["local_do_crime"], j1, j2))
            sld = {t for a, b in c.janelas(p, d["local_do_crime"]) for t in range(a, b + 1)}
            assert m == sld, p


def test_caso_sem_depoimento_nao_libera_ninguem():
    assert Caso(carregar("sem-depoimentos")).liberados() == []


def test_mensagem_de_mais_de_um_suspeito():
    a = Caso(carregar("mais-de-um-suspeito")).analise()
    assert a["conclusao"]["tipo"] == "varios"


def test_mensagem_de_nenhum_suspeito():
    assert Caso(carregar("sem-registro-guarda")).analise()["conclusao"]["tipo"] == "nenhum"


def test_registros_incoerentes_sao_sinalizados_e_nao_acusam():
    a = Caso(carregar("inconsistente")).analise()
    assert [p["situacao"] for p in a["pessoas"] if p["pessoa"] == "curadora"] == ["inconsistente"]
    assert "contraditórios" in a["conclusao"]["texto"]


def test_nomes_com_acento_e_maiuscula_funcionam_nas_perguntas():
    c = Caso(carregar("nomes-acentuados"))
    assert c.distancia("Saguão", "Reserva Técnica") == 6
    assert c.janelas("Seu Barros", "Saguão") == [(14, 18), (22, 30)]


def test_bonus_depoimentos_decisivos_do_caso_oficial():
    r = Caso(carregar("oficial")).depoimentos_decisivos()
    assert r["suspeitos_atuais"] == ["guarda"] and r["tamanho"] == 1
    quem = sorted(x["depoimentos"][0][0] for x in r["conjuntos"])
    assert quem == ["faxineiro", "visitante"]          # o do guarda já está refutado: tirá-lo não muda nada
    for x in r["conjuntos"]:
        assert x["suspeitos"] == sorted(["guarda", x["depoimentos"][0][0]])


def test_bonus_sem_registro_do_guarda_o_depoimento_dele_decide():
    r = Caso(carregar("sem-registro-guarda")).depoimentos_decisivos()
    assert r["suspeitos_atuais"] == [] and r["tamanho"] == 1
    assert any(x["depoimentos"][0][0] == "guarda" and x["suspeitos"] == ["guarda"] for x in r["conjuntos"])


def test_camera_do_hall_mostra_que_a_estrela_saiu_sozinha():
    c = Caso(carregar("oficial"))
    assert c.saiu_sozinha() == [("estrela", "hall", 24)]
    assert c.suspeitos() == ["guarda"]            # a evidência não muda quem é suspeito
    assert c.analise()["saiu_sozinha"] == [("estrela", "hall", 24)]


def test_avistamento_com_pessoa_registrada_no_mesmo_minuto_nao_e_sozinha():
    d = carregar("oficial")
    d["registros"].append(["visitante", "hall", 24])
    assert Caso(d).saiu_sozinha() == []


def test_avistamento_fora_da_janela_ou_em_outra_sala_nao_conta():
    d = carregar("oficial")
    d["avistamentos"] = [["estrela", "hall", 40], ["estrela", "cafe", 24]]
    assert Caso(d).saiu_sozinha() == []


def test_avistamento_e_opcional_e_validado():
    from motor.base import validar, CasoInvalido
    d = carregar("sem-registro-guarda")
    d.pop("avistamentos", None)
    assert Caso(d).saiu_sozinha() == []
    d["avistamentos"] = [["estrela", "sala-que-nao-existe", 24]]
    with pytest.raises(CasoInvalido):
        validar(d)


def test_fonte_do_registro_e_opcional_e_vira_fato():
    from motor.base import fatos_texto
    d = carregar("oficial")
    assert "fonte(guarda, galeria, 20, camera)." in fatos_texto(d)


@pytest.mark.parametrize("quebra,trecho", [
    (lambda d: d.pop("janela"), "janela"),
    (lambda d: d.update(janela=[30, 14]), "início é depois do fim"),
    (lambda d: d.update(local_do_crime="porão"), "não aparece no mapa"),
    (lambda d: d["registros"].append(["x", "hall", "dez"]), "inteiro"),
    (lambda d: d["registros"].append(["x", "porão", 3]), "não está no mapa"),
    (lambda d: d["corredores"].append(["hall", "cafe", 0]), "positivo"),
])
def test_validacao_de_entrada(quebra, trecho):
    d = carregar("oficial"); quebra(d)
    with pytest.raises(CasoInvalido) as e:
        validar(d)
    assert trecho in str(e.value)
