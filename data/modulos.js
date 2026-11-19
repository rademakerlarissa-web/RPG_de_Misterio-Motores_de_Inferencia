/* ==========================================================================
   Conteúdo da documentação: fluxo geral, módulos M1–M6, etapas do projeto.
   --------------------------------------------------------------------------
   Os módulos estão implementados: Python canônico em motor/, port em JavaScript em js/motor/
   (usado pelo site e conferido contra o Python por testes de paridade). As demonstrações em
   js/docs/docs.js executam o motor de verdade; a tabela de testes lê data/testes.js, gerado pelo pytest.
   Os requisitos vêm do enunciado oficial do Contexto 2.
   ========================================================================== */
window.GE = window.GE || {};

GE.ENUNCIADO_URL = "https://wilcilene.github.io/estudos/disciplinas/logica-para-computacao/2027/trabalho-final.html";

/* ---------- fluxo geral (seção "Como funciona") ---------- */
GE.FLUXO = [
  { id: "fatos", nome: "Fatos", sub: "o que se sabe", modulo: "M2",
    aprendiz: "Fatos são informações tratadas como verdadeiras: onde cada pessoa foi vista, quanto tempo leva cada corredor e o que cada pessoa disse.",
    tecnico: "Cláusulas unitárias geradas a partir do JSON de entrada: registro/3, corredor/3 e depoimento/4.",
    jogo: "Cada registro e cada depoimento que você encontra." },
  { id: "regras", nome: "Regras", sub: "como se raciocina", modulo: "M1 e M2",
    aprendiz: "Regras dizem como combinar fatos para chegar a conclusões. Elas são escritas uma vez e valem para qualquer caso.",
    tecnico: "Cláusulas de Horn com variáveis quantificadas universalmente, comparações aritméticas como predicados embutidos e negação por falha onde for preciso.",
    jogo: "A regra que diz que um registro em outra sala contradiz um depoimento." },
  { id: "inferencia", nome: "Inferência", sub: "o motor trabalha", modulo: "M3",
    aprendiz: "O motor procura quais fatos e regras se encaixam para responder à pergunta.",
    tecnico: "Resolução SLD com unificação e verificação de ocorrência, em encadeamento para trás a partir do objetivo.",
    jogo: "Quando você pede uma dedução no quadro." },
  { id: "prova", nome: "Prova", sub: "por que a resposta vale", modulo: "M2, M3 e M5",
    aprendiz: "A prova registra cada passo. Assim a resposta pode ser conferida, em vez de aceita por confiança.",
    tecnico: "Árvore de prova devolvida pelo meta-interpretador, com a regra e a substituição de cada nó.",
    jogo: "O botão \"Ver raciocínio completo\"." },
  { id: "conclusao", nome: "Conclusão", sub: "o que se pode afirmar", modulo: "M4",
    aprendiz: "A conclusão é aquilo que decorre das premissas, e só isso. Ser suspeito não é o mesmo que ser culpado.",
    tecnico: "Consequência lógica por refutação, negação por falha sob mundo fechado e checagem de consistência e contagem de modelos via SAT.",
    jogo: "A cena final no hall." }
];

