/* lab.js — Laboratório de Inferência.
   Analisa o caso do jogo (casos/oficial.json): mostra mapa e linha do tempo e responde perguntas com o motor
   (SLD e DPLL, js/motor/*), sempre com a prova, o núcleo do conflito ou o comando equivalente da CLI. */
(function () {
  var GE = window.GE, el = GE.el;
  var analise, caso = window.GE_CASOS.oficial;   /* o caso do jogo */

  function desenhaAnalise() {
    GE.limpar(analise);
    var pessoas = []; caso.registros.concat(caso.depoimentos).forEach(function (r) { if (pessoas.indexOf(r[0]) < 0) pessoas.push(r[0]); });
    var abas = [["Resumo", resumo], ["Mapa", mapa], ["Linha do tempo", tempo], ["Fatos Prolog", fatos]];
    var painel = el("div"), barra = el("div", { class: "abas-lab", role: "tablist", "aria-label": "Visões do caso" });
    function resumo() {
      return el("div", null, el("div", { class: "resumo-caso" },
        [["salas", GE.salasDe(caso).length], ["corredores", caso.corredores.length], ["pessoas", pessoas.length], ["registros", caso.registros.length], ["depoimentos", caso.depoimentos.length]].map(function (x) { return el("div", null, el("b", { text: x[1] }), el("span", { text: x[0] })); })),
        el("p", null, el("b", { text: "Local do crime: " }), GE.nomeSala(caso.local_do_crime), ".  ", el("b", { text: "Janela: " }), GE.hora(caso.janela[0]) + " a " + GE.hora(caso.janela[1]) + "."),
        el("p", { style: { marginTop: "6px", color: "var(--tinta-suave)" }, text: "Contagens feitas direto sobre os dados do caso. As respostas lógicas vêm do cartão \"Perguntar ao motor\"." }));
    }
    function mapa() {
      var leg = el("p", { class: "grafo-leg", "aria-live": "polite", text: GE.legendaGrafo(caso, null) });
      return el("div", { class: "grafo", style: { maxWidth: "560px" } }, GE.grafoSVG(caso, { aoEscolher: function (s) { leg.textContent = GE.legendaGrafo(caso, s); } }), leg);
    }
    function tempo() { return el("div", null, el("div", { class: "linha-tempo" }, GE.linhaTempoSVG(caso)), GE.legendaSalas(caso)); }
    function fatos() { return el("pre", { class: "sombra-codigo", tabindex: "0", style: { maxHeight: "320px" }, text: GE.fatosProlog(caso) }); }
    function mostra(i) {
      [].forEach.call(barra.children, function (b, j) { b.setAttribute("aria-selected", String(i === j)); });
      GE.limpar(painel); painel.appendChild(abas[i][1]());
    }
    abas.forEach(function (a, i) { barra.appendChild(el("button", { type: "button", role: "tab", "aria-selected": "false", text: a[0], onclick: function () { mostra(i); } })); });
    analise.appendChild(el("h3", null, "Análise do caso ", el("span", { class: "selo real", text: "dados do caso do jogo" })));
    analise.appendChild(el("p", { class: "sub", text: "Estas abas mostram os dados do caso do jogo (casos/oficial.json). A inferência fica no cartão \"Perguntar ao motor\"." }));
    analise.appendChild(barra); analise.appendChild(painel); mostra(0);
  }

  var selPerg, btnExec, resultado, arquivoCaso = "casos/oficial.json";
  var PERGUNTAS = [["quem", "Quem são os suspeitos finais?"], ["distancias", "Qual a distância entre as salas?"], ["hall", "Quem poderia estar no local do crime durante a janela?"],
    ["refutados", "Quais depoimentos são refutados?"], ["consistencia", "A entrada é consistente? (SAT)"], ["modelos", "Quantas histórias possíveis existem? (SAT)"],
    ["consulta", "Consulta livre em Prolog"], ["dimacs", "Exportar a CNF em DIMACS"], ["decisivos", "Quais depoimentos, se falsos, mudariam o suspeito? (bônus)"]];
  var CLI = { quem: "quem-levou", distancias: "distancia --de SALA --ate SALA", hall: "onde-pode --pessoa PESSOA", refutados: "refutados", consistencia: "sat", modelos: "sat-contar --pessoa PESSOA", consulta: 'consulta --objetivo "suspeito(P)"', dimacs: "dimacs --pessoa PESSOA --saida arquivo.cnf", decisivos: "depoimentos-decisivos" };
  var selo = function (t) { return el("span", { class: "selo real", text: t }); };
  function faixas(v) { return v.length ? v.map(function (x) { return x[0] + "–" + x[1]; }).join(", ") : "nenhum minuto"; }

  var RESPOSTAS = {
    quem: function (c) {
      var a = c.analise(), sat = c.satSuspeitos(), w = el("div", { style: { display: "grid", gap: "10px" } });
      w.appendChild(el("p", { class: "conclusao-motor" }, el("b", { text: a.conclusao.texto })));
      w.appendChild(GE.tabelaPapel(["Pessoa", "Situação", "Por quê"], a.pessoas.map(function (p) { return [GE.pessoaRotulo(p.pessoa), el("span", { class: "selo " + (p.situacao === "suspeito" ? "falhou" : p.situacao === "inconsistente" ? "pendente" : "real"), text: p.situacao }), p.motivo]; })));
      w.appendChild(el("p", { class: "nota-origem", text: "Conferência pelo caminho SAT: " + (sat.length ? sat.join(", ") : "nenhum suspeito") + (sat.join() === a.suspeitos.join() ? " (os dois caminhos concordam)." : " (os dois caminhos DIVERGEM; veja o aviso nas regras do projeto).") }));
      a.suspeitos.forEach(function (n) {
        var pr = c.prova("suspeito(" + c.atomo(n) + ")");
        if (pr.provado) { var d = el("details", { class: "bloco" }, el("summary", { style: { cursor: "pointer", fontWeight: "800", color: "var(--vinho)" }, text: "Prova de que " + n + " é suspeito (" + pr.inferencias + " inferências)" })); d.appendChild(GE.arvoreProva(pr.arvore, GE.estado.modo)); w.appendChild(d); }
      });
      return w;
    },
    distancias: function (c) {
      var salas = GE.M.salasDo(c.dados), linhas = salas.map(function (a) { return [a].concat(salas.map(function (b) { var d = c.distancia(a, b); return d === null ? "sem caminho" : String(d); })); });
      return el("div", { style: { display: "grid", gap: "8px" } }, GE.tabelaPapel([""].concat(salas), linhas), el("p", { class: "nota-origem", text: "Minutos pelo menor caminho (consulta distancia/3, sem repetir sala)." }));
    },
    hall: function (c) {
      var d = c.dados, crime = d.local_do_crime, sat = c.satTodos();
      return el("div", { style: { display: "grid", gap: "8px" } },
        GE.tabelaPapel(["Pessoa", "SLD (pode_na_janela)", "SAT (modelos)", "Conferem?"], GE.M.pessoasDo(d).map(function (p) {
          var a = c.janelas(p, crime), s = sat[p].sat ? sat[p].minutos_no_crime : null;
          return [GE.pessoaRotulo(p), faixas(a), s ? faixas(s) : "registros inconsistentes", s ? (JSON.stringify(a) === JSON.stringify(s) ? "sim" : "não") : "—"];
        })),
        el("p", { class: "nota-origem", text: "Minutos em que a pessoa poderia estar em " + crime + " dentro da janela " + d.janela[0] + "–" + d.janela[1] + ". O SLD calcula por intervalos; o SAT procura um modelo para cada minuto." }));
    },
    refutados: function (c) {
      var d = c.dados, w = el("div", { style: { display: "grid", gap: "8px" } }), ref = c.refutados();
      if (!ref.length) w.appendChild(el("p", { text: "Nenhum depoimento é refutado por um registro." }));
      ref.forEach(function (r) {
        var pr = c.prova("refutado(" + c.atomo(r[0]) + ", " + c.atomo(r[1]) + ", " + r[2] + ", " + r[3] + ")");
        var det = el("details", { class: "bloco", open: ref.length === 1 }, el("summary", { style: { cursor: "pointer", fontWeight: "800" }, text: r[0] + " disse " + r[1] + " dos minutos " + r[2] + " a " + r[3] }));
        if (pr.provado) det.appendChild(GE.arvoreProva(pr.arvore, GE.estado.modo)); w.appendChild(det);
      });
      var so = [];
      d.depoimentos.forEach(function (x) {
        if (ref.some(function (r) { return r[0] === x[0] && r[1] === x[1] && r[2] === x[2] && r[3] === x[3]; })) return;
        var r = GE.M.SAT.depoimentoRefutadoSat(d, x[0], x[1], x[2], x[3]);
        if (r.refutado) so.push(x[0] + " (" + x[1] + ", " + x[2] + "–" + x[3] + "): " + r.nucleo.join(" + "));
      });
      if (so.length) w.appendChild(el("p", { class: "nota-origem" }, el("b", { text: "Refutados só pelo SAT (não há registro dentro do intervalo, mas não dá tempo de chegar): " }), so.join("; ")));
      return w;
    },
    consistencia: function (c) {
      var sat = c.satTodos();
      return el("div", { style: { display: "grid", gap: "8px" } }, GE.tabelaPapel(["Pessoa", "Resultado", "Variáveis / cláusulas", "Decisões / conflitos", "Núcleo do conflito"], Object.keys(sat).map(function (p) {
        var r = sat[p]; return [GE.pessoaRotulo(p), el("span", { class: "selo " + (r.sat ? "real" : "falhou"), text: r.sat ? "SAT" : "UNSAT" }), r.variaveis + " / " + r.clausulas, r.stats.decisoes + " / " + r.stats.conflitos, r.sat ? "—" : r.nucleo.join(" + ")];
      })), el("p", { class: "nota-origem", text: "SAT: existe um trajeto que respeita todos os registros e o tempo dos corredores. UNSAT: os registros se contradizem, e o núcleo mostra quais." }));
    },
    modelos: function (c) {
      var d = c.dados;
      return el("div", { style: { display: "grid", gap: "8px" } }, GE.tabelaPapel(["Pessoa", "Padrões de presença em " + d.local_do_crime + " (janela)"], GE.M.pessoasDo(d).map(function (p) {
        var r = GE.M.SAT.contarPadroes(d, p, d.local_do_crime, d.janela[0], d.janela[1], 2000); return [GE.pessoaRotulo(p), (r.truncado ? "pelo menos " : "") + r.total];
      })), el("p", { class: "nota-origem", text: "Contagem de modelos projetada nas variáveis de presença naquela sala e janela, com teto de 2000. Um padrão é uma combinação distinta de minutos em que a pessoa está na sala." }));
    },
    consulta: function (c) {
      var ent = el("input", { type: "text", value: "suspeito(P)", "aria-label": "Consulta em Prolog", spellcheck: "false", style: { flex: "1 1 220px", minWidth: "0" } }), saida = el("div");
      function roda() { GE.limpar(saida); saida.appendChild(GE.rodarConsulta(c, ent.value)); }
      ent.addEventListener("keydown", function (e) { if (e.key === "Enter") roda(); });
      setTimeout(roda, 0);
      return el("div", { style: { display: "grid", gap: "8px" } }, el("p", { class: "nota-origem", text: "Predicados disponíveis: pessoa, sala, corredor, local_crime, janela, registro, depoimento, distancia, pode_estar, pode_na_janela, refutado, liberado, registro_impossivel, suspeito. Nomes com acento viram minúsculas sem acento (Café → cafe)." }),
        el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, ent, el("button", { class: "botao", type: "button", text: "Consultar", onclick: roda })), saida);
    },
    dimacs: function (c) {
      var pessoas = GE.M.pessoasDo(c.dados), ta = el("textarea", { readonly: "", rows: "12", "aria-label": "DIMACS", style: { width: "100%", fontFamily: "monospace", fontSize: ".8rem" } });
      var sel = el("select", { "aria-label": "Pessoa", onchange: gera }, pessoas.map(function (p) { return el("option", { value: p, text: p }); }));
      function gera() { var t = new GE.M.SAT.Codificacao(c.dados, sel.value).dimacs(); ta.value = t; }
      gera();
      return el("div", { style: { display: "grid", gap: "8px" } }, el("label", null, "Pessoa ", sel), ta, el("p", { class: "nota-origem", text: "Selecione o texto e copie para um arquivo .cnf. Cada pessoa tem a sua CNF. Os comentários (linhas c) dizem o que cada variável significa." }));
    },
    decisivos: function (c) {
      var r = c.depoimentosDecisivos(), atuais = r.suspeitos_atuais.length ? r.suspeitos_atuais.join(", ") : "ninguém";
      if (!r.tamanho) return el("p", { text: "Suspeito(s) atual(is): " + atuais + ". Nenhum conjunto de depoimentos falsos mudaria isso." });
      return el("div", { style: { display: "grid", gap: "8px" } },
        el("p", null, el("b", { text: "Menor conjunto: " + r.tamanho + " depoimento(s). " }), "Hoje o suspeito é " + atuais + ". Se qualquer um destes fosse falso, o resultado mudaria:"),
        GE.tabelaPapel(["Depoimento", "Se for falso, os suspeitos passam a ser"], r.conjuntos.map(function (x) {
          return [x.depoimentos.map(function (d) { return d[0] + " diz " + d[1] + " de " + d[2] + " a " + d[3]; }).join("; "), x.suspeitos.length ? x.suspeitos.join(", ") : "ninguém"];
        })),
        el("p", { class: "nota-origem", text: "Busca por tamanho crescente: remove cada combinação de depoimentos, refaz a inferência SLD e compara os suspeitos. O depoimento já refutado por um registro não aparece: tirá-lo não muda nada." }));
    }
  };

  function executar() {
    GE.limpar(resultado); resultado.classList.add("pronto");
    var c;
    try { c = GE.motor.caso(caso); } catch (e) { resultado.appendChild(el("p", { class: "erro-msg", text: "O motor recusou o caso: " + GE.msgErro(e) })); return; }
    resultado.appendChild(el("div", { class: "estado-motor" }, el("span", { class: "luz ligada", "aria-hidden": "true" }), "Motor conectado", selo("calculado agora, no navegador")));
    var t0 = (window.performance || Date).now(), corpo;
    try { corpo = RESPOSTAS[selPerg.value](c); } catch (e) { corpo = el("p", { class: "erro-msg", text: "Não foi possível responder: " + GE.msgErro(e) }); }
    var ms = Math.round((window.performance || Date).now() - t0);
    resultado.appendChild(corpo);
    resultado.appendChild(GE.blocoCodigo("Mesma pergunta na linha de comando (Python)", "python main.py --entrada " + arquivoCaso + " --pergunta " + CLI[selPerg.value], "Respondido em " + ms + " ms pelo motor em JavaScript; a CLI em Python devolve as mesmas respostas."));
  }

  GE.lab = {
    iniciar: function (alvo) {
      GE.limpar(alvo);
      selPerg = el("select", { id: "lab-perg" }, PERGUNTAS.map(function (p) { return el("option", { value: p[0], text: p[1] }); }));
      btnExec = el("button", { class: "botao", type: "button", text: "Executar", onclick: executar });
      resultado = el("div", { class: "resultado", "aria-live": "polite" }, el("div", { class: "estado-motor" }, el("span", { class: "luz ligada", "aria-hidden": "true" }), "Motor pronto"),
        el("p", { text: "Escolha uma pergunta e clique em Executar. A resposta vem com a justificativa." }));
      var cardPerg = el("section", { class: "lab-card papel", "aria-labelledby": "lab-h-perg" },
        el("h3", { id: "lab-h-perg" }, "Perguntar ao motor ", el("span", { class: "selo real", text: "motor próprio" })),
        el("p", { class: "sub", text: "Escolha uma pergunta sobre o caso do jogo." }),
        el("label", { for: "lab-perg", text: "Pergunta" }), selPerg,
        el("div", { class: "linha-acoes" }, btnExec), resultado);
      analise = el("section", { class: "lab-card papel", "aria-label": "Análise do caso" });
      alvo.appendChild(el("div", { class: "lab-grade" }, el("div", { class: "lab-col" }, analise), el("div", { class: "lab-col" }, cardPerg)));
      desenhaAnalise();
    }
  };
})();
