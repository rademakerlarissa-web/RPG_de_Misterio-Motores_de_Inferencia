"""M2 — Base de conhecimento: fatos gerados a partir do JSON + regras gerais (texto Prolog).

As regras ficam num texto único (`REGRAS`), lido pelo mesmo parser do motor; o arquivo `prolog/regras.pl`
é gerado a partir dele (tools/gerar_prolog.py) para a conferência com SWI-Prolog, quando disponível.
"""
import re
import unicodedata
from .termos import ler_programa

REGRAS = r"""
% ---- mapa: corredores valem nos dois sentidos
liga(A, B, D) :- corredor(A, B, D).
liga(A, B, D) :- corredor(B, A, D).

% ---- menor distância (em minutos) = menor soma de caminhos sem repetir sala
caminho(A, B, V, D) :- liga(A, B, D), \+ member(B, V).
caminho(A, B, V, D) :- liga(A, C, D1), \+ member(C, V), caminho(C, B, [C|V], D2), D is D1 + D2.
distancia(A, A, 0) :- sala(A).
distancia(A, B, D) :- A \= B, findall(X, caminho(A, B, [A], X), L), min_list(L, D).

member(X, [X|_]).
member(X, [_|T]) :- member(X, T).

% ---- registros consecutivos de uma pessoa
entre(P, T1, T2) :- registro(P, _, T), T1 < T, T < T2.
consecutivo(P, S1, T1, S2, T2) :- registro(P, S1, T1), registro(P, S2, T2), T1 < T2, \+ entre(P, T1, T2).
antes(P, T) :- registro(P, _, T0), T0 < T.
depois(P, T) :- registro(P, _, T0), T0 > T.
primeiro(P, S, T) :- registro(P, S, T), \+ antes(P, T).
ultimo(P, S, T) :- registro(P, S, T), \+ depois(P, T).

% ---- registros que se contradizem (impossível percorrer o trajeto no tempo disponível)
registro_impossivel(P, S1, T1, S2, T2) :- consecutivo(P, S1, T1, S2, T2), distancia(S1, S2, D), Dt is T2 - T1, Dt < D.
registro_impossivel(P, S1, T1, S2, T2) :- consecutivo(P, S1, T1, S2, T2), \+ distancia(S1, S2, _).
registro_impossivel(P, S1, T, S2, T) :- registro(P, S1, T), registro(P, S2, T), S1 \= S2.

% ---- onde a pessoa PODE ter estado: [I, F] = minutos possíveis na sala X
pode_estar(P, X, I, F) :- consecutivo(P, S1, T1, S2, T2), sala(X), distancia(S1, X, D1), distancia(X, S2, D2),
                          I is T1 + D1, F is T2 - D2, I =< F.
pode_estar(P, X, I, F) :- primeiro(P, S, T), sala(X), distancia(X, S, D), I is 0 - 1000, F is T - D, I =< F.
pode_estar(P, X, I, F) :- ultimo(P, S, T), sala(X), distancia(S, X, D), I is T + D, F is 1000, I =< F.
pode_estar(P, X, I, F) :- pessoa(P), \+ registro(P, _, _), sala(X), I is 0 - 1000, F is 1000.

% ---- restrito à janela do sumiço
pode_na_janela(P, X, I, F) :- pode_estar(P, X, I0, F0), janela(J1, J2), I is max(I0, J1), F is min(F0, J2), I =< F.

% ---- depoimentos
refutado(P, S, De, Ate) :- depoimento(P, S, De, Ate), registro(P, S2, T), S2 \= S, De =< T, T =< Ate.
liberado(P) :- depoimento(P, S, De, Ate), \+ refutado(P, S, De, Ate), janela(J1, J2), De =< J1, J2 =< Ate, local_crime(L), S \= L.

% ---- suspeito: registros coerentes, não liberado e pode ter estado no local do crime durante a janela
inconsistente(P) :- registro_impossivel(P, _, _, _, _).
suspeito(P) :- pessoa(P), \+ inconsistente(P), \+ liberado(P), local_crime(L), pode_na_janela(P, L, _, _).

% ---- avistamento do próprio objeto sumido (ex.: câmera que vê a Estrela)
% saiu_sozinha: o objeto foi visto no local do crime, dentro da janela, e nenhuma pessoa tem registro ali no mesmo minuto.
% Não muda quem é suspeito; é uma evidência a mais sobre COMO o objeto saiu.
acompanhada(O, T) :- avistamento(O, S, T, _), registro(_, S, T).
saiu_sozinha(O, S, T) :- avistamento(O, S, T, _), local_crime(S), janela(J1, J2), J1 =< T, T =< J2, \+ acompanhada(O, T).
"""