/* ---------- M1: vocabulário (do enunciado, Contexto 2) ---------- */
GE.PREDICADOS = [
  { nome: "corredor", aridade: 3, args: "sala1, sala2, minutos", tipo: "fato", exemplo: "corredor(hall, galeria, 2)", sig: "Corredor entre duas salas e o tempo de deslocamento. Vale nos dois sentidos (regra liga/3)." },
  { nome: "distancia", aridade: 3, args: "sala1, sala2, d", tipo: "regra", exemplo: "distancia(hall, reserva, D)", sig: "Menor caminho entre duas salas pelos corredores. Definido por recursão, sem repetir sala, e minimizado com findall/3 e min_list/2." },
  { nome: "registro", aridade: 3, args: "pessoa, sala, instante", tipo: "fato", exemplo: "registro(guarda, galeria, 20)", sig: "Registro confiável, de câmera ou de cartão de acesso." },
  { nome: "depoimento", aridade: 4, args: "pessoa, sala, de, ate", tipo: "fato", exemplo: "depoimento(guarda, cafe, 5, 40)", sig: "Intervalo em que a pessoa diz ter permanecido na sala." },
  { nome: "pode_estar", aridade: 4, args: "pessoa, sala, t1, t2", tipo: "regra", exemplo: "pode_estar(guarda, hall, T1, T2)", sig: "A pessoa poderia estar na sala entre t1 e t2, dados dois registros consecutivos (e, nas pontas, só o primeiro ou o último)." },
  { nome: "pode_na_janela", aridade: 4, args: "pessoa, sala, t1, t2", tipo: "regra", exemplo: "pode_na_janela(guarda, hall, I, F)", sig: "O mesmo intervalo, cortado pela janela do sumiço." },
  { nome: "refutado", aridade: 4, args: "pessoa, sala, de, ate", tipo: "regra", exemplo: "refutado(guarda, cafe, 5, 40)", sig: "Depoimento contradito por um registro da mesma pessoa em outra sala dentro do intervalo." },
  { nome: "liberado", aridade: 1, args: "pessoa", tipo: "regra", exemplo: "liberado(faxineiro)", sig: "Tem um depoimento não refutado que cobre a janela inteira em outra sala que não a do crime." },
  { nome: "registro_impossivel", aridade: 5, args: "pessoa, sala1, t1, sala2, t2", tipo: "regra", exemplo: "registro_impossivel(curadora, galeria, 10, reserva, 12)", sig: "Dois registros consecutivos que não cabem no mapa (falta tempo para o deslocamento). Sinaliza entrada inconsistente." },
  { nome: "suspeito", aridade: 1, args: "pessoa", tipo: "regra", exemplo: "suspeito(guarda)", sig: "Registros coerentes, não liberado por depoimento e com tempo de estar no local do crime durante a janela." }
];
GE.FORMULA_REFUTADO = [
  { s: "∀P ∀S ∀D ∀A", d: "Para qualquer pessoa P, sala S e intervalo D–A. A regra é escrita uma vez e vale para qualquer entrada." },
  { s: "(", d: "" },
  { s: "depoimento(P,S,D,A)", d: "A pessoa P declarou ter ficado na sala S de D até A." },
  { s: "∧", d: "E. As duas partes precisam ser verdadeiras ao mesmo tempo." },
  { s: "∃S2 ∃T", d: "Existe alguma sala S2 e algum instante T. Como está antes do →, equivale a mais duas variáveis no corpo da regra, e não exige skolemização." },
  { s: "(", d: "" },
  { s: "registro(P,S2,T)", d: "Há um registro confiável de P na sala S2 no instante T." },
  { s: "∧", d: "E." },
  { s: "S2 ≠ S", d: "A sala do registro é diferente da sala declarada." },
  { s: "∧", d: "E." },
  { s: "D ≤ T ∧ T ≤ A", d: "O instante do registro está dentro do intervalo declarado. É uma comparação aritmética, tratada como predicado embutido." },
  { s: ")", d: "" },
  { s: "→", d: "Implica. Se a parte da esquerda vale, a da direita vale." },
  { s: "refutado(P,S,D,A)", d: "Então o depoimento de P é refutado." },
  { s: ")", d: "" }
];
GE.CLAUSULA_REFUTADO = "refutado(P,S,D,A) ∨ ¬depoimento(P,S,D,A) ∨ ¬registro(P,S2,T) ∨ S2 = S ∨ ¬(D ≤ T) ∨ ¬(T ≤ A)";

/* ---------- M4: pipeline SAT ---------- */
GE.PIPELINE_SAT = [
  { nome: "Regras + entrada", d: "As regras gerais e os fatos do caso são o ponto de partida." },
  { nome: "Grounding", d: "As regras são instanciadas para o domínio finito do caso: uma variável x(pessoa, sala, minuto) para cada pessoa, sala (mais a sala fictícia 'transito') e minuto do horizonte." },
  { nome: "FNC", d: "As restrições já saem como cláusulas: pelo menos uma sala por minuto, no máximo uma, tempo de deslocamento e um registro por cláusula unitária. Não foi preciso Tseitin, porque não há fórmulas aninhadas para achatar." },
  { nome: "DIMACS", d: "Formato de texto padrão: uma cláusula por linha, com literais numerados e terminada em 0. O motor exporta o do caso com comentários dizendo o que cada variável significa." },
  { nome: "DPLL", d: "Escolhe uma variável, propaga as cláusulas unitárias e volta atrás quando encontra um conflito." },
  { nome: "Resultado", d: "Satisfatível (com um modelo) ou insatisfatível (com um núcleo mínimo que explica o conflito). Com ele se responde: a entrada é consistente? Esta conclusão é consequência? Quantos padrões de presença existem?" }
];

