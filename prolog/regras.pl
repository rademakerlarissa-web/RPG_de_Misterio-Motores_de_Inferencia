% Regras gerais do motor (gerado de motor/base.py — não edite aqui)
% Para usar: carregue este arquivo depois dos fatos do caso.
:- dynamic avistamento/4, fonte/4.   % fatos opcionais (podem não existir no caso)

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
