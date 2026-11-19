% Meta-interpretador com árvore de prova (exigido no enunciado).
% Uso:  ?- prova(suspeito(P), Arvore).
% Arvore = fato(G) | embutido(G) | nega(G) | regra(G, [SubArvores])
:- discontiguous prova/2.
prova(true, fato(true)) :- !.
prova((A, B), (TA, TB)) :- !, prova(A, TA), prova(B, TB).
prova(\+ G, nega(G)) :- !, \+ prova(G, _).
prova(G, embutido(G)) :- predicate_property(G, built_in), !, call(G).
prova(G, Arvore) :-
    clause(G, Corpo),
    ( Corpo == true -> Arvore = fato(G)
    ; prova(Corpo, Sub), Arvore = regra(G, Sub) ).