/* ---------- M5: fluxo Jogador → ... → Explicação ---------- */
GE.FLUXO_M5 = [
  { nome: "Jogador", d: "Faz uma ação: examina um registro, confronta Barros, pede uma prova." },
  { nome: "Interface", d: "Traduz a ação em uma consulta no formato do motor e escolhe o nível de explicação (Aprendiz ou Técnico)." },
  { nome: "Adaptador", d: "js/engine/adaptador.js é o único ponto de contato entre a página e o motor. Como o site é estático, o motor roda no próprio navegador, em JavaScript." },
  { nome: "Motor", d: "O motor SLD responde às consultas e o DPLL entra nas perguntas de consistência e consequência. A versão em Python é a canônica; a de JavaScript é conferida contra ela por testes." },
  { nome: "Prova", d: "A resposta volta com a árvore de prova, as regras usadas e as substituições." },
  { nome: "Explicação", d: "O painel Lógica em Ação transforma a prova em texto legível e permite abrir o raciocínio completo." }
];

/* ---------- M6: casos de aceitação do enunciado (resultados esperados) ----------
   `teste` é o nome da função em tests/ que verifica a linha; o resultado vem de data/testes.js (pytest). */
GE.TESTES = [
  { grupo: "Aceitação", nome: "Distâncias", teste: "test_distancias_do_mapa", esperado: "hall–reserva = 6 (pela galeria); galeria–café = 5; café–reserva = 6." },
  { grupo: "Aceitação", nome: "Quem poderia estar no hall entre 21h14 e 21h30?", teste: "test_guarda_pode_estar_no_hall_em_duas_janelas", esperado: "guarda, faxineiro e visitante, cada um com seus intervalos. A curadora não." },
  { grupo: "Aceitação", nome: "Depoimentos refutados", teste: "test_depoimento_do_guarda_e_refutado", esperado: "Só o do guarda (registro dele na galeria às 21h20)." },
  { grupo: "Aceitação", nome: "Suspeitos finais", teste: "test_unico_suspeito", esperado: "guarda." },
  { grupo: "Aceitação", nome: "Mesma entrada sem o registro do guarda às 21h20", teste: "test_suspeitos_esperados[sem-registro-guarda]", esperado: "Nenhum depoimento refutado e nenhum suspeito; o sistema diz isso em vez de inventar um culpado." },
  { grupo: "Próprios", nome: "Casos criados pela dupla (12 arquivos em casos/)", teste: "test_suspeitos_esperados", esperado: "Inclui uma entrada inconsistente e uma entrada em que a resposta não é única." },
  { grupo: "Próprios", nome: "Casos aleatórios contra um oráculo independente", teste: "test_sld_igual_ao_oraculo", esperado: "O motor SLD e uma implementação de referência (Floyd–Warshall) concordam em 60 casos sorteados." },
  { grupo: "Motor", nome: "Equivalência entre Prolog e Python", teste: "test_prolog_confere_suspeitos", esperado: "Mesmas respostas para as mesmas consultas. Exige o SWI-Prolog instalado." },
  { grupo: "Motor", nome: "Equivalência entre Python e JavaScript", teste: "test_js_igual_ao_python", esperado: "O motor do site dá exatamente as mesmas respostas que o Python." },
  { grupo: "Motor", nome: "SLD: unificação, occurs-check e laços", teste: "test_verificacao_de_ocorrencia", esperado: "Casos que exercitam cada mecanismo." },
  { grupo: "Motor", nome: "SAT: consistência, refutação e contagem", teste: "test_consequencia_por_refutacao", esperado: "Consistência com núcleo mínimo, consequência por refutação e contagem de padrões." },
  { grupo: "Motor", nome: "SAT × SLD (conferência cruzada)", teste: "test_sat_igual_ao_sld", esperado: "Os minutos possíveis no local do crime coincidem nos dois caminhos." }
];

