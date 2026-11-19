window.GE_CLI = {
 "quando": "18/11/2026 12:37",
 "python": "3.13.18",
 "saidas": [
  {
   "comando": "python main.py --entrada casos/oficial.json --pergunta quem-levou",
   "saida": "Resultado (motor SLD):\n  guarda     suspeito   o depoimento (cafe, 5–40) foi refutado por um registro; não foi liberado por depoimento e pode ter estado em hall nos minutos 14–18, 22–30 da janela\n  curadora   descartado o mapa e os registros não deixam tempo para chegar a hall durante a janela\n  faxineiro  liberado   depoimento cobre a janela, em outra sala, e nenhum registro o contradiz\n  visitante  liberado   depoimento cobre a janela, em outra sala, e nenhum registro o contradiz\n\nConclusão: guarda é o único suspeito que sobra.\nConferência pelo caminho SAT: guarda  (concorda)",
   "codigo": 0
  },
  {
   "comando": "python main.py --entrada casos/oficial.json --pergunta prova --objetivo \"refutado(guarda, S, De, Ate)\"",
   "saida": "refutado(guarda, cafe, 5, 40)   [regra]  por  refutado(P, S, De, Ate) :- depoimento(P, S, De, Ate), registro(P, S2, T), S2 \\= S, De =< T, T =< Ate.   θ = {P/guarda, S/cafe, De/5, Ate/40, S2/galeria, T/20}\n  depoimento(guarda, cafe, 5, 40)   [fato]\n  registro(guarda, galeria, 20)   [fato]\n  galeria \\= cafe   [embutido]\n  5 =< 20   [embutido]\n  20 =< 40   [embutido]\n[7 inferências]",
   "codigo": 0
  },
  {
   "comando": "python main.py --entrada casos/oficial.json --pergunta consulta --objetivo \"distancia(hall, reserva, D)\"",
   "saida": "D = 6\n[121 inferências]",
   "codigo": 0
  },
  {
   "comando": "python main.py --entrada casos/oficial.json --pergunta sat",
   "saida": "guarda: consistente (205 variáveis, 1994 cláusulas, 22 decisões) · pode estar em hall (na janela): 14–18, 22–30\ncuradora: consistente (205 variáveis, 1994 cláusulas, 32 decisões) · pode estar em hall (na janela): nenhum\nfaxineiro: consistente (205 variáveis, 1993 cláusulas, 39 decisões) · pode estar em hall (na janela): 16–29\nvisitante: consistente (205 variáveis, 1994 cláusulas, 19 decisões) · pode estar em hall (na janela): 14–22, 28–30",
   "codigo": 0
  },
  {
   "comando": "python main.py --entrada casos/oficial.json --pergunta sat-consequencia --pessoa guarda --sala galeria --minuto 20",
   "saida": "guarda em galeria no minuto 20: necessario (somar ¬x à CNF a torna insatisfatível (refutação))",
   "codigo": 0
  },
  {
   "comando": "python main.py --entrada casos/sem-registro-guarda.json --pergunta quem-levou",
   "saida": "Resultado (motor SLD):\n  guarda     liberado   depoimento cobre a janela, em outra sala, e nenhum registro o contradiz\n  curadora   descartado o mapa e os registros não deixam tempo para chegar a hall durante a janela\n  faxineiro  liberado   depoimento cobre a janela, em outra sala, e nenhum registro o contradiz\n  visitante  liberado   depoimento cobre a janela, em outra sala, e nenhum registro o contradiz\n\nConclusão: Nenhum suspeito sobrou: não há como apontar quem esteve em hall durante a janela com os dados deste caso.\nConferência pelo caminho SAT: nenhum suspeito  (concorda)",
   "codigo": 0
  },
  {
   "comando": "python main.py --entrada casos/inconsistente.json --pergunta quem-levou",
   "saida": "Resultado (motor SLD):\n  curadora   inconsistente os próprios registros se contradizem (galeria no minuto 10 e reserva no minuto 12): dado a conferir, não é acusação\n  guarda     liberado   depoimento cobre a janela, em outra sala, e nenhum registro o contradiz\n\nConclusão: Nenhum suspeito sobrou: não há como apontar quem esteve em hall durante a janela com os dados deste caso. Atenção: registros contraditórios de curadora.\nConferência pelo caminho SAT: nenhum suspeito  (concorda)",
   "codigo": 0
  },
  {
   "comando": "python main.py --entrada casos/mais-de-um-suspeito.json --pergunta quem-levou",
   "saida": "Resultado (motor SLD):\n  guarda     suspeito   o depoimento (cafe, 5–40) foi refutado por um registro; não foi liberado por depoimento e pode ter estado em hall nos minutos 14–18, 22–30 da janela\n  visitante  suspeito   o depoimento (reserva, 10–35) foi refutado por um registro; não foi liberado por depoimento e pode ter estado em hall nos minutos 14–30 da janela\n\nConclusão: Mais de um suspeito sobrou (guarda, visitante): os dados não bastam para apontar um só.\nConferência pelo caminho SAT: guarda, visitante  (concorda)",
   "codigo": 0
  },
  {
   "comando": "python main.py --entrada casos/oficial.json --pergunta depoimentos-decisivos",
   "saida": "Suspeito(s) atual(is): guarda.\nMenor conjunto de depoimentos que, se falsos, muda o resultado: 1 depoimento(s).\n  - se for falso: faxineiro diz 'reserva' de 10 a 35  =>  suspeito(s): faxineiro, guarda\n  - se for falso: visitante diz 'cafe' de 8 a 40  =>  suspeito(s): guarda, visitante",
   "codigo": 0
  }
 ]
};
