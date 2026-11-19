# M1 — Modelagem formal (Contexto 2: a linha do tempo do museu)

Este documento escreve o contexto em lógica de primeira ordem, mostra a forma clausal e uma derivação por resolução
com os unificadores. As regras abaixo são as mesmas que o motor executa (`motor/base.py`, constante `REGRAS`).

## 1. Vocabulário

**Constantes.** Pessoas (`guarda`, `curadora`, `faxineiro`, `visitante`), salas (`hall`, `galeria`, `cafe`, `reserva`)
e números inteiros (minutos depois das 21h). Os nomes vêm do JSON de entrada; acentos e maiúsculas são normalizados
(`Café` → `cafe`).

**Predicados** (nome/aridade):

| Predicado | Significado |
|---|---|
| `pessoa/1`, `sala/1` | tipos de constantes |
| `corredor/3` (sala, sala, minutos) | corredor entre duas salas; vale nos dois sentidos |
| `local_crime/1`, `janela/2` | sala do desaparecimento e janela do sumiço [início, fim] |
| `registro/3` (pessoa, sala, instante) | registro confiável de câmera ou cartão |
| `depoimento/4` (pessoa, sala, de, ate) | afirmação: a pessoa diz ter ficado na sala nesse intervalo |
| `liga/3`, `caminho/4`, `distancia/3` | mapa e menor deslocamento |
| `pode_estar/4`, `pode_na_janela/4` | intervalo em que a pessoa poderia estar numa sala |
| `registro_impossivel/5` | registros consecutivos que não cabem no mapa |
| `refutado/4`, `liberado/1`, `suspeito/1` | conclusões |

Funções aritméticas (`+`, `-`, `max`, `min`) e comparações (`<`, `=<`, `=`, `\=`) são tratadas como predicados embutidos:
a unificação pura não compara números.

## 2. Regras em lógica de predicados

1. **Corredor nos dois sentidos.**
   ∀A ∀B ∀D ( corredor(A,B,D) → liga(A,B,D) ) e ∀A ∀B ∀D ( corredor(B,A,D) → liga(A,B,D) )

2. **Distância** = menor soma de um caminho que não repete sala:
   - `caminho(A,B,V,D)` vale se `liga(A,B,D)` e B ∉ V; ou se `liga(A,C,D1)`, C ∉ V, `caminho(C,B,[C|V],D2)` e D = D1 + D2.
   - `distancia(A,A,0)` para toda sala A; e `distancia(A,B,D)` com A ≠ B é o mínimo (`min_list`) de `findall` sobre `caminho`.
   - A restrição "sem repetir sala" é o controle de ciclos: o mapa do exemplo tem o circuito hall–galeria–reserva–café–hall.

3. **Refutação de depoimento.**
   ∀P ∀S ∀D ∀A ( depoimento(P,S,D,A) ∧ ∃S2 ∃T ( registro(P,S2,T) ∧ S2 ≠ S ∧ D ≤ T ∧ T ≤ A ) → refutado(P,S,D,A) )

4. **Onde a pessoa pode estar.** Para registros consecutivos (S1,T1) e (S2,T2) e uma sala X:
   ∀P ∀X ( pode_estar(P,X,I,F) ← consecutivo(P,S1,T1,S2,T2) ∧ distancia(S1,X,D1) ∧ distancia(X,S2,D2) ∧ I = T1 + D1 ∧ F = T2 − D2 ∧ I ≤ F )
   Antes do primeiro registro vale F = T − d(X,S) e depois do último vale I = T + d(S,X). Quem não tem registro algum pode estar em qualquer lugar.
   `pode_na_janela` intersecta [I,F] com a janela [J1,J2]: I' = max(I,J1), F' = min(F,J2), I' ≤ F'.

5. **Liberado e suspeito.**
   - liberado(P) ← depoimento(P,S,De,Ate) ∧ ¬refutado(P,S,De,Ate) ∧ De ≤ J1 ∧ J2 ≤ Ate ∧ S ≠ local_crime.
   - suspeito(P) ← pessoa(P) ∧ ¬inconsistente(P) ∧ ¬liberado(P) ∧ pode_na_janela(P, local_crime, I, F).

   A negação é **negação por falha** (mundo fechado): "não consigo provar que foi liberado". Fora da lógica clássica,
   por isso retirar um fato pode mudar a conclusão (raciocínio não monotônico).