/* ---------- módulos M1–M6 ---------- */
GE.MODULOS = [
  {
    id: "M1", titulo: "Modelagem formal", resumo: "Vocabulário, regras em lógica de predicados e forma clausal.",
    arquivos: "docs/modelagem.md, motor/base.py (REGRAS)",
    topicos: ["Constantes", "Predicados", "Aridades", "Quantificadores", "Fórmulas", "Forma clausal", "Skolemização", "Resolução", "Unificadores"],
    objetivo: "Escrever o contexto do museu em lógica de primeira ordem, sem ambiguidade, de modo que as mesmas regras sirvam para qualquer entrada.",
    fundamentacao: [
      "Constantes nomeiam indivíduos (guarda, hall). Predicados expressam propriedades e relações e têm aridade fixa.",
      "Quantificadores (∀ e ∃) permitem escrever a regra uma vez e aplicá-la a qualquer pessoa, sala ou instante.",
      "Para a resolução, cada fórmula vira um conjunto de cláusulas. Um ∃ no antecedente de uma implicação equivale a um ∀ no corpo, e não precisa de skolemização."
    ],
    implementacao: "O vocabulário, as fórmulas, a forma clausal e uma derivação por resolução com os unificadores de cada passo estão em docs/modelagem.md. As mesmas regras, já como cláusulas de Horn, são o texto que o motor lê (motor/base.py).",
    exemplo: "A frase \"o registro na galeria às 21h20 contradiz o depoimento do café\" é a regra refutado/4.",
    demo: "predicados",
    resultado: "Entregue em docs/modelagem.md: vocabulário, regras com quantificadores, forma clausal e a derivação por resolução de refutado(guarda, cafe, 5, 40)."
  },
  {
    id: "M2", titulo: "Base de conhecimento", resumo: "Fatos gerados do JSON, regras gerais, consultas e meta-interpretador.",
    arquivos: "motor/base.py, prolog/regras.pl, prolog/oficial.pl",
    topicos: ["Fatos", "Regras", "Consultas", "Prolog", "Recursão", "Árvore de prova", "Ciclos"],
    objetivo: "Separar as regras, que valem para qualquer caso, dos fatos, que vêm do arquivo de entrada, e responder às perguntas do contexto com justificativa.",
    fundamentacao: [
      "Fatos são cláusulas sem corpo, regras têm cabeça e corpo, e consultas são objetivos a provar.",
      "A recursão define a distância entre salas. Ela precisa de controle de ciclos, porque o mapa tem um circuito: hall, galeria, reserva, café e de volta ao hall. Aqui isso é feito carregando a lista de salas já visitadas.",
      "O meta-interpretador executa a prova e devolve a árvore usada como explicação."
    ],
    implementacao: "As regras ficam em um texto único (motor/base.py) e os fatos são gerados do JSON. O mesmo texto é exportado para Prolog (prolog/*.pl), para conferir as respostas com o SWI-Prolog quando ele estiver instalado.",
    exemplo: "Cada ponto de interação do jogo vira uma consulta. Confrontar Barros, por exemplo, vira refutado(guarda, S, De, Ate).",
    demo: "consultas",
    resultado: "As consultas do contexto são respondidas pelo motor (veja a demonstração). A conferência com o SWI-Prolog não foi executada: o programa não está instalado neste ambiente."
  },
  {
    id: "M3", titulo: "Motor SLD próprio", resumo: "Unificação com verificação de ocorrência e resolução SLD.",
    arquivos: "motor/termos.py, motor/sld.py (e js/motor/termos.js, sld.js)",
    topicos: ["Termos", "Variáveis", "Substituições", "Unificação", "Occurs-check", "Renomeação", "SLD", "Encadeamento para trás", "Profundidade", "Laços"],
    objetivo: "Implementar o mecanismo que o Prolog usa por baixo, para provar objetivos e devolver as substituições e a árvore de prova.",
    fundamentacao: [
      "Unificar dois termos é encontrar uma substituição que os torna iguais. A verificação de ocorrência impede ligar uma variável a um termo que a contém, como em X = f(X).",
      "Cada cláusula usada recebe variáveis novas (renomeação), para que o X de um passo não se confunda com o X de outro.",
      "A resolução SLD troca o objetivo pelos subobjetivos do corpo da cláusula escolhida. O limite de profundidade e o corte de objetivos que são variantes de um ancestral evitam provas infinitas. Sem tabulação, esse corte pode perder soluções que dependem do laço; o motor conta quantos laços cortou."
    ],
    implementacao: "Termos, cláusulas e leitor de texto, unificação, SLD com predicados embutidos (is, comparações, \\=, \\+, findall, min_list) e o meta-interpretador. Escrito em Python (canônico) e portado para JavaScript, que é o que roda no site.",
    exemplo: "Unificar registro(guarda, S, T) com registro(guarda, cafe, 5) dá S = cafe e T = 5. Teste você mesmo na demonstração ao lado.",
    demo: "stepper",
    resultado: "Testes de unificação, occurs-check, laços, negação por falha e aritmética em tests/test_unificacao.py e tests/test_sld.py. Resultados na tabela do módulo M6."
  },
  {
    id: "M4", titulo: "Camada SAT e DPLL", resumo: "Grounding, FNC, DIMACS e DPLL próprio.",
    arquivos: "motor/sat.py (e js/motor/sat.js)",
    topicos: ["Grounding", "Variáveis proposicionais", "FNC", "DIMACS", "DPLL", "Propagação unitária", "Retrocesso", "Consistência", "Consequência lógica", "Contagem de modelos"],
    objetivo: "Usar o SAT para três perguntas: a entrada é consistente? Esta conclusão é consequência, por refutação? Quantos padrões de presença existem?",
    fundamentacao: [
      "Grounding instancia as regras para o domínio finito da entrada e gera variáveis proposicionais x(pessoa, sala, minuto).",
      "Consequência por refutação: se as premissas somadas à negação da conclusão forem insatisfatíveis, a conclusão é consequência das premissas.",
      "A contagem é projetada: conta quantos padrões distintos de presença em uma sala existem entre os modelos, com um teto para não explodir."
    ],
    implementacao: "Codificação em CNF, exportação DIMACS e DPLL com propagação unitária por contadores, trilha de atribuições e desfazer, tudo escrito pela dupla. Nenhum resolvedor pronto é usado. Quando os registros se contradizem, um núcleo mínimo (por eliminação) mostra quais itens entram em conflito.",
    exemplo: "\"Existe um trajeto de cada pessoa que respeite todos os registros?\" é uma pergunta de consistência sobre variáveis x(pessoa, sala, minuto).",
    demo: "sat",
    resultado: "Consistência, refutação, contagem e DIMACS funcionando; conferidos contra o caminho SLD em casos próprios e aleatórios (tests/test_sat.py, test_casos.py, test_fuzz.py)."
  },
  {
    id: "M5", titulo: "Interface e explicação", resumo: "Linha de comando, perguntas, respostas e provas legíveis.",
    arquivos: "main.py, js/engine/adaptador.js",
    topicos: ["CLI", "Entrada JSON", "Perguntas", "Respostas", "Árvores de prova", "Justificativas", "Integração com o RPG"],
    objetivo: "Transformar uma ação do jogador em uma consulta lógica e a resposta do motor em uma explicação legível.",
    fundamentacao: [
      "A linha de comando recebe o arquivo do caso e a pergunta, e imprime a resposta, as regras usadas, as substituições e o motivo de uma resposta não ser única.",
      "O jogo não calcula nada: ele pergunta ao motor e mostra a prova que volta.",
      "Os modos Aprendiz e Técnico mostram o mesmo resultado em dois níveis de explicação."
    ],
    implementacao: "main.py (CLI em Python, com formatos texto e JSON) e a ponte do site: o adaptador chama o motor em JavaScript, que roda no navegador.",
    exemplo: "Clicar em Barros no café vira uma consulta ao motor, e a resposta volta para o painel.",
    demo: "fluxo",
    resultado: "Saídas reais da CLI para o caso oficial e para os casos próprios, gravadas por tools/gerar_saidas_cli.py (veja a demonstração)."
  },
  {
    id: "M6", titulo: "Testes automatizados", resumo: "Casos de aceitação, casos próprios, oráculo e paridades.",
    arquivos: "tests/, tools/exportar_testes.py",
    topicos: ["Casos de aceitação", "Testes próprios", "Entrada inconsistente", "Resposta não única", "Testes de SLD", "Testes SAT", "Oráculo independente", "Python × JavaScript", "Prolog × Python"],
    objetivo: "Provar, por testes que qualquer pessoa pode rodar, que o sistema responde ao que o enunciado pede.",
    fundamentacao: [
      "Os casos de aceitação são respostas que o enunciado já fixa. O sistema só é aceito se produzir exatamente elas.",
      "Os casos próprios exploram os limites: entrada inconsistente, resposta não única, mapa com ciclo, nomes com acento, janela de um minuto.",
      "A tabela abaixo mostra só resultados obtidos por execução. Um teste que não pôde rodar aparece como \"Não executado\", com o motivo."
    ],
    implementacao: "pytest (python -m pytest tests). Um script roda o pytest e grava o resultado em data/testes.js, que o site lê.",
    exemplo: "O caso \"sem o registro do guarda às 21h20\" é um dos testes de aceitação e termina em \"nenhum suspeito\".",
    demo: "testes",
    resultado: "Veja a tabela: contagem, tempo e estado de cada teste, com data da execução."
  }
];