def atomo_seguro(nome):
    """'Seu Barros' -> 'seu_barros'; sem acento, minúsculo, só [a-z0-9_]."""
    s = unicodedata.normalize("NFKD", str(nome)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_") or "x"
    return s if s[0].isalpha() else "n_" + s


class CasoInvalido(ValueError):
    pass


def validar(caso):
    """Valida a estrutura do JSON; levanta CasoInvalido com mensagem em português."""
    if not isinstance(caso, dict):
        raise CasoInvalido("o arquivo precisa ser um objeto JSON")
    for ch in ("corredores", "local_do_crime", "janela", "registros", "depoimentos"):
        if ch not in caso:
            raise CasoInvalido(f"falta o campo '{ch}'")

    def inteiro(v, onde):
        if isinstance(v, bool) or not isinstance(v, int):
            raise CasoInvalido(f"{onde}: esperava um número inteiro de minutos, veio {v!r}")
        return v

    salas = set()
    for i, c in enumerate(caso["corredores"]):
        if not (isinstance(c, list) and len(c) == 3):
            raise CasoInvalido(f"corredor {i + 1}: use [sala, sala, minutos]")
        if inteiro(c[2], f"corredor {i + 1}") <= 0:
            raise CasoInvalido(f"corredor {i + 1}: o tempo precisa ser positivo")
        salas |= {str(c[0]), str(c[1])}
    if not caso["corredores"]:
        raise CasoInvalido("o mapa não tem corredores")
    if str(caso["local_do_crime"]) not in salas:
        raise CasoInvalido(f"local_do_crime '{caso['local_do_crime']}' não aparece no mapa")
    j = caso["janela"]
    if not (isinstance(j, list) and len(j) == 2):
        raise CasoInvalido("janela: use [início, fim]")
    if inteiro(j[0], "janela") > inteiro(j[1], "janela"):
        raise CasoInvalido("janela: o início é depois do fim")
    for i, r in enumerate(caso["registros"]):
        if not (isinstance(r, list) and len(r) in (3, 4)):
            raise CasoInvalido(f"registro {i + 1}: use [pessoa, sala, minuto, fonte] (a fonte é opcional)")
        if len(r) == 4 and not isinstance(r[3], str):
            raise CasoInvalido(f"registro {i + 1}: a fonte precisa ser um texto (ex.: \"câmera\")")
        inteiro(r[2], f"registro {i + 1}")
        if str(r[1]) not in salas:
            raise CasoInvalido(f"registro {i + 1}: sala '{r[1]}' não está no mapa")
    for i, a in enumerate(caso.get("avistamentos", [])):
        if not (isinstance(a, list) and len(a) in (3, 4)):
            raise CasoInvalido(f"avistamento {i + 1}: use [objeto, sala, minuto, fonte] (a fonte é opcional)")
        inteiro(a[2], f"avistamento {i + 1}")
        if str(a[1]) not in salas:
            raise CasoInvalido(f"avistamento {i + 1}: sala '{a[1]}' não está no mapa")
    for i, d in enumerate(caso["depoimentos"]):
        if not (isinstance(d, list) and len(d) == 4):
            raise CasoInvalido(f"depoimento {i + 1}: use [pessoa, sala, de, até]")
        inteiro(d[2], f"depoimento {i + 1}"); inteiro(d[3], f"depoimento {i + 1}")
        if d[2] > d[3]:
            raise CasoInvalido(f"depoimento {i + 1}: o início é depois do fim")
        if str(d[1]) not in salas:
            raise CasoInvalido(f"depoimento {i + 1}: sala '{d[1]}' não está no mapa")
    return caso


def pessoas_do(caso):
    ordem = []
    for r in caso["registros"]:
        if r[0] not in ordem:
            ordem.append(r[0])
    for d in caso["depoimentos"]:
        if d[0] not in ordem:
            ordem.append(d[0])
    return ordem


def salas_do(caso):
    ordem = []
    for c in caso["corredores"]:
        for s in c[:2]:
            if s not in ordem:
                ordem.append(s)
    return ordem


def fatos_texto(caso):
    """Fatos Prolog (um por linha) do caso."""
    a = atomo_seguro
    L = []
    for p in pessoas_do(caso):
        L.append(f"pessoa({a(p)}).")
    for s in salas_do(caso):
        L.append(f"sala({a(s)}).")
    for x, y, d in caso["corredores"]:
        L.append(f"corredor({a(x)}, {a(y)}, {d}).")
    L.append(f"local_crime({a(caso['local_do_crime'])}).")
    L.append(f"janela({caso['janela'][0]}, {caso['janela'][1]}).")
    for r in caso["registros"]:
        p, s, t = r[:3]
        L.append(f"registro({a(p)}, {a(s)}, {t}).")
        if len(r) == 4:
            L.append(f"fonte({a(p)}, {a(s)}, {t}, {a(r[3])}).")
    for av in caso.get("avistamentos", []):
        L.append(f"avistamento({a(av[0])}, {a(av[1])}, {av[2]}, {a(av[3]) if len(av) == 4 else 'desconhecida'}).")
    for p, s, de, ate in caso["depoimentos"]:
        L.append(f"depoimento({a(p)}, {a(s)}, {de}, {ate}).")
    return "\n".join(L) + "\n"


def programa_texto(caso):
    return "% Fatos do caso\n" + fatos_texto(caso) + "\n% Regras gerais\n" + REGRAS


def clausulas(caso):
    return ler_programa(programa_texto(caso))


def nomes_de_exibicao(caso):
    """átomo seguro -> nome original (para mostrar ao usuário)."""
    m = {}
    for x in pessoas_do(caso) + salas_do(caso):
        m[atomo_seguro(x)] = x
    return m
