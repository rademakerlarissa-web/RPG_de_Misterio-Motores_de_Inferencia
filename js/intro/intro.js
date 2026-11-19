/* intro.js — "Antes de investigar": seis lições curtas e interativas sobre a lógica do trabalho.
   Todo resultado mostrado vem do motor (SLD e DPLL, js/motor/*) rodando sobre o caso do jogo.
   O jogo só aparece depois: GE.intro.liberarJogo() é chamado pelo botão da última lição. */
(function () {
  var GE = window.GE, el = GE.el, M = GE.M;
  var PESSOAS = { guarda: "guarda (Seu Barros)", curadora: "curadora (Dra. Íris)", faxineiro: "faxineiro (Tião)", visitante: "visitante (Luiza)" };
  var rotuloPessoa = function (p) { return PESSOAS[p] || p; };
  var caso = function () { return GE.motor.caso(window.GE_CASOS.oficial); };
  var selo = function () { return el("span", { class: "selo real", text: "calculado pelo motor" }); };
  var erro = function (e) { return el("p", { class: "erro-msg", text: "Não foi possível: " + GE.msgErro(e) }); };

  function botoes(lista, aoClicar, inicial) {
    var cx = el("div", { class: "cano", role: "group" });
    lista.forEach(function (t, i) {
      var b = el("button", { type: "button", "aria-pressed": "false", text: t.rotulo, onclick: function () {
        [].forEach.call(cx.children, function (x) { x.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true"); aoClicar(t, i);
      } });
      cx.appendChild(b);
    });
    return cx;
  }
  function campoSel(rotulo, opcoes, valor, aoMudar) {
    var s = el("select", { "aria-label": rotulo, onchange: function () { aoMudar(s.value); } }, opcoes.map(function (o) { return el("option", { value: o[0], text: o[1] }); }));
    s.value = valor; return el("label", { class: "campo-intro" }, el("span", { text: rotulo }), s);
  }
  /* escolha de pessoa por retrato: um cartão por personagem */
  function seletorPessoa(rotulo, valor, aoMudar) {
    var cx = el("div", { class: "pessoas-sel", role: "radiogroup", "aria-label": rotulo });
    Object.keys(PESSOAS).forEach(function (k) {
      var c = GE.PERSONAGEM[k], b = el("button", { type: "button", role: "radio", "aria-checked": String(k === valor), "data-p": k, onclick: function () {
        [].forEach.call(cx.children, function (x) { x.setAttribute("aria-checked", String(x === b)); }); aoMudar(k);
      } }, GE.avatar(k, "g"), el("span", { class: "nome", text: c.nome }), el("span", { class: "papel", text: c.papel }));
      cx.appendChild(b);
    });
    cx.escolher = function (k) { [].forEach.call(cx.children, function (x) { x.setAttribute("aria-checked", String(x.getAttribute("data-p") === k)); }); };
    return el("div", { class: "campo-intro" }, el("span", { text: rotulo }), cx);
  }
  /* salas como botões em forma de pílula */
  function seletorSala(valor, aoMudar) {
    var cx = el("div", { class: "salas-sel", role: "radiogroup", "aria-label": "Sala" });
    ["hall", "galeria", "cafe", "reserva"].forEach(function (k) {
      var b = el("button", { type: "button", role: "radio", "aria-checked": String(k === valor), text: GE.nomeSala(k), style: { "--cor": GE.corSala(k) }, onclick: function () {
        [].forEach.call(cx.children, function (x) { x.setAttribute("aria-checked", String(x === b)); }); aoMudar(k);
      } });
      cx.appendChild(b);
    });
    return el("div", { class: "campo-intro" }, el("span", { text: "Sala" }), cx);
  }
  /* apresentador: o Detetive Moraes introduz a lição */
  function moraes(frase) {
    return el("div", { class: "moraes-fala" }, GE.avatar("moraes", "g", "pensando"), el("p", null, el("b", { text: "Detetive Moraes: " }), frase));
  }
  function regra(nome) { var m = GE.M.REGRAS.split("\n").filter(function (l) { return l.indexOf(nome + "(") === 0; }); return m.join("\n"); }

  /* ---------------- lição 1: fatos ---------------- */
  function licaoFatos() {
    var saida = el("div", { "aria-live": "polite" }), est = { p: "guarda", s: "cafe", t: "5" };
    var minutos = [0, 5, 10, 13, 20, 25, 31, 35, 40].map(function (m) { return [String(m), GE.hora(m)]; });
    function atualiza() {
      GE.limpar(saida);
      var fato = "registro(" + est.p + ", " + est.s + ", " + est.t + ")", r;
      try { r = caso().consultar(fato, { maximo: 1 }); } catch (e) { saida.appendChild(erro(e)); return; }
      saida.appendChild(el("div", { class: "resposta-consulta" }, selo(),
        GE.blocoCodigo("Seu fato", fato + "."),
        el("p", null, el("b", { text: r.solucoes.length ? "Está no livro. " : "Não está no livro. " }),
          r.solucoes.length ? "O motor encontra esse fato na base, então a consulta responde verdadeiro." : "Nenhuma linha do livro diz isso. Para o motor, o que não está na base e não pode ser provado é falso.")));
    }
    return {
      moraes: "Toda investigação começa pelo que está anotado. Vamos ver o livro de registros do museu.",
      titulo: "Fatos: o que está escrito no livro",
      texto: [
        "Tudo começa com fatos: coisas que alguém escreveu e que tomamos como verdadeiras. No museu, os fatos são as linhas do livro de registros (quem estava em qual sala, em que minuto), os corredores entre as salas e o horário em que a Estrela sumiu.",
        "Em Prolog, um fato é uma frase curta com um nome e argumentos: registro(guarda, cafe, 5). Os minutos contam a partir das 21h, então 5 é 21h05."],
      fazer: el("div", { class: "exp" }, el("h4", { text: "Monte um fato e pergunte ao motor se ele está no livro" }),
        el("div", { class: "linha-campos" },
          seletorPessoa("Pessoa", est.p, function (v) { est.p = v; atualiza(); }),
          seletorSala(est.s, function (v) { est.s = v; atualiza(); }),
          campoSel("Minuto (horário)", minutos, est.t, function (v) { est.t = v; atualiza(); })),
        saida),
      iniciar: atualiza
    };
  }

  function cartoesDepoimento(deps, aoEscolher) {
    var cx = el("div", { class: "dep-cards", role: "group", "aria-label": "Depoimentos" });
    deps.forEach(function (d) {
      var c = GE.PERSONAGEM[d[0]], b = el("button", { type: "button", "aria-pressed": "false", onclick: function () {
        [].forEach.call(cx.children, function (x) { x.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true"); aoEscolher(d);
      } }, GE.avatar(d[0], "g"), el("span", { class: "nome", text: c.nome }),
        el("span", { class: "fala", text: "\"Eu estava no " + GE.nomeSala(d[1]) + " das " + GE.hora(d[2]) + " às " + GE.hora(d[3]) + ".\"" }));
      cx.appendChild(b);
    });
    return cx;
  }

  /* ---------------- lição 2: regras ---------------- */
  function licaoRegras() {
    var saida = el("div", { "aria-live": "polite" });
    var deps = window.GE_CASOS.oficial.depoimentos;
    function testa(d) {
      GE.limpar(saida);
      var c = caso(), q = "refutado(" + d[0] + ", " + d[1] + ", " + d[2] + ", " + d[3] + ")", r;
      try {
        r = c.consultar(q, { maximo: 1 });
        var ach = c.consultar("registro(" + d[0] + ", S2, T), S2 \\= " + d[1] + ", " + d[2] + " =< T, T =< " + d[3], { maximo: 1 });
        var corpo = [selo(), GE.blocoCodigo("Pergunta ao motor", "?- " + q + ".")];
        if (r.solucoes.length) {
          var x = ach.solucoes[0];
          corpo.push(el("p", null, el("b", { text: "Refutado. " }), "O livro registra " + rotuloPessoa(d[0]) + " em " + GE.nomeSala(x.S2) + " às " + GE.hora(+x.T) + ", dentro do intervalo do depoimento, e a sala é outra. Dois fatos que não cabem juntos."));
        } else corpo.push(el("p", null, el("b", { text: "Não refutado. " }), "Nenhum registro do livro contradiz esse depoimento. Isso não prova que ele é verdadeiro: só que nada o desmente."));
        saida.appendChild(el("div", { class: "resposta-consulta" }, corpo));
      } catch (e) { saida.appendChild(erro(e)); }
    }
    return {
      moraes: "Um depoimento só vale até alguém provar o contrário. Esta regra faz essa conferência.",
      titulo: "Regras: como um fato leva a outro",
      texto: [
        "Uma regra diz: se tais coisas valem, então isto também vale. Ela é escrita uma vez e serve para qualquer pessoa, sala ou horário, porque usa variáveis (letras maiúsculas como P, S, T).",
        "A regra abaixo é a que desmente depoimentos. Lida em voz alta: P é refutado ao dizer que estava em S entre De e Ate se existe um registro de P em outra sala S2, num minuto T dentro desse intervalo."],
      codigo: regra("refutado"),
      fazer: el("div", { class: "exp" }, el("h4", { text: "Escolha um depoimento e veja a regra em ação" }),
        cartoesDepoimento(deps, testa), saida),
      iniciar: function () { saida.appendChild(el("p", { class: "nota-origem", text: "Clique em um depoimento." })); }
    };
  }

  /* ---------------- lição 3: unificação ---------------- */
  function licaoUnificacao() {
    var a = el("input", { type: "text", value: "registro(guarda, S, T)", "aria-label": "Primeiro termo", spellcheck: "false" });
    var b = el("input", { type: "text", value: "registro(guarda, cafe, 5)", "aria-label": "Segundo termo", spellcheck: "false" });
    var saida = el("div", { "aria-live": "polite" });
    function motivo(x, y, s) {
      x = M.caminhar(x, s); y = M.caminhar(y, s);
      if (M.ehVar(y) && !M.ehVar(x)) { var t = x; x = y; y = t; }
      if (M.ehVar(x)) return M.ocorre(x, y, s) ? M.formatar(x) + " apareceria dentro de " + M.formatar(y, s) + ", criando um termo sem fim (verificação de ocorrência)" : null;
      if (M.ehComp(x) && M.ehComp(y)) {
        if (x.f !== y.f || x.args.length !== y.args.length) return "os nomes ou o número de argumentos diferem: " + x.f + "/" + x.args.length + " e " + y.f + "/" + y.args.length;
        for (var i = 0; i < x.args.length; i++) { var m = motivo(x.args[i], y.args[i], s); if (m) return m; var s2 = M.unificar(x.args[i], y.args[i], s); if (!s2) return "o argumento " + (i + 1) + " não combina"; s = s2; }
        return null;
      }
      return "são coisas diferentes: " + M.formatar(x) + " e " + M.formatar(y);
    }
    function roda() {
      GE.limpar(saida);
      try {
        var par = M.lerTermo("(" + a.value + ") = (" + b.value + ")")[0], s = M.unificar(par.args[0], par.args[1], new Map());
        if (s) {
          var l = []; s.forEach(function (v, k) { l.push(k.nome + " = " + M.formatar(M.aplicar(v, s))); });
          saida.appendChild(el("div", { class: "resposta-consulta" }, selo(), el("p", null, el("b", { text: "Combinam. " }), l.length ? "Para igualar, o motor faz: " + l.join(", ") + "." : "Já são iguais, não precisa trocar nada."),
            el("p", { class: "nota-origem", text: "Os dois ficam assim: " + M.formatar(M.aplicar(par.args[0], s)) })));
        } else saida.appendChild(el("div", { class: "resposta-consulta" }, selo(), el("p", null, el("b", { text: "Não combinam: " }), motivo(par.args[0], par.args[1], new Map()) || "os termos não se igualam.")));
      } catch (e) { saida.appendChild(erro(e)); }
    }
    var pres = [["registro(guarda, S, T)", "registro(guarda, cafe, 5)"], ["registro(P, galeria, T)", "registro(curadora, S, 13)"], ["registro(guarda, cafe, 5)", "registro(guarda, galeria, 20)"], ["X", "f(X)"]];
    return {
      moraes: "Perguntar é tentar encaixar a dúvida numa pista. Veja como o motor faz esse encaixe.",
      titulo: "Unificação: encaixar uma pergunta num fato",
      texto: [
        "Para responder uma pergunta, o motor precisa encaixá-la nos fatos e nas regras. Esse encaixe se chama unificação: duas expressões unificam se dá para trocar as variáveis por valores e deixá-las idênticas.",
        "Quando unificam, a troca feita (por exemplo S = cafe) vira parte da resposta. Quando não, o motor descarta aquele caminho e tenta outro. Uma variável nunca pode ser trocada por algo que a contém, como X por f(X): isso geraria um termo infinito."],
      fazer: el("div", { class: "exp" }, el("h4", { text: "Tente encaixar duas expressões" }),
        botoes(pres.map(function (p) { return { rotulo: p[0] + "  =  " + p[1], p: p }; }), function (t) { a.value = t.p[0]; b.value = t.p[1]; roda(); }),
        el("div", { class: "linha-campos" }, a, b, el("button", { class: "botao papel-btn", type: "button", text: "Unificar", onclick: roda })), saida),
      iniciar: roda
    };
  }

  /* ---------------- lição 4: inferência e prova ---------------- */
  function licaoProva() {
    var saida = el("div", { "aria-live": "polite" }), mod = { sem: false };
    function roda() {
      GE.limpar(saida);
      try {
        var dados = window.GE_CASOS[mod.sem ? "sem-registro-guarda" : "oficial"], c = GE.motor.caso(dados), a = c.analise();
        var corpo = [selo(), el("p", { class: "conclusao-motor" }, el("b", { text: a.conclusao.texto }))];
        if (a.suspeitos.length) corpo.push(el("div", { class: "suspeitos-fila" }, a.suspeitos.map(function (n) { return GE.pessoaRotulo(n); })));
        a.suspeitos.forEach(function (n) {
          var p = c.prova("suspeito(" + c.atomo(n) + ")");
          if (p.provado) corpo.push(el("details", { class: "bloco" }, el("summary", { style: { cursor: "pointer", fontWeight: "800", color: "var(--vinho)" }, text: "Como o motor provou que " + n + " é suspeito (" + p.inferencias + " inferências)" }), GE.arvoreProva(p.arvore, GE.estado.modo)));
        });
        if (!a.suspeitos.length) {
          var ref = c.refutados();
          corpo.push(el("p", { class: "nota-origem", text: ref.length ? "Sem o registro da câmera, o depoimento de Seu Barros não é mais desmentido, e ele fica livre. " : "Ninguém satisfaz todas as condições da regra suspeito." }));
        }
        saida.appendChild(el("div", { class: "resposta-consulta" }, corpo));
      } catch (e) { saida.appendChild(erro(e)); }
    }
    var chk = el("input", { type: "checkbox", id: "intro-sem", onchange: function () { mod.sem = chk.checked; roda(); } });
    return {
      moraes: "Quem é suspeito? O motor não chuta: ele monta uma prova passo a passo.",
      titulo: "Inferência: o motor monta a prova",
      texto: [
        "Inferir é partir dos fatos e das regras e chegar a uma conclusão nova, mostrando o caminho. O motor faz isso pela resolução SLD: pega a pergunta, procura uma regra ou fato que se encaixe (unificação), troca a pergunta pelas condições dessa regra e repete até só sobrarem fatos.",
        "O caminho percorrido é a prova, uma árvore em que cada nó diz qual regra foi usada. Se o motor não consegue fechar a árvore, a resposta é falso. Aqui a pergunta é a do trabalho todo: quem é suspeito?"],
      codigo: regra("suspeito"),
      fazer: el("div", { class: "exp" }, el("h4", { text: "Rode a pergunta e depois mude os fatos" }),
        el("div", { class: "linha-campos" }, el("button", { class: "botao papel-btn", type: "button", text: "?- suspeito(P).", onclick: roda }),
          el("label", { class: "marca-intro" }, chk, " E se o registro da câmera da galeria (guarda às 21h20) não existisse?")), saida),
      iniciar: function () { saida.appendChild(el("p", { class: "nota-origem", text: "Clique em \"?- suspeito(P).\"" })); }
    };
  }

  /* ---------------- lição 5: SAT ---------------- */
  function licaoSat() {
    var saida = el("div", { "aria-live": "polite" }), est = { caso: "oficial", p: "guarda" };
    function roda() {
      GE.limpar(saida);
      try {
        var dados = window.GE_CASOS[est.caso], pessoas = M.pessoasDo(dados);
        var p = pessoas.indexOf(est.p) >= 0 ? est.p : pessoas[0], r = M.SAT.consistencia(dados, p, false);
        var corpo = [selo(), el("p", null, el("b", { text: r.sat ? "Satisfazível: existe um trajeto possível. " : "Insatisfazível: não existe trajeto. " }), "Para " + GE.PERSONAGEM[p].nome + ", o motor montou " + r.variaveis + " variáveis e " + r.clausulas + " cláusulas, com " + r.stats.decisoes + " decisões e " + r.stats.conflitos + " conflitos até concluir.")];
        if (r.sat) corpo.push(GE.blocoCodigo("Um trajeto que respeita todos os registros (sala: minutos)", r.trajetoria.map(function (t) { return GE.nomeSala(t[0]) + ": " + t[1] + "–" + t[2]; }).join("\n")));
        else corpo.push(el("p", null, el("b", { text: "O que se contradiz: " }), r.nucleo.join("  +  ")));
        saida.appendChild(el("div", { class: "resposta-consulta" }, corpo));
      } catch (e) { saida.appendChild(erro(e)); }
    }
    var selP = seletorPessoa("Pessoa", est.p, function (v) { est.p = v; roda(); });
    return {
      moraes: "Às vezes os registros brigam entre si. O SAT descobre se alguma história cabe em todos eles.",
      titulo: "SAT: existe uma história que cabe em tudo?",
      texto: [
        "Há outra pergunta, diferente de \"quem é suspeito\": os registros de uma pessoa podem ser todos verdadeiros ao mesmo tempo? Para responder, o trabalho transforma o museu em um quebra-cabeça de verdadeiro ou falso, com uma variável para cada \"pessoa na sala X no minuto T\".",
        "As regras viram cláusulas: a pessoa está em uma sala só em cada minuto, só anda pelos corredores e leva o tempo do corredor, e cada registro obriga a estar naquela sala naquele minuto. O DPLL tenta atribuir valores, propaga o que é forçado e volta atrás quando bate em contradição. Se acha uma atribuição, a entrada é consistente. Se não acha, ela é impossível, e o motor aponta quais itens brigam."],
      fazer: el("div", { class: "exp" }, el("h4", { text: "Compare o caso do museu com um caso de registros impossíveis" }),
        botoes([{ rotulo: "Caso do museu (o do jogo)", c: "oficial" }, { rotulo: "Exemplo com registros impossíveis", c: "inconsistente" }], function (t) { est.caso = t.c; est.p = t.c === "inconsistente" ? "curadora" : "guarda"; selP.querySelector(".pessoas-sel").escolher(est.p); roda(); }),
        el("div", { class: "linha-campos" }, selP), saida,
        el("p", { class: "nota-origem", text: "No exemplo impossível, a curadora aparece na galeria às 21h10 e na reserva às 21h12, mas o corredor leva 4 minutos." })),
      iniciar: roda
    };
  }

  /* ---------------- lição 6: revisão ---------------- */
  var QUIZ = [
    { p: "registro(guarda, cafe, 5). é...", o: ["um fato", "uma regra", "uma pergunta"], c: 0, e: "Fatos não têm condições: apenas afirmam algo, como uma linha do livro." },
    { p: "O motor não consegue fechar a árvore de prova de uma pergunta. O que ele responde?", o: ["verdadeiro", "falso (não provado)", "talvez"], c: 1, e: "Sem prova a partir dos fatos e regras, a resposta é falso." },
    { p: "Um depoimento é refutado quando...", o: ["a pessoa é suspeita", "há registro dela em outra sala dentro do intervalo dito", "ninguém o confirma"], c: 1, e: "Refutar exige um registro que não cabe junto com o depoimento." },
    { p: "O SAT responde \"insatisfazível\" para uma pessoa. Isso significa...", o: ["que ela é culpada", "que seus registros se contradizem entre si", "que o mapa tem um erro"], c: 1, e: "Nenhum trajeto respeita todos os registros ao mesmo tempo. O núcleo mostra quais brigam." }
  ];
  function licaoFim() {
    var acertos = {}, placar = el("p", { class: "nota-origem", "aria-live": "polite" });
    var lista = el("div", { class: "quiz-intro" }, QUIZ.map(function (q, i) {
      var fb = el("p", { class: "quiz-fb", "aria-live": "polite" });
      var ops = el("div", { class: "cano", role: "group", "aria-label": q.p }, q.o.map(function (t, j) {
        return el("button", { type: "button", "aria-pressed": "false", text: t, onclick: function () {
          [].forEach.call(ops.children, function (x) { x.setAttribute("aria-pressed", "false"); }); this.setAttribute("aria-pressed", "true");
          var ok = j === q.c; acertos[i] = ok;
          fb.textContent = (ok ? "Certo. " : "Ainda não. ") + q.e; fb.className = "quiz-fb " + (ok ? "ok" : "no");
          var n = Object.keys(acertos).filter(function (k) { return acertos[k]; }).length; placar.textContent = n + " de " + QUIZ.length + " certas.";
        } });
      }));
      return el("div", { class: "quiz-q" }, el("p", null, el("b", { text: (i + 1) + ". " + q.p })), ops, fb);
    }));
    return {
      moraes: "Última parada antes do museu. Confira se as ideias ficaram e vamos ao caso.",
      titulo: "Teste rápido e hora de investigar",
      texto: ["Quatro perguntas para conferir se as ideias ficaram. Não é obrigatório acertar: cada resposta explica o porquê.",
        "No jogo, cada pista que você encontrar vira um fato, cada conversa vira um depoimento, e o painel Lógica em Ação mostra o motor trabalhando com eles."],
      fazer: el("div", { class: "exp" }, lista, placar,
        el("div", { class: "linha-campos", style: { marginTop: "12px" } }, el("button", { class: "botao", type: "button", id: "btn-liberar-jogo", text: "Começar o jogo" }))),
      iniciar: function () { if (GE.estado.introVista) { var b = document.getElementById("btn-liberar-jogo"); if (b) b.textContent = "Ir ao jogo"; } }
    };
  }

  GE.intro = {
    liberarJogo: function (rolar) {
      var j = document.getElementById("jogar"); if (!j) return;
      var estavaOculto = j.hidden; j.hidden = false;
      GE.estado.introVista = true; GE.salvar();
      var b = document.getElementById("btn-liberar-jogo"); if (b) { b.textContent = "Ir ao jogo"; }
      if (rolar !== false) { j.scrollIntoView({ behavior: GE.estado.reduzir ? "auto" : "smooth" }); setTimeout(function () { var c = document.getElementById("btn-comecar"); if (c) c.focus({ preventScroll: true }); }, GE.estado.reduzir ? 0 : 500); }
      return estavaOculto;
    },
    iniciar: function (alvo) {
      GE.limpar(alvo);
      var licoes = [licaoFatos(), licaoRegras(), licaoUnificacao(), licaoProva(), licaoSat(), licaoFim()];
      var visto = {}, atual = 0;
      var trilha = el("div", { class: "intro-trilha", role: "tablist", "aria-label": "Lições" });
      var corpo = el("div", { class: "cartao-papel papel intro-corpo", role: "tabpanel", "aria-live": "polite" });
      var iniciada = {};
      function mostra(i) {
        atual = i; visto[i] = true; var l = licoes[i];
        [].forEach.call(trilha.children, function (b, j) { b.setAttribute("aria-selected", String(j === i)); b.classList.toggle("visto", !!visto[j]); });
        GE.limpar(corpo);
        corpo.appendChild(el("h3", { text: (i + 1) + ". " + l.titulo }));
        corpo.appendChild(moraes(l.moraes));
        l.texto.forEach(function (t) { corpo.appendChild(el("p", { text: t })); });
        if (l.codigo) corpo.appendChild(el("pre", { class: "sombra-codigo", tabindex: "0", text: l.codigo }));
        corpo.appendChild(l.fazer);
        corpo.appendChild(el("div", { class: "intro-nav" },
          el("button", { class: "botao papel-btn", type: "button", text: "Anterior", disabled: i === 0, onclick: function () { mostra(i - 1); } }),
          i < licoes.length - 1 ? el("button", { class: "botao", type: "button", text: "Próxima lição", onclick: function () { mostra(i + 1); } }) : null));
        l.iniciar();
      }
      licoes.forEach(function (l, i) {
        trilha.appendChild(el("button", { type: "button", role: "tab", "aria-selected": "false", onclick: function () { mostra(i); } }, el("span", { class: "n", text: String(i + 1) }), el("span", { class: "t", text: l.titulo.split(":")[0].replace("Teste rápido e hora de investigar", "Teste") })));
      });
      /* botão final liga ao jogo (ele existe só na última lição, criado a cada renderização) */
      corpo.addEventListener("click", function (e) { if (e.target && e.target.id === "btn-liberar-jogo") GE.intro.liberarJogo(); });
      alvo.appendChild(el("div", { class: "intro" }, trilha, corpo,
        el("p", { class: "intro-pular" }, "Já conhece a matéria? ", el("button", { class: "link-btn", type: "button", text: "Ir direto ao jogo", onclick: function () { GE.intro.liberarJogo(); } }))));
      mostra(0);
    }
  };
})();
