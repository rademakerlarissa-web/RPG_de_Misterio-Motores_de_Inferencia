/* docs.js — "Como funciona", módulos M1–M6 (capítulos expansíveis) e "Sobre o projeto".
   As demonstrações aqui só usam dados reais da entrada (JSON) ou conteúdo escrito à mão
   e rotulado. Onde falta o motor, o botão fica desabilitado e diz por quê. */
(function () {
  var GE = window.GE, el = GE.el;

  /* fatos Prolog gerados do JSON pelo motor (os mesmos que ele usa nas consultas) */
  GE.fatosProlog = function (caso) {
    return "% local do crime: " + caso.local_do_crime + "   |   janela do sumiço: [" + caso.janela[0] + ", " + caso.janela[1] + "]\n" + GE.M.fatosTexto(caso);
  };

  /* ---------- utilidades compartilhadas com o Laboratório ---------- */
  GE.msgErro = function (e) { return (e && e.message) ? e.message : String(e); };

  /* roda uma consulta no motor e devolve o DOM com respostas, inferências e (opcional) a prova */
  GE.rodarConsulta = function (caso, texto) {
    var w = el("div", { class: "resposta-consulta", "aria-live": "polite" });
    var r;
    try { r = caso.consultar(texto, { comProva: true, maximo: 60 }); }
    catch (e) { w.appendChild(el("p", { class: "erro-msg", text: "Não foi possível executar: " + GE.msgErro(e) })); return w; }
    var linhas = r.solucoes.map(function (s) { var k = Object.keys(s); return k.length ? k.map(function (n) { return n + " = " + s[n]; }).join(",  ") : "verdadeiro"; });
    w.appendChild(el("div", { class: "selo real", text: "calculado pelo motor" }));
    w.appendChild(el("pre", { class: "sombra-codigo", tabindex: "0", style: { maxHeight: "200px" }, text: linhas.length ? linhas.join("\n") : "falso (sem solução)" }));
    w.appendChild(el("p", { class: "nota-origem", text: r.inferencias + (r.inferencias === 1 ? " inferência" : " inferências") + " · " + r.solucoes.length + (r.solucoes.length === 1 ? " resposta" : " respostas") + (r.limite_atingido ? " · limite de profundidade atingido em algum ramo" : "") }));
    if (r.provas.length) {
      var d = el("details", { class: "bloco" }, el("summary", { style: { cursor: "pointer", fontWeight: "800", color: "var(--vinho)" }, text: "Ver a prova da primeira resposta" }));
      d.appendChild(GE.arvoreProva(r.provas[0], GE.estado.modo));
      w.appendChild(d);
    }
    return w;
  };

  function tabelaPapel(cabecalho, linhas, opts) {
    return el("div", { class: "rolagem" }, el("table", { class: "tp" },
      el("thead", null, el("tr", null, cabecalho.map(function (h) { return el("th", { scope: "col", text: h }); }))),
      el("tbody", null, linhas.map(function (l) { return el("tr", null, l.map(function (c) { return el("td", null, c); })); }))));
  }

  GE.tabelaPapel = tabelaPapel;

  /* ---------- fluxo ---------- */
  GE.docsFluxo = function (alvo) {
    GE.limpar(alvo);
    var detalhe = el("div", { class: "cartao-papel fluxo-detalhe papel", "aria-live": "polite" });
    var trilha = el("div", { class: "fluxo-trilha", role: "tablist", "aria-label": "Etapas do raciocínio" });
    var estreito = window.matchMedia("(max-width: 860px)"), atual = 0;
    /* em tela estreita os passos ficam em coluna: a explicação aparece logo abaixo do passo clicado */
    function posiciona() {
      var botoes = trilha.querySelectorAll("button");
      if (estreito.matches) { if (botoes[atual].nextSibling !== detalhe) trilha.insertBefore(detalhe, botoes[atual].nextSibling); }
      else if (detalhe.parentNode !== trilha.parentNode) trilha.parentNode.appendChild(detalhe);
    }
    function mostra(i) {
      var f = GE.FLUXO[i]; atual = i;
      [].forEach.call(trilha.querySelectorAll("button"), function (b, j) { b.setAttribute("aria-selected", String(i === j)); });
      GE.limpar(detalhe);
      detalhe.appendChild(el("div", { class: "fluxo-tit" }, GE.avatar("moraes", "g", "pensando"), el("h3", { text: i + 1 + ". " + f.nome })));
      detalhe.appendChild(el("div", { class: "duas" }, el("div", null, el("h4", { text: "Aprendiz" }), el("p", { text: f.aprendiz })), el("div", null, el("h4", { text: "Técnico" }), el("p", { text: f.tecnico }))));
      detalhe.appendChild(el("p", { style: { marginTop: "12px" } }, el("b", { text: "No jogo: " }), f.jogo, "  ", el("span", { class: "selo planejado", text: "Módulo " + f.modulo })));
      posiciona();
    }
    GE.FLUXO.forEach(function (f, i) {
      trilha.appendChild(el("button", { class: "fluxo-passo", type: "button", role: "tab", "aria-selected": "false", onclick: function () { mostra(i); } }, f.nome, el("small", { text: f.sub })));
    });
    trilha.appendChild(el("span", { class: "fluxo-dot", "aria-hidden": "true" }));
    var raiz = el("div", { class: "fluxo" }, trilha, detalhe);
    alvo.appendChild(raiz);
    if (estreito.addEventListener) estreito.addEventListener("change", posiciona);
    mostra(0);
  };

  /* ---------- demonstrações ---------- */
  var demos = {
    predicados: function () {
      var legenda = el("p", { class: "formula-leg" }), caixa = el("p", { class: "nota-origem", text: "Clique em uma linha da tabela ou em um símbolo da fórmula." });
      var leg2 = el("div", { class: "formula-leg", "aria-live": "polite", text: "Clique em um símbolo da fórmula para ver o que ele significa." });
      var linhas = GE.PREDICADOS.map(function (p) {
        var tr = el("tr", { class: "clic", tabindex: "0", onclick: function () { escolhe(); }, onkeydown: function (e) { if (e.key === "Enter") escolhe(); } },
          el("td", null, el("code", { text: p.nome + "/" + p.aridade })), el("td", { text: p.args }), el("td", null, el("span", { class: "selo " + (p.tipo === "fato" ? "real" : "planejado"), text: p.tipo })));
        function escolhe() { [].forEach.call(tr.parentNode.children, function (r) { r.removeAttribute("aria-selected"); }); tr.setAttribute("aria-selected", "true"); caixa.textContent = p.nome + ": " + p.sig + " Exemplo: " + p.exemplo + "."; }
        return tr;
      });
      var tb = el("div", { class: "rolagem" }, el("table", { class: "tp", style: { minWidth: "0" } },
        el("thead", null, el("tr", null, ["Predicado", "Argumentos", "Tipo"].map(function (h) { return el("th", { scope: "col", text: h }); }))), el("tbody", null, linhas)));
      var fm = el("div", { class: "formula", role: "group", "aria-label": "Fórmula da regra Refutado, símbolo por símbolo" });
      GE.FORMULA_REFUTADO.forEach(function (t, i) {
        if (!t.d) { fm.appendChild(document.createTextNode(" " + t.s + " ")); return; }
        var b = el("button", { class: "simb", type: "button", "aria-pressed": "false", text: t.s, onclick: function () {
          [].forEach.call(fm.querySelectorAll(".simb"), function (x) { x.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true"); leg2.textContent = t.s + ": " + t.d;
        } });
        fm.appendChild(b); fm.appendChild(document.createTextNode(" "));
      });
      return el("div", { style: { display: "grid", gap: "10px" } },
        el("h4", { text: "Vocabulário do enunciado" }), tb, caixa,
        el("h4", { text: "Regra Refutado em lógica de predicados", style: { margin: "6px 0 0" } }), fm, leg2,
        el("h4", { text: "Forma clausal da mesma regra", style: { margin: "6px 0 0" } }), el("pre", { class: "sombra-codigo", tabindex: "0", text: GE.CLAUSULA_REFUTADO }));
    },
    consultas: function () {
      var caso = GE.motor.caso(window.GE_CASOS.oficial), saida = el("div");
      var entrada = el("input", { type: "text", value: "suspeito(P)", "aria-label": "Consulta em Prolog", spellcheck: "false", style: { flex: "1 1 220px", minWidth: "0" } });
      function roda() { GE.limpar(saida); saida.appendChild(GE.rodarConsulta(caso, entrada.value)); }
      entrada.addEventListener("keydown", function (e) { if (e.key === "Enter") roda(); });
      var presets = ["distancia(hall, reserva, D)", "refutado(P, S, De, Ate)", "liberado(P)", "pode_na_janela(guarda, hall, I, F)", "suspeito(P)"];
      return el("div", { style: { display: "grid", gap: "10px" } },
        el("h4", null, "Fatos gerados do JSON do caso oficial ", el("span", { class: "selo real", text: "geração real" })),
        el("pre", { class: "sombra-codigo", tabindex: "0", style: { maxHeight: "230px" }, text: GE.fatosProlog(window.GE_CASOS.oficial) }),
        el("h4", { text: "Consultas" }),
        el("div", { class: "cano" }, presets.map(function (t) { return el("button", { type: "button", text: "?- " + t, onclick: function () { entrada.value = t; roda(); } }); })),
        el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, entrada, el("button", { class: "botao", type: "button", text: "Consultar", onclick: roda })),
        saida);
    },
    stepper: function () {
      var caso = GE.motor.caso(window.GE_CASOS.oficial), M = GE.M;
      /* ---- unificação ao vivo ---- */
      function porque(a, b, s) {
        a = M.caminhar(a, s); b = M.caminhar(b, s);
        if (M.ehVar(a) && M.ehVar(b) && a === b) return null;
        if (M.ehVar(b) && !M.ehVar(a)) { var t = a; a = b; b = t; }
        if (M.ehVar(a)) return M.ocorre(a, b, s) ? "verificação de ocorrência: " + M.formatar(a) + " aparece dentro de " + M.formatar(b, s) + ", e ligar as duas criaria um termo infinito" : null;
        if (M.ehComp(a) && M.ehComp(b)) {
          if (a.f !== b.f || a.args.length !== b.args.length) return "functores ou aridades diferentes: " + a.f + "/" + a.args.length + " e " + b.f + "/" + b.args.length;
          for (var i = 0; i < a.args.length; i++) { var m = porque(a.args[i], b.args[i], s); if (m) return m; var s2 = M.unificar(a.args[i], b.args[i], s); if (!s2) return "argumento " + (i + 1) + " não unifica"; s = s2; }
          return null;
        }
        return "constantes diferentes: " + M.formatar(a) + " e " + M.formatar(b);
      }
      var u1 = el("input", { type: "text", value: "registro(guarda, S, T)", "aria-label": "Primeiro termo", spellcheck: "false" });
      var u2 = el("input", { type: "text", value: "registro(guarda, cafe, 5)", "aria-label": "Segundo termo", spellcheck: "false" });
      var uOut = el("div", { class: "resposta-consulta", "aria-live": "polite" });
      function unifica() {
        GE.limpar(uOut);
        try {
          var par = M.lerTermo("(" + u1.value + ") = (" + u2.value + ")")[0];
          var s = M.unificar(par.args[0], par.args[1], new Map());
          if (s) {
            var pares = []; s.forEach(function (v, k) { pares.push(k.nome + "/" + M.formatar(M.aplicar(v, s))); });
            uOut.appendChild(el("p", null, el("b", { text: "Unificam. " }), "θ = { " + pares.join(", ") + " }"));
            uOut.appendChild(el("p", { class: "nota-origem", text: "Resultado: " + M.formatar(M.aplicar(par.args[0], s)) }));
          } else uOut.appendChild(el("p", null, el("b", { text: "Não unificam. " }), porque(par.args[0], par.args[1], new Map()) || "os termos não se igualam."));
        } catch (e) { uOut.appendChild(el("p", { class: "erro-msg", text: "Não consegui ler os termos: " + GE.msgErro(e) })); }
      }
      var presetU = [["registro(guarda, S, T)", "registro(guarda, cafe, 5)"], ["f(X, g(X))", "f(Y, Y)"], ["X", "f(X)"], ["[H|T]", "[1, 2, 3]"], ["registro(P, S, 20)", "depoimento(guarda, cafe, 5, 40)"]];
      /* ---- passo a passo da resolução SLD ---- */
      var consultas = ["refutado(guarda, S, De, Ate)", "distancia(hall, galeria, D)", "liberado(faxineiro)", "refutado(faxineiro, S, De, Ate)"];
      var passos = [], pos = 0, painel = el("div", { class: "cartao-papel papel", "aria-live": "polite" }), cab = el("p", { class: "nota-origem" });
      function preordem(n, prof, acc) { acc.push({ n: n, prof: prof }); n.filhos.forEach(function (f) { preordem(f, prof + 1, acc); }); return acc; }
      function carrega(q) {
        var p = caso.prova(q); passos = []; pos = 0;
        if (p.provado) p.arvore.forEach(function (n) { preordem(n, 0, passos); });
        cab.textContent = p.provado ? "Consulta: ?- " + q + " · " + p.inferencias + " inferências no total · " + passos.length + " nós na árvore de prova." : "Consulta: ?- " + q + " · sem prova (falha). " + p.inferencias + " inferências tentadas.";
        mostra();
      }
      function mostra() {
        GE.limpar(painel);
        if (!passos.length) { painel.appendChild(el("p", { text: "O motor não achou prova para esta consulta: nenhuma regra ou fato a sustenta." })); return; }
        var p = passos[pos], n = p.n, u = Object.keys(n.unificador).map(function (k) { return k + "/" + n.unificador[k]; }).join(", ");
        painel.appendChild(el("p", { class: "nota-origem", text: "Passo " + (pos + 1) + " de " + passos.length + " · profundidade " + p.prof }));
        painel.appendChild(GE.blocoCodigo("Objetivo provado", n.objetivo));
        painel.appendChild(el("p", null, el("b", { text: n.tipo === "regra" ? "Regra escolhida: " : n.tipo === "fato" ? "Fato da base" : "Conta embutida: " }), n.tipo === "regra" ? el("code", { text: n.regra }) : n.tipo === "embutido" ? n.regra.replace("embutido: ", "") : ""));
        if (u) painel.appendChild(el("p", null, el("b", { text: "Unificador: " }), "θ = { " + u + " }"));
        painel.appendChild(el("p", null, el("b", { text: "Subobjetivos: " }), n.filhos.length ? n.filhos.map(function (f) { return f.objetivo; }).join(";  ") : "nenhum (este passo fecha o ramo)"));
        ant.disabled = pos === 0; prox.disabled = pos >= passos.length - 1;
      }
      var ant = el("button", { type: "button", "aria-label": "Passo anterior", text: "◀", onclick: function () { if (pos > 0) { pos--; mostra(); } } });
      var prox = el("button", { type: "button", text: "Próximo passo ▶", onclick: function () { if (pos < passos.length - 1) { pos++; mostra(); } } });
      var sel = el("select", { "aria-label": "Consulta", onchange: function () { carrega(sel.value); } }, consultas.map(function (q) { return el("option", { value: q, text: "?- " + q }); }));
      var tela = el("div", { style: { display: "grid", gap: "10px" } },
        el("h4", null, "Unificação ao vivo ", el("span", { class: "selo real", text: "motor M3" })),
        el("div", { class: "cano" }, presetU.map(function (p) { return el("button", { type: "button", text: p[0] + " = " + p[1], onclick: function () { u1.value = p[0]; u2.value = p[1]; unifica(); } }); })),
        el("div", { style: { display: "grid", gap: "6px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" } }, u1, u2),
        el("button", { class: "botao", type: "button", text: "Unificar", onclick: unifica, style: { justifySelf: "start" } }), uOut,
        el("h4", { text: "Resolução SLD, passo a passo", style: { margin: "8px 0 0" } }),
        sel, cab,
        el("div", { class: "passo-a-passo", role: "group", "aria-label": "Controles do passo a passo" }, ant, prox, el("button", { type: "button", text: "Reiniciar", onclick: function () { pos = 0; mostra(); } })),
        painel);
      unifica(); carrega(consultas[0]);
      return tela;
    },
    sat: function () {
      var leg = el("div", { class: "cano-leg", "aria-live": "polite", text: GE.PIPELINE_SAT[0].d });
      var cano = el("div", { class: "cano", role: "group", "aria-label": "Etapas da camada SAT" });
      GE.PIPELINE_SAT.forEach(function (e, i) {
        if (i) cano.appendChild(el("i", { text: "→", "aria-hidden": "true" }));
        var b = el("button", { type: "button", "aria-pressed": String(i === 0), text: e.nome, onclick: function () { [].forEach.call(cano.querySelectorAll("button"), function (x) { x.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true"); leg.textContent = e.d; } });
        cano.appendChild(b);
      });
      var dados = JSON.parse(JSON.stringify(window.GE_CASOS.oficial)), SAT = GE.M.SAT, saida = el("div", { "aria-live": "polite" });
      var pessoas = GE.M.pessoasDo(dados), salas = GE.M.salasDo(dados);
      var selP = el("select", { "aria-label": "Pessoa" }, pessoas.map(function (p) { return el("option", { value: p, text: p }); }));
      var selS = el("select", { "aria-label": "Sala" }, salas.map(function (s) { return el("option", { value: s, text: s }); }));
      var minuto = el("input", { type: "number", value: "20", min: "0", max: "60", "aria-label": "Minuto", style: { width: "5em" } });
      var comDep = el("input", { type: "checkbox", id: "sat-dep" });
      function mostrar(titulo, filhos) { GE.limpar(saida); saida.appendChild(el("div", { class: "resposta-consulta" }, el("div", { class: "selo real", text: "calculado pelo DPLL próprio" }), el("h5", { text: titulo, style: { margin: "6px 0" } }), filhos)); }
      function tratar(fn) { return function () { try { fn(); } catch (e) { mostrar("Erro", el("p", { class: "erro-msg", text: GE.msgErro(e) })); } }; }
      var bConsist = tratar(function () {
        var r = SAT.consistencia(dados, selP.value, comDep.checked);
        var c = el("div");
        c.appendChild(el("p", null, el("b", { text: r.sat ? "SAT: existe um trajeto possível. " : "UNSAT: não existe trajeto. " }), r.variaveis + " variáveis, " + r.clausulas + " cláusulas · " + r.stats.decisoes + " decisões, " + r.stats.propagacoes + " propagações, " + r.stats.conflitos + " conflitos."));
        if (r.sat) c.appendChild(GE.blocoCodigo("Um trajeto que satisfaz tudo (sala: minutos)", r.trajetoria.map(function (t) { return t[0] + ": " + t[1] + "–" + t[2]; }).join("\n")));
        else c.appendChild(el("p", null, el("b", { text: "Núcleo mínimo do conflito: " }), r.nucleo.join("  +  ")));
        mostrar("Consistência de " + selP.value, c);
      });
      var bPode = tratar(function () {
        var d = dados, m = SAT.intervalos(SAT.minutosPossiveis(d, selP.value, d.local_do_crime, d.janela[0], d.janela[1], comDep.checked));
        mostrar(selP.value + " no local do crime durante a janela", el("p", { text: m.length ? "Pode ter estado em " + d.local_do_crime + " nos minutos " + m.map(function (x) { return x[0] + "–" + x[1]; }).join(", ") + "." : "Não há modelo com a pessoa em " + d.local_do_crime + " durante a janela." }));
      });
      var bCons = tratar(function () {
        var r = SAT.consequencia(dados, selP.value, selS.value, +minuto.value, comDep.checked);
        var txt = { necessario: "É consequência: em todo modelo, " + selP.value + " está em " + selS.value + " no minuto " + minuto.value + ".", possivel: "Possível, mas não necessário: há modelos com e sem isso.", impossivel: "Impossível: nenhum modelo tem " + selP.value + " em " + selS.value + " no minuto " + minuto.value + ".", inconsistente: "A entrada desta pessoa é inconsistente, então nada se conclui." }[r.resposta];
        mostrar("Consequência por refutação", el("div", null, el("p", { text: txt }), r.refutacao ? el("p", { class: "nota-origem", text: "Motivo: " + r.refutacao }) : null));
      });
      var bConta = tratar(function () {
        var d = dados, r = SAT.contarPadroes(d, selP.value, d.local_do_crime, d.janela[0], d.janela[1], 2000);
        mostrar("Contagem projetada", el("p", { text: (r.truncado ? "Pelo menos " : "") + r.total + " padrão(ões) distinto(s) de presença de " + selP.value + " em " + d.local_do_crime + " nos minutos " + d.janela[0] + "–" + d.janela[1] + (r.truncado ? " (a contagem parou no teto de 2000)." : ".") }));
      });
      var bDim = tratar(function () {
        var t = new SAT.Codificacao(dados, selP.value).dimacs(), ls = t.split("\n");
        var ta = el("textarea", { readonly: "", rows: "10", "aria-label": "DIMACS", style: { width: "100%", fontFamily: "monospace", fontSize: ".8rem" } }); ta.value = ls.slice(0, 40).join("\n") + "\n… (" + ls.length + " linhas no total)";
        mostrar("CNF em DIMACS de " + selP.value, el("div", null, ta, el("p", { class: "nota-origem", text: "Para o arquivo completo use: python main.py --entrada casos/oficial.json --pergunta dimacs --pessoa " + selP.value + " --saida " + selP.value + ".cnf" })));
      });
      var todos = SAT.consistencia(dados, pessoas[0]);
      return el("div", { style: { display: "grid", gap: "10px" } }, cano, leg,
        el("h4", null, "Pergunte ao DPLL (caso oficial) ", el("span", { class: "selo real", text: "motor M4" })),
        el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" } }, el("label", null, "Pessoa ", selP), el("label", null, "Sala ", selS), el("label", null, "Minuto ", minuto),
          el("label", { style: { display: "inline-flex", gap: "4px", alignItems: "center" } }, comDep, "incluir depoimentos")),
        el("div", { class: "cano" },
          el("button", { type: "button", text: "Os registros são consistentes?", onclick: bConsist }),
          el("button", { type: "button", text: "Pode estar no local do crime?", onclick: bPode }),
          el("button", { type: "button", text: "É consequência? (refutação)", onclick: bCons }),
          el("button", { type: "button", text: "Contar padrões", onclick: bConta }),
          el("button", { type: "button", text: "Mostrar DIMACS", onclick: bDim })),
        saida);
    },
    fluxo: function () {
      var leg = el("div", { class: "cano-leg", "aria-live": "polite", text: GE.FLUXO_M5[0].d });
      var cano = el("div", { class: "cano", role: "group", "aria-label": "Fluxo da interface até a explicação" });
      GE.FLUXO_M5.forEach(function (e, i) {
        if (i) cano.appendChild(el("i", { text: "→", "aria-hidden": "true" }));
        var b = el("button", { type: "button", "aria-pressed": String(i === 0), text: e.nome, onclick: function () { [].forEach.call(cano.querySelectorAll("button"), function (x) { x.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true"); leg.textContent = e.d; } });
        cano.appendChild(b);
      });
      var cli = window.GE_CLI, extra = el("div");
      if (cli && cli.saidas && cli.saidas.length) {
        var cmd = el("pre", { class: "sombra-codigo", tabindex: "0" }), out = el("pre", { class: "sombra-codigo", tabindex: "0", style: { maxHeight: "300px" } });
        var sel = el("select", { "aria-label": "Comando da CLI", onchange: function () { mostra(+sel.value); } }, cli.saidas.map(function (s, i) { return el("option", { value: String(i), text: s.comando.replace("python main.py ", "").replace("--entrada ", "").replace("--pergunta ", "") }); }));
        var mostra = function (i) { cmd.textContent = "$ " + cli.saidas[i].comando; out.textContent = cli.saidas[i].saida; };
        mostra(0);
        extra.appendChild(el("h4", null, "Saídas da linha de comando ", el("span", { class: "selo real", text: "saída gravada" })));
        extra.appendChild(sel); extra.appendChild(cmd); extra.appendChild(out);
        extra.appendChild(el("p", { class: "nota-origem", text: "Gravado em " + cli.quando + ", executando main.py com Python " + cli.python + " (tools/gerar_saidas_cli.py). A página não executa Python: ela mostra o que a CLI imprimiu nessa execução." }));
      } else extra.appendChild(el("p", { class: "estado-vazio" }, el("b", { text: "Sem saídas gravadas." }), "Rode tools/gerar_saidas_cli.py para gerar data/saidas-cli.js."));
      return el("div", { style: { display: "grid", gap: "10px" } }, cano, leg, extra);
    },
    testes: function () {
      var T = window.GE_TESTES, caixa = el("div", { style: { display: "grid", gap: "10px" } });
      function resultado(t) {
        if (!T) return ["pendente", "Não executado"];
        var m = T.casos.filter(function (c) { return c.nome.indexOf(t.teste) === 0 || c.nome === t.teste; });
        if (!m.length) return ["pendente", "Não executado"];
        if (m.some(function (c) { return c.estado === "falhou"; })) return ["falhou", "Falhou"];
        var pulados = m.filter(function (c) { return c.estado === "pulado"; });
        if (pulados.length === m.length) return ["pendente", "Não executado: " + (pulados[0].motivo || "pulado")];
        return ["real", "Passou" + (m.length > 1 ? " (" + m.length + ")" : "")];
      }
      if (T) {
        caixa.appendChild(el("div", { class: "resumo-testes" }, el("b", { text: String(T.passaram) }), el("span", { text: "testes passaram de " + T.total + " · " + T.falharam + " falharam · " + T.pulados + " não executados" }),
          el("span", { class: "res-nao", text: T.pulados ? "Há testes não executados" : "Tudo executado" })));
        caixa.appendChild(el("p", { class: "nota-origem", text: "Execução de " + T.quando + " com Python " + T.python + ". Comando: " + T.comando + " (tools/exportar_testes.py grava este resultado)." }));
      } else caixa.appendChild(el("div", { class: "resumo-testes" }, el("b", { text: "0" }), el("span", { text: "testes executados" }), el("span", { class: "res-nao", text: "Não executado" })));
      caixa.appendChild(tabelaPapel(["Grupo", "Teste", "Resultado esperado", "Resultado"], GE.TESTES.map(function (t) {
        var r = resultado(t);
        return [t.grupo, t.nome, t.esperado, el("span", { class: "selo " + r[0], text: r[1] })];
      })));
      /* conferência ao vivo, no navegador, com o motor JS */
      var vivo = el("div");
      function conferir() {
        GE.limpar(vivo);
        var c = GE.motor.caso(window.GE_CASOS.oficial), sem = GE.motor.caso(window.GE_CASOS["sem-registro-guarda"]);
        var j = function (x) { return JSON.stringify(x); };
        var checks = [
          ["distancia(hall, reserva) = 6", c.distancia("hall", "reserva") === 6],
          ["distancia(galeria, cafe) = 5", c.distancia("galeria", "cafe") === 5],
          ["distancia(cafe, reserva) = 6", c.distancia("cafe", "reserva") === 6],
          ["guarda pode estar no hall em [14,18] e [22,30]", j(c.janelas("guarda", "hall")) === "[[14,18],[22,30]]"],
          ["curadora não chega ao hall na janela", c.janelas("curadora", "hall").length === 0],
          ["só o depoimento do guarda é refutado", j(c.refutados()) === '[["guarda","cafe",5,40]]'],
          ["suspeito final = guarda", j(c.suspeitos()) === '["guarda"]'],
          ["sem o registro do guarda às 21h20: nenhum refutado e nenhum suspeito", sem.refutados().length === 0 && sem.suspeitos().length === 0],
          ["SAT concorda com o SLD no caso oficial", j(c.satSuspeitos()) === j(c.suspeitos())]
        ];
        vivo.appendChild(el("ul", { class: "checks" }, checks.map(function (k) { return el("li", null, el("span", { class: "selo " + (k[1] ? "real" : "falhou"), text: k[1] ? "ok" : "falhou" }), " " + k[0]); })));
        vivo.appendChild(el("p", { class: "nota-origem", text: "Executado agora, no seu navegador, pelo motor em JavaScript." }));
      }
      caixa.appendChild(el("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" } }, el("button", { class: "botao", type: "button", text: "Conferir a aceitação agora, no navegador", onclick: conferir })));
      caixa.appendChild(vivo);
      if (T) {
        var porArq = {};
        T.casos.forEach(function (c) { (porArq[c.arquivo] = porArq[c.arquivo] || []).push(c); });
        caixa.appendChild(el("details", { class: "bloco" }, el("summary", { style: { cursor: "pointer", fontWeight: "800", color: "var(--vinho)" }, text: "Lista completa dos " + T.total + " testes" }),
          Object.keys(porArq).map(function (a) {
            var l = porArq[a];
            return el("div", null, el("h5", { text: a + " (" + l.length + ")", style: { margin: "8px 0 2px" } }), el("ul", { class: "checks" }, l.map(function (c) {
              return el("li", null, el("span", { class: "selo " + (c.estado === "passou" ? "real" : c.estado === "falhou" ? "falhou" : "pendente"), text: c.estado === "passou" ? "passou" : c.estado === "falhou" ? "falhou" : "não executado" }), " " + c.nome, c.motivo && c.estado === "pulado" ? el("small", { text: " — " + c.motivo }) : null);
            })));
          })));
      }
      return caixa;
    }
  };

  GE.docsModulos = function (alvo) {
    GE.limpar(alvo);
    var lista = el("div", { class: "modulos" });
    GE.MODULOS.forEach(function (m, idx) {
      var d = el("details", { class: "modulo papel", id: "modulo-" + m.id.toLowerCase() });
      d.appendChild(el("summary", null, el("span", { class: "sigla", text: m.id }), el("span", null, el("span", { class: "tit", text: m.titulo }), el("span", { class: "res", text: m.resumo })), el("span", { class: "selo real", text: "Implementado" }), el("span", { class: "seta", "aria-hidden": "true" })));
      var corpoM = el("div", { class: "modulo-corpo" });
      var esq = el("div", { class: "col" }), dir = el("div", { class: "col" });
      esq.appendChild(el("section", null, el("h4", { text: "Objetivo" }), el("p", { text: m.objetivo }), el("ul", { class: "topicos" }, m.topicos.map(function (t) { return el("li", { text: t }); }))));
      esq.appendChild(el("section", null, el("h4", { text: "Fundamentação teórica" }), el("ul", null, m.fundamentacao.map(function (f) { return el("li", { text: f }); }))));
      esq.appendChild(el("section", null, el("h4", { text: "Implementação" }), el("p", { text: m.implementacao })));
      esq.appendChild(el("section", null, el("h4", { text: "Exemplo no contexto do museu" }), el("p", { text: m.exemplo })));
      dir.appendChild(el("section", null, el("h4", { text: "Demonstração" }), m.demo && demos[m.demo] ? demos[m.demo]() : null));
      dir.appendChild(el("section", null, el("h4", { text: "Código" }), el("p", { class: "caixa tracejada" }, el("b", { text: "Arquivos: " }), el("code", { text: m.arquivos }))));
      dir.appendChild(el("section", null, el("h4", { text: "Resultado" }), el("p", { class: "caixa", text: m.resultado })));
      corpoM.appendChild(esq); corpoM.appendChild(dir); d.appendChild(corpoM); lista.appendChild(d);
    });
    var linha = el("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" } },
      el("button", { class: "botao secundario", type: "button", text: "Abrir todos", onclick: function () { [].forEach.call(lista.children, function (d) { d.open = true; }); } }),
      el("button", { class: "botao secundario", type: "button", text: "Fechar todos", onclick: function () { [].forEach.call(lista.children, function (d) { d.open = false; }); } }));
    alvo.appendChild(linha); alvo.appendChild(lista);
    if (location.hash.indexOf("modulo-") === 1) { var t = document.getElementById(location.hash.slice(1)); if (t) t.open = true; }
    lista.firstChild.open = true;
  };

  /* ---------- sobre ---------- */
  GE.docsSobre = function (alvo) {
    GE.limpar(alvo);
    var nomes = { oficial: "Caso oficial do enunciado", "sem-registro-guarda": "Sem o registro do guarda às 21h20" };
    var proprios = Object.keys(window.GE_CASOS);
    function linha(id) {
      var c = GE.motor.caso(window.GE_CASOS[id]), s = c.analise().suspeitos, sat = c.satSuspeitos();
      return [nomes[id] || id, s.length ? s.join(", ") : "ninguém", sat.join() === s.join() ? "sim" : "NÃO"];
    }
    var aceit = ["oficial", "sem-registro-guarda"].map(linha);
    var outros = proprios.filter(function (i) { return !nomes[i]; }).map(linha);
    alvo.appendChild(el("div", { class: "sobre-grade" },
      el("article", { class: "cartao-papel papel" }, el("h3", { text: "Sobre o trabalho" }),
        el("ul", null,
          el("li", { text: "Lógica para Computação, IFC São Bento do Sul. Profa. Wilcilene Kowal." }),
          el("li", { text: "Estudantes: Larissa Gabriel e Isabel Shiffler." }),
          el("li", { text: "Contexto 2: a linha do tempo do museu. Motor de inferência em Python (SLD com unificação e SAT com DPLL), com linha de comando e testes. O site roda um port em JavaScript do mesmo motor." }),
          el("li", null, el("a", { href: GE.ENUNCIADO_URL, target: "_blank", rel: "noopener", text: "Enunciado oficial do trabalho" })))),
      el("article", { class: "cartao-papel papel" }, el("h3", { text: "Decisões de projeto" }),
        el("ul", null,
          el("li", { text: "Regras em um texto único (motor/base.py), exportado para Prolog e para o JavaScript." }),
          el("li", { text: "SAT: variáveis x(pessoa, sala, minuto) mais uma sala fictícia 'transito'; uma CNF por pessoa." }),
          el("li", { text: "Quem tem registros que se contradizem é 'inconsistente' e não entra como suspeito." }),
          el("li", { text: "Quem não tem nenhum registro pode estar em qualquer sala." }),
          el("li", { text: "'Liberado': depoimento não refutado que cobre a janela inteira em outra sala. É uma regra de confiança, não prova de inocência." }))),
      el("article", { class: "cartao-papel papel" }, el("h3", { text: "Limitações conhecidas" }),
        el("ul", null,
          el("li", { text: "Prolog: as regras estão exportadas em prolog/*.pl (com o meta-interpretador prova.pl), mas a conferência com o SWI-Prolog não foi executada: ele não estava instalado." }),
          el("li", { text: "O site usa o port em JavaScript; a paridade com o Python é testada em tests/test_paridade_js.py." }),
          el("li", { text: "O SLD corta objetivos que são variantes de um ancestral. Garante término, mas pode perder respostas de regras recursivas à esquerda; as regras do museu não dependem disso." }),
          el("li", { text: "O final da história (a Estrela volta sozinha) é narrativa; a conclusão lógica é só a do painel." })))));
    alvo.appendChild(el("div", { class: "sobre-grade", style: { marginTop: "20px" } },
      el("article", { class: "cartao-papel papel", style: { gridColumn: "1 / -1" } },
        el("h3", null, "Resultados dos casos de aceitação ", el("span", { class: "selo real", text: "calculado agora pelo motor" })),
        GE.tabelaPapel(["Caso", "Suspeito(s)", "SAT concorda?"], aceit),
        el("h3", { style: { marginTop: "14px" } }, "Casos próprios (" + outros.length + ")"),
        GE.tabelaPapel(["Caso", "Suspeito(s)", "SAT concorda?"], outros))));
  };
})();