## 3. Forma clausal

Para a regra 3, eliminando o condicional e passando a negação do ∃ para dentro:

    ∀P ∀S ∀D ∀A ∀S2 ∀T [ refutado(P,S,D,A) ∨ ¬depoimento(P,S,D,A) ∨ ¬registro(P,S2,T) ∨ S2 = S ∨ ¬(D ≤ T) ∨ ¬(T ≤ A) ]

O ∃ estava **no antecedente**, então vira ∀ no corpo, e **não é preciso skolemizar**. É uma cláusula de Horn (um único literal positivo),
escrita no motor como:

    refutado(P, S, De, Ate) :- depoimento(P, S, De, Ate), registro(P, S2, T), S2 \= S, De =< T, T =< Ate.

**Quando a skolemização é necessária.** Um ∃ no *consequente*: "toda pessoa suspeita tem algum instante em que pode estar no hall",
∀P ( suspeito(P) → ∃T estar(P,hall,T) ). Substituímos T por uma função de Skolem t(P):

    ¬suspeito(P) ∨ estar(P, hall, t(P))

## 4. Derivação por resolução (com unificadores)

Objetivo: provar `refutado(guarda, cafe, 5, 40)`. Negamos o objetivo e buscamos a cláusula vazia (□).

| # | Cláusula | Origem |
|---|---|---|
| C1 | refutado(P,S,D,A) ∨ ¬depoimento(P,S,D,A) ∨ ¬registro(P,S2,T) ∨ S2 = S ∨ ¬(D ≤ T) ∨ ¬(T ≤ A) | regra 3 |
| F1 | depoimento(guarda, cafe, 5, 40) | fato |
| F2 | registro(guarda, galeria, 20) | fato |
| A1 | ¬(galeria = cafe) · A2: 5 ≤ 20 · A3: 20 ≤ 40 | aritmética/igualdade embutidas |
| G | ¬refutado(guarda, cafe, 5, 40) | negação do objetivo |

1. Resolve **G** com **C1**, unificador θ₁ = { P/guarda, S/cafe, D/5, A/40 }:
   R1 = ¬depoimento(guarda,cafe,5,40) ∨ ¬registro(guarda,S2,T) ∨ S2 = cafe ∨ ¬(5 ≤ T) ∨ ¬(T ≤ 40)
2. Resolve **R1** com **F1**, θ₂ = { } (já são iguais):
   R2 = ¬registro(guarda,S2,T) ∨ S2 = cafe ∨ ¬(5 ≤ T) ∨ ¬(T ≤ 40)
3. Resolve **R2** com **F2**, θ₃ = { S2/galeria, T/20 }:
   R3 = galeria = cafe ∨ ¬(5 ≤ 20) ∨ ¬(20 ≤ 40)
4. Resolve **R3** com **A1**: R4 = ¬(5 ≤ 20) ∨ ¬(20 ≤ 40)
5. Resolve **R4** com **A2**: R5 = ¬(20 ≤ 40)
6. Resolve **R5** com **A3**: **□**.

Cláusula vazia: o objetivo é consequência das premissas. O motor SLD devolve exatamente esta prova
(`python main.py --entrada casos/oficial.json --pergunta prova --objetivo "refutado(guarda, S, De, Ate)"`),
com o unificador S2/galeria, T/20 no nó da regra.

## 5. O que fica fora da lógica clássica

- `findall/3`, `min_list/2` e `\+` são extralógicos: o primeiro e o segundo para agregar, o terceiro por negação por falha.
- Por isso a equivalência com um Prolog de verdade só pode ser conferida nas respostas (teste `tests/test_prolog.py`,
  que roda quando o SWI-Prolog está instalado).

## Avistamentos (evidência sobre o objeto)
Campo opcional `"avistamentos": [[objeto, sala, minuto, fonte]]` no JSON. Vira o fato `avistamento/4`.
Regra `saiu_sozinha(O, S, T)`: o objeto foi visto no local do crime, dentro da janela, e nenhuma pessoa tem registro nessa sala no mesmo minuto (negação por falha em `acompanhada/2`).
No caso oficial: `["estrela", "hall", 24, "câmera"]`. A regra **não altera quem é suspeito**; só explica como o objeto saiu. Se um registro de pessoa for acrescentado no mesmo minuto e sala, a conclusão cai.
