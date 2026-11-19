"""Paridade com um Prolog de verdade (SWI-Prolog), quando instalado. Sem `swipl`, o teste é PULADO — e o site mostra 'Não executado'."""
import json, os, shutil, subprocess
import pytest
from conftest import RAIZ, carregar
from motor.base import programa_texto, atomo_seguro
from motor.consultas import Caso

SWI = shutil.which("swipl")


@pytest.mark.skipif(SWI is None, reason="swipl não está instalado neste ambiente")
@pytest.mark.parametrize("nome", ["oficial", "sem-registro-guarda", "mais-de-um-suspeito"])
def test_prolog_confere_suspeitos(nome, tmp_path):
    d = carregar(nome)
    arq = tmp_path / "caso.pl"
    arq.write_text(programa_texto(d))
    out = subprocess.run([SWI, "-q", "-s", str(arq), "-g", "forall(suspeito(P), (write(P), nl))", "-t", "halt"],
                         capture_output=True, text=True, timeout=60).stdout.split()
    esperado = sorted({atomo_seguro(p) for p in Caso(d).suspeitos()})
    assert sorted(set(out)) == esperado
