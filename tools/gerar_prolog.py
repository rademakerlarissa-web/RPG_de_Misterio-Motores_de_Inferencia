#!/usr/bin/env python3
"""Gera, a partir de motor/base.py (fonte canônica): prolog/regras.pl, prolog/oficial.pl (regras + fatos)
e js/motor/regras.js (as MESMAS regras para o motor em JavaScript)."""
import json, os, sys
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from motor.base import REGRAS, fatos_texto, programa_texto

PROVA = """% Meta-interpretador com árvore de prova (exigido no enunciado).
% Uso:  ?- prova(suspeito(P), Arvore).
% Arvore = fato(G) | embutido(G) | nega(G) | regra(G, [SubArvores])
:- discontiguous prova/2.
prova(true, fato(true)) :- !.
prova((A, B), (TA, TB)) :- !, prova(A, TA), prova(B, TB).
prova(\\+ G, nega(G)) :- !, \\+ prova(G, _).
prova(G, embutido(G)) :- predicate_property(G, built_in), !, call(G).
prova(G, Arvore) :-
    clause(G, Corpo),
    ( Corpo == true -> Arvore = fato(G)
    ; prova(Corpo, Sub), Arvore = regra(G, Sub) ).
"""
os.makedirs(os.path.join(RAIZ, "prolog"), exist_ok=True)
open(os.path.join(RAIZ, "prolog/regras.pl"), "w", encoding="utf-8").write(
    "% Regras gerais do motor (gerado de motor/base.py — não edite aqui)\n% Para usar: carregue este arquivo depois dos fatos do caso.\n:- dynamic avistamento/4, fonte/4.   % fatos opcionais (podem não existir no caso)\n" + REGRAS)
for nome in ("oficial", "sem-registro-guarda"):
    d = json.load(open(os.path.join(RAIZ, "casos", nome + ".json"), encoding="utf-8"))
    open(os.path.join(RAIZ, f"prolog/{nome}.pl"), "w", encoding="utf-8").write(
        f"% Caso '{nome}': fatos + regras. Rode:  swipl -q -s prolog/{nome}.pl -g \"forall(suspeito(P),(write(P),nl))\" -t halt\n:- dynamic avistamento/4, fonte/4.   % fatos opcionais do caso\n" + programa_texto(d))
open(os.path.join(RAIZ, "prolog/prova.pl"), "w", encoding="utf-8").write(PROVA)
open(os.path.join(RAIZ, "js/motor/regras.js"), "w", encoding="utf-8").write(
    "/* gerado por tools/gerar_prolog.py a partir de motor/base.py — não edite */\n(function(r){(r.GE=r.GE||{}).M=r.GE.M||{};r.GE.M.REGRAS="
    + json.dumps(REGRAS, ensure_ascii=False) + ";})(typeof window!=='undefined'?window:globalThis);\n")
print("ok")
