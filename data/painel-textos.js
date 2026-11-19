/* ==========================================================================
   Painel "Lógica em Ação" — textos explicativos + montagem com resultados REAIS do motor.
   --------------------------------------------------------------------------
   Cada evento tem um texto explicativo (escrito por nós, para o modo Aprendiz e o Técnico) e uma função
   `montar(R)` que recebe os resultados calculados pelo motor (js/motor/*) sobre o caso oficial e devolve
   os blocos que mostram esses resultados. Os números e as fórmulas que aparecem vêm de `R`:
   nenhum valor de inferência é escrito à mão aqui.

   Forma devolvida por montar(R):
   { aprendiz:{aconteceu, relacao}, tecnico:{aconteceu, relacao},
     formal:[{rotulo, codigo, nota?, soTecnico?}], extra?:{titulo, itens:[{t,d}]},
     raciocinio:{ tipo:"passos"|"grafo"|"campos"|"arvore", aviso, ... } }
   ========================================================================== */
window.GE = window.GE || {};

(function () {
  var GE = window.GE;
  var h = function (m) { return GE.hora(m); };
  var faixa = function (a, b) { return a + "–" + b + " (" + h(a) + " a " + h(b) + ")"; };
  var pl = function (n, a, b) { return n + " " + (n === 1 ? a : b); };
  var inf = function (n) { return n <= -1000 ? "−∞" : n >= 1000 ? "+∞" : String(n); };

  /* folhas do tipo "fato" de uma árvore de prova, sem repetir */
  function fatosDaArvore(nos, acc) {
    acc = acc || [];
    nos.forEach(function (n) {
      if (n.tipo === "fato" && acc.indexOf(n.objetivo) < 0) acc.push(n.objetivo);
      fatosDaArvore(n.filhos, acc);
    });
    return acc;
  }
  GE.fatosDaArvore = fatosDaArvore;

  GE.EVENTOS_MODELO = [
    {
      id: "registro", ordem: 1, conceito: "Fatos e predicados",
      acao: "Você examinou o livro de registros.",
      montar: function (R) {
        var regs = R.q("registro(guarda, S, T)").solucoes;
        var primeiro = regs[0];
        return {
          aprendiz: {
            aconteceu: "O livro de registros mostra onde cada pessoa foi vista. Uma das linhas diz que o guarda Barros estava no " + (primeiro.S === "cafe" ? "café" : primeiro.S) + " aos " + primeiro.T + " minutos depois das 21h, ou seja, às " + h(+primeiro.T) + ".",
            relacao: "Um fato é uma informação tratada como verdadeira na base de conhecimento. Um registro de câmera ou de cartão vira um fato com três informações: quem, onde e quando."
          },
          tecnico: {
            aconteceu: "O registro foi convertido em uma cláusula unitária, sem corpo: um fato do predicado registro/3.",
            relacao: "registro(pessoa, sala, instante) tem aridade 3 e usa apenas constantes. Os instantes são inteiros, em minutos depois das 21h. Os fatos formam a parte extensional da base e são gerados automaticamente a partir do JSON de entrada: a base carregada agora tem " + R.nFatos + " fatos e " + R.nRegras + " regras."
          },
          formal: [{ rotulo: "Fatos do guarda lidos da base", codigo: regs.map(function (s) { return "registro(guarda, " + s.S + ", " + s.T + ")."; }).join("\n"), nota: "pessoa, sala, minutos depois das 21h" }],
          raciocinio: {
            tipo: "passos", origem: "motor",
            aviso: "Fatos lidos da base de conhecimento que o motor carregou (consulta registro(guarda, S, T), " + pl(R.q("registro(guarda, S, T)").inferencias, "inferência", "inferências") + ").",
            aprendiz: [
              { t: "Quem?", d: "guarda: a pessoa que foi vista." },
              { t: "Onde?", d: primeiro.S + ": a sala em que ela estava." },
              { t: "Quando?", d: primeiro.T + ": " + primeiro.T + " minutos depois das 21h, isto é, " + h(+primeiro.T) + "." }
            ],
            tecnico: [
              { t: "Predicado e aridade", d: "registro/3, com três argumentos." },
              { t: "Domínios", d: "pessoa ∈ {" + R.pessoas.join(", ") + "}; sala ∈ {" + R.salas.join(", ") + "}; instante ∈ ℕ." },
              { t: "Origem dos fatos", d: "Uma linha da lista \"registros\" do JSON vira um fato.", codigo: "[\"guarda\", \"" + primeiro.S + "\", " + primeiro.T + "]  →  registro(guarda, " + primeiro.S + ", " + primeiro.T + ")." }
            ]
          }
        };
      }
    },
    {
      id: "mapa", ordem: 2, conceito: "Relações e regras",
      acao: "Você abriu a planta do museu.",
      montar: function (R) {
        var d = R.q("distancia(hall, reserva, D)");
        var caminhos = R.q("caminho(hall, reserva, [hall], X)").solucoes.map(function (s) { return +s.X; }).sort(function (a, b) { return a - b; });
        return {
          aprendiz: {
            aconteceu: "A planta mostra quatro salas ligadas por corredores. Cada corredor leva alguns minutos para ser percorrido, e dá para andar nos dois sentidos.",
            relacao: "As salas são constantes e os corredores são relações entre elas. Com essas relações o sistema descobre caminhos e o tempo mínimo de deslocamento: do hall à reserva, por exemplo, o motor achou " + d.solucoes[0].D + " minutos."
          },
          tecnico: {
            aconteceu: "O grafo não direcionado do museu foi carregado a partir dos fatos corredor/3.",
            relacao: "A distância entre duas salas é o menor caminho, definido recursivamente. A recursão evita ciclos carregando a lista de salas já visitadas (caminho/4), e a minimização usa findall/3 e min_list/2. O corredor vale nos dois sentidos pela regra liga/3."
          },
          formal: [
            { rotulo: "Fatos do mapa (gerados do JSON)", codigo: R.fatos("corredor") },
            { rotulo: "Regras do motor para distância", soTecnico: true, codigo: R.regra("liga") + "\n\n" + R.regra("caminho") + "\n\n" + R.regra("distancia") }
          ],
          raciocinio: {
            tipo: "grafo", origem: "motor",
            aviso: "O grafo mostra os dados de entrada. Os números abaixo foram calculados pelo motor SLD.",
            passos: [
              { t: "Caminhos de hall até reserva sem repetir sala", d: "Somas de tempo encontradas: " + caminhos.join(" e ") + " minutos.", codigo: "?- findall(X, caminho(hall, reserva, [hall], X), L)." },
              { t: "Menor deles", d: "min_list escolhe " + d.solucoes[0].D + ".", codigo: "?- distancia(hall, reserva, D).   →   D = " + d.solucoes[0].D },
              { t: "Esforço do motor", d: pl(d.inferencias, "passo", "passos") + " de resolução para esta consulta." }
            ]
          }
        };
      }
    },
    {
      id: "depoimento", ordem: 3, conceito: "Afirmações e verificação lógica",
      acao: "Barros afirma que ficou no café.",
      montar: function (R) {
        var s = R.q("depoimento(guarda, S, De, Ate)").solucoes[0];
        return {
          aprendiz: {
            aconteceu: "Seu Barros diz que ficou no café das " + h(+s.De) + " às " + h(+s.Ate) + " e que não saiu nem por um minuto.",
            relacao: "Um depoimento é uma afirmação. Ao contrário de um registro, ele precisa ser confrontado com os fatos confiáveis antes de ser aceito."
          },
          tecnico: {
            aconteceu: "A afirmação entrou como fato do predicado depoimento/4, separado de registro/3.",
            relacao: "Manter as duas relações separadas cria duas camadas de confiança: registros são premissas confiáveis e depoimentos são hipóteses que podem ser refutadas. Pelo enunciado, um depoimento não refutado é aceito como verdadeiro nas conclusões finais."
          },
          formal: [{ rotulo: "Fato lido da base", codigo: "depoimento(guarda, " + s.S + ", " + s.De + ", " + s.Ate + ").", nota: "pessoa, sala, de, até (minutos depois das 21h)" }],
          raciocinio: {
            tipo: "passos", origem: "motor",
            aviso: "Fato lido da base de conhecimento que o motor carregou.",
            aprendiz: [
              { t: "A pessoa afirma", d: "guarda diz ter ficado em " + s.S + ", entre " + h(+s.De) + " e " + h(+s.Ate) + "." },
              { t: "Ainda não é prova", d: "Falta comparar a frase com os registros." }
            ],
            tecnico: [
              { t: "Predicado e aridade", d: "depoimento/4: pessoa, sala, início e fim do intervalo declarado." },
              { t: "Relação com registro/3", d: "Nenhuma regra transforma depoimento em registro. Eles só se encontram na regra refutado/4." }
            ]
          }
        };
      }
    },
    {
      id: "contradicao", ordem: 4, conceito: "Refutação",
      acao: "Você confrontou Barros com o registro da galeria às 21h20.",
      montar: function (R) {
        var p = R.prova("refutado(guarda, S, De, Ate)");
        var raiz = p.arvore[0], u = raiz.unificador, v = p.valores;
        var conds = raiz.filhos.filter(function (f) { return f.tipo === "embutido"; });
        return {
          aprendiz: {
            aconteceu: "A câmera da galeria registrou Barros lá às " + h(+u.T) + ", um horário dentro do intervalo em que ele diz ter ficado no café.",
            relacao: "Quando um fato confiável é incompatível com uma afirmação, a afirmação é refutada. Refutar um depoimento não prova que a pessoa é culpada: só tira dela aquele álibi."
          },
          tecnico: {
            aconteceu: "Os dois fatos satisfazem as condições do corpo da regra refutado/4: o motor provou refutado(guarda, " + v.S + ", " + v.De + ", " + v.Ate + ") em " + p.inferencias + " inferências.",
            relacao: "S2 \\= S exige salas diferentes, e De =< T =< Ate exige que o instante do registro caia dentro do intervalo do depoimento. As comparações usam predicados aritméticos embutidos, porque a unificação pura não compara números."
          },
          formal: [
            { rotulo: "Depoimento", codigo: "depoimento(guarda, " + v.S + ", " + v.De + ", " + v.Ate + ")." },
            { rotulo: "Registro", codigo: "registro(guarda, " + u.S2 + ", " + u.T + ")." },
            { rotulo: "Regra usada pelo motor", codigo: R.regra("refutado") }
          ],
          raciocinio: {
            tipo: "passos", origem: "motor",
            aviso: "Prova calculada pelo motor SLD (consulta refutado(guarda, S, De, Ate)).",
            aprendiz: [
              { t: "O depoimento", d: v.S + ", das " + h(+v.De) + " às " + h(+v.Ate) + "." },
              { t: "O registro", d: u.S2 + ", às " + h(+u.T) + "." },
              { t: "Conferência", d: u.S2 + " é uma sala diferente de " + v.S + ", e " + h(+u.T) + " está entre " + h(+v.De) + " e " + h(+v.Ate) + ". Logo, o depoimento é refutado." }
            ],
            tecnico: [
              { t: "Variáveis ligadas pelo unificador", d: "θ devolvido pelo motor para a regra usada.", codigo: Object.keys(u).map(function (k) { return k + " = " + u[k]; }).join(", ") },
              { t: "Condições do corpo", d: "", codigo: conds.map(function (c) { return c.objetivo + "   → verdadeiro  (" + c.regra.replace("embutido: ", "") + ")"; }).join("\n") },
              { t: "Conclusão", d: "", codigo: raiz.objetivo }
            ]
          }
        };
      }
    },
    {
      id: "presenca", ordem: 5, conceito: "Inferência e restrições temporais",
      acao: "Você perguntou quem poderia estar no hall entre 21h14 e 21h30.",
      montar: function (R) {
        var jan = R.c.janelas("guarda", "hall"), bruto = R.q("pode_estar(guarda, hall, I, F)").solucoes;
        var j = R.c.dados.janela;
        var txt = jan.map(function (x) { return faixa(x[0], x[1]); }).join(" e ");
        return {
          aprendiz: {
            aconteceu: "Entre os registros de Barros, será que sobrou tempo para passar pelo hall? A conta considera quanto ele leva para ir até lá e voltar a tempo. O motor encontrou os minutos " + txt + ".",
            relacao: "Inferir é tirar conclusões novas de fatos e regras. Aqui, dos registros e do tempo dos corredores sai o intervalo em que a pessoa poderia ter estado no hall, e só vale a parte que cai dentro da janela do sumiço."
          },
          tecnico: {
            aconteceu: "Consulta pode_na_janela(guarda, hall, I, F), que usa pode_estar/4 sobre cada par de registros consecutivos (consecutivo/5).",
            relacao: "O intervalo [t1 + d(s1, x), t2 − d(x, s2)] só existe se não for vazio. É uma restrição aritmética sobre inteiros, e a interseção com a janela do sumiço, [" + j[0] + ", " + j[1] + "], decide se a pessoa é fisicamente possível no local. Antes do primeiro registro e depois do último o intervalo é aberto."
          },
          formal: [
            { rotulo: "Intervalo possível na sala x", codigo: "[t1 + d(s1, x), t2 − d(x, s2)]" },
            { rotulo: "Regra usada pelo motor", soTecnico: true, codigo: R.regra("pode_estar").split("\n\n")[0] + "\n\n" + R.regra("pode_na_janela") },
            { rotulo: "Consulta", soTecnico: true, codigo: "?- pode_na_janela(guarda, hall, I, F)." }
          ],
          raciocinio: {
            tipo: "passos", origem: "motor",
            aviso: "Cálculo feito pelo motor SLD sobre o caso oficial.",
            aprendiz: [
              { t: "O que o motor concluiu", d: "O guarda pode ter estado no hall nos minutos " + txt + "." },
              { t: "Por que dois trechos", d: "Ele foi visto na galeria no minuto 20, e a conta funciona antes e depois desse registro." }
            ],
            tecnico: [
              { t: "Intervalos de pode_estar antes de cortar pela janela", d: "Os extremos abertos (antes do primeiro e depois do último registro) aparecem como ±∞.",
                codigo: bruto.map(function (s) { return "[" + inf(+s.I) + ", " + inf(+s.F) + "]"; }).join("\n") },
              { t: "Interseção com a janela [" + j[0] + ", " + j[1] + "]", d: "", codigo: jan.map(function (x) { return "→ [" + x[0] + ", " + x[1] + "]   (" + h(x[0]) + " a " + h(x[1]) + ")"; }).join("\n") }
            ]
          }
        };
      }
    },
    {
      id: "prova", ordem: 6, conceito: "Resolução SLD",
      acao: "Você pediu a justificativa de uma conclusão.",
      montar: function (R) {
        var p = R.provaSusp, raiz = p.arvore[0];
        return {
          aprendiz: {
            aconteceu: "Você quer ver por que o sistema chegou a uma resposta, passo a passo. Aqui está a prova de que o guarda continua suspeito.",
            relacao: "Uma prova mostra quais fatos e regras sustentam a resposta. Assim ninguém precisa confiar às cegas no sistema: dá para conferir cada passo."
          },
          tecnico: {
            aconteceu: "Pedido de explicação: o meta-interpretador devolveu a árvore usada na prova de suspeito(guarda), com " + pl(p.inferencias, "inferência", "inferências") + ".",
            relacao: "A resolução SLD parte do objetivo (encadeamento para trás), escolhe uma cláusula cuja cabeça unifica com ele e troca o objetivo pelos subobjetivos do corpo, aplicando o unificador. Termina quando não restam subobjetivos. Negações (\\+) são resolvidas por falha e entram na árvore como um passo só."
          },
          formal: [
            { rotulo: "Objetivo", codigo: "?- suspeito(guarda)." },
            { rotulo: "Regra usada pelo motor", soTecnico: true, codigo: R.regra("suspeito") }
          ],
          raciocinio: {
            tipo: "arvore", origem: "motor",
            aviso: "Árvore de prova real, devolvida pelo motor SLD.",
            campos: [
              ["Objetivo consultado", "suspeito(guarda)"],
              ["Cláusula selecionada", raiz.regra],
              ["Unificador", Object.keys(raiz.unificador).map(function (k) { return k + "/" + raiz.unificador[k]; }).join(", ") || "(vazio)"],
              ["Subobjetivos", raiz.filhos.map(function (f) { return f.objetivo; }).join("; ")],
              ["Inferências", String(p.inferencias)],
              ["Resultado", "provado"]
            ],
            arvore: p.arvore
          }
        };
      }
    },
    {
      id: "sat", ordem: 7, conceito: "Satisfatibilidade proposicional",
      acao: "Você pediu para verificar se todos os registros cabem em uma história possível.",
      montar: function (R) {
        var g = R.sat.guarda, dim = R.dimacsGuarda.split("\n"), cab = dim.filter(function (l) { return l.indexOf("p cnf") === 0; })[0];
        var cl = dim.filter(function (l) { return l && l[0] !== "c" && l[0] !== "p"; }).slice(-4);
        var todos = Object.keys(R.sat).map(function (p) { return p + ": " + (R.sat[p].sat ? "SAT (consistente)" : "UNSAT"); });
        return {
          aprendiz: {
            aconteceu: "O sistema conferiu, para cada pessoa, se existe pelo menos um trajeto que respeite todos os registros e o tempo dos corredores. Resultado: " + (todos.every(function (t) { return t.indexOf("UNSAT") < 0; }) ? "todos os registros cabem em uma história possível." : "há registros que não cabem."),
            relacao: "Um conjunto de restrições é satisfatível quando existe pelo menos uma atribuição de valores que torna todas as fórmulas verdadeiras."
          },
          tecnico: {
            aconteceu: "Cada combinação pessoa–sala–minuto virou uma variável proposicional; o DPLL próprio resolveu a FNC de cada pessoa.",
            relacao: "O grounding instancia as regras para o domínio finito da entrada, a fórmula vai para a forma normal conjuntiva (FNC) e o DPLL, com propagação unitária e retrocesso, responde se ela é satisfatível ou insatisfatível."
          },
          formal: [
            { rotulo: "Variável proposicional", codigo: "x(p, s, t)  ≡  a pessoa p está na sala s no minuto t", nota: "s também pode ser 'transito' (nos corredores)." },
            { rotulo: "Restrições da codificação", soTecnico: true, codigo: "1. pelo menos uma sala por minuto: (x1 ∨ x2 ∨ … ∨ transito)\n2. no máximo uma: (¬xi ∨ ¬xj) para cada par\n3. deslocamento: (¬x(s,t) ∨ ¬x(s',t')) se 0 < t'−t < d(s,s')\n4. cada registro: cláusula unitária x(p,s,t)" },
            { rotulo: "DIMACS (cabeçalho e últimas cláusulas, guarda)", soTecnico: true, codigo: cab + "\n…\n" + cl.join("\n") }
          ],
          raciocinio: {
            tipo: "campos", origem: "motor",
            aviso: "Saída real do DPLL próprio (js/motor/sat.js), para a pessoa guarda.",
            campos: [
              ["Fórmula em FNC", g.variaveis + " variáveis, " + g.clausulas + " cláusulas"],
              ["Decisões do DPLL", String(g.stats.decisoes)],
              ["Propagações unitárias", String(g.stats.propagacoes)],
              ["Retrocessos (conflitos)", String(g.stats.conflitos)],
              ["Resultado (SAT ou UNSAT)", g.sat ? "SAT" : "UNSAT"],
              ["Todas as pessoas", todos.join("; ")],
              ["Minutos possíveis no hall (janela)", (g.minutos_no_crime || []).map(function (x) { return x[0] + "–" + x[1]; }).join(", ") || "nenhum"]
            ]
          }
        };
      }
    },
    {
      id: "conclusao", ordem: 8, conceito: "Consequência lógica",
      acao: "Você apresentou a conclusão da investigação.",
      montar: function (R) {
        var a = R.analise, premissas = GE.fatosDaArvore(R.provaSusp.arvore), cons = R.consequencia;
        var susp = a.suspeitos.join(", ") || "ninguém";
        return {
          aprendiz: {
            aconteceu: "O Detetive Moraes apresenta o que a lógica consegue afirmar sobre cada pessoa. O motor concluiu: " + a.conclusao.texto,
            relacao: "Ser fisicamente possível, permanecer suspeito e ter culpa comprovada são coisas diferentes. A lógica deste caso chega, no máximo, ao segundo nível."
          },
          tecnico: {
            aconteceu: "A conclusão é consultada como consequência lógica da base: premissas ⊨ suspeito(P). Pelo SLD: " + susp + ". Pelo SAT: " + R.satSusp.join(", ") + (R.satSusp.join() === a.suspeitos.join() ? " (concordam)." : " (DIVERGEM)."),
            relacao: "Por refutação, as premissas somadas à negação da conclusão devem levar à cláusula vazia (é o que o SAT faz acima). A negação por falha (mundo fechado) faz de quem não consegue ser liberado um suspeito, e retirar um fato pode mudar a conclusão (raciocínio não monotônico)."
          },
          formal: [
            { rotulo: "Regras usadas pelo motor", codigo: R.regra("liberado") + "\n\n" + R.regra("suspeito") }
          ],
          extra: {
            titulo: "Três níveis que não se confundem",
            itens: [
              { t: "Fisicamente possível", d: "Dava tempo de estar no hall durante a janela do sumiço." },
              { t: "Permanece suspeito", d: "É fisicamente possível e nenhum depoimento não refutado o libera." },
              { t: "Culpa comprovada", d: "Este sistema não estabelece isso. Ele só diz quem continua suspeito com os dados que recebeu." }
            ]
          },
          raciocinio: {
            tipo: "campos", origem: "motor",
            aviso: "Resultados reais do motor SLD e do DPLL sobre o caso oficial.",
            campos: [
              ["Suspeitos finais", susp],
              ["Situação de cada pessoa", a.pessoas.map(function (p) { return p.pessoa + ": " + p.situacao; }).join("; ")],
              ["Premissas usadas na prova de suspeito(guarda)", premissas.join("; ")],
              ["Prova por refutação (SAT)", cons.refutacao ? "guarda na galeria no minuto 20 é " + cons.resposta + ": " + cons.refutacao : "resposta: " + cons.resposta],
              ["Conferência entre SLD e SAT", R.satSusp.join() === a.suspeitos.join() ? "os dois caminhos concordam" : "divergem"],
              ["Evidência sobre o objeto", a.saiu_sozinha.length ? "a câmera do hall viu a Estrela sair sozinha às " + h(a.saiu_sozinha[0][2]) + " (não altera os suspeitos)" : "nenhuma"]
            ]
          }
        };
      }
    },
    {
      id: "avistamento", ordem: 9, conceito: "Negação por falha em uma evidência",
      acao: "Você viu a gravação da câmera escondida do hall.",
      montar: function (R) {
        var s = R.c.saiuSozinha(), av = s[0], p = R.prova("saiu_sozinha(estrela, hall, " + (av ? av[2] : 0) + ")"), susp = R.analise.suspeitos.join(", ") || "ninguém";
        return {
          aprendiz: {
            aconteceu: av ? "A câmera escondida do hall viu a própria Estrela às " + h(av[2]) + ", dentro da janela do sumiço, e nenhuma pessoa tem registro no hall nesse minuto. O motor concluiu que a Estrela saiu sozinha." : "O motor não encontrou nenhum avistamento da Estrela dentro da janela.",
            relacao: "Esta é uma evidência diferente das outras: ela fala do objeto, não de uma pessoa. Ela ajuda a explicar como a Estrela saiu, mas não muda quem é suspeito (continua: " + susp + "), porque o guarda segue com um depoimento desmentido."
          },
          tecnico: {
            aconteceu: "Novo fato avistamento/4 na base (objeto, sala, minuto, fonte). A regra saiu_sozinha/3 foi provada com " + pl(p.inferencias, "inferência", "inferências") + ".",
            relacao: "A regra usa negação por falha: saiu_sozinha vale se há avistamento no local do crime dentro da janela e não se consegue provar acompanhada(O, T), isto é, não há registro de nenhuma pessoa na mesma sala no mesmo minuto. Se um registro assim for acrescentado, a conclusão cai (raciocínio não monotônico)."
          },
          formal: [
            { rotulo: "Fato lido da base", codigo: R.fatos("avistamento") },
            { rotulo: "Regras usadas pelo motor", codigo: R.regra("acompanhada") + "\n" + R.regra("saiu_sozinha") }
          ],
          raciocinio: {
            tipo: "arvore", origem: "motor",
            aviso: "Árvore de prova real, devolvida pelo motor SLD.",
            campos: [
              ["Objetivo consultado", "saiu_sozinha(estrela, hall, " + (av ? av[2] : "?") + ")"],
              ["Resultado", p.provado ? "provado" : "não provado"],
              ["Inferências", String(p.inferencias)],
              ["Efeito sobre os suspeitos", "nenhum: continuam " + susp]
            ],
            arvore: p.arvore
          }
        };
      }
    }
  ];
})();
