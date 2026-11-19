/* adaptador.js — ÚNICO ponto de contato entre a página e o motor de inferência (js/motor/*).
   O jogo dispara eventos por id; aqui cada evento é montado com resultados REAIS do motor, calculados
   sobre o caso oficial (casos/oficial.json). Os textos explicativos ficam em data/painel-textos.js.
   Se o motor não carregar, o evento aparece com origem "aguardando" e sem nenhum valor inventado. */
(function () {
  var GE = window.GE, M = GE.M;
  var R = null, cache = {};

  function copia(o) { return JSON.parse(JSON.stringify(o)); }

  /* extrai do texto das regras todas as cláusulas de um predicado (como estão no motor) */
  GE.regraTexto = function (nome) {
    var linhas = M.REGRAS.split("\n"), saida = [], dentro = false, ini = new RegExp("^" + nome + "\\(");
    linhas.forEach(function (l) {
      if (!dentro && ini.test(l)) dentro = true;
      if (dentro) { saida.push(l); if (/\.\s*$/.test(l)) dentro = false; }
    });
    return saida.join("\n");
  };

  function montarR() {
    var dados = copia(window.GE_CASOS.oficial), c = new M.Caso(dados), memo = {}, satc = null, provas = {};
    var cls = M.clausulas(dados);
    R = {
      c: c,
      nFatos: cls.filter(function (x) { return !x.corpo.length; }).length,
      nRegras: cls.filter(function (x) { return x.corpo.length; }).length,
      pessoas: M.pessoasDo(dados), salas: M.salasDo(dados),
      q: function (t) { return memo[t] || (memo[t] = c.consultar(t)); },
      prova: function (t) { return provas[t] || (provas[t] = c.prova(t)); },
      fatos: function (pred) { return M.fatosTexto(dados).split("\n").filter(function (l) { return l.indexOf(pred + "(") === 0; }).join("\n"); },
      regra: GE.regraTexto
    };
    Object.defineProperty(R, "provaSusp", { get: function () { return R.prova("suspeito(guarda)"); } });
    Object.defineProperty(R, "sat", { get: function () { return satc || (satc = c.satTodos()); } });
    Object.defineProperty(R, "analise", { get: function () { return memo.__an || (memo.__an = c.analise()); } });
    Object.defineProperty(R, "satSusp", { get: function () { return memo.__ss || (memo.__ss = c.satSuspeitos()); } });
    Object.defineProperty(R, "dimacsGuarda", { get: function () { return memo.__dg || (memo.__dg = new M.SAT.Codificacao(dados, "guarda").dimacs()); } });
    Object.defineProperty(R, "consequencia", { get: function () { return memo.__co || (memo.__co = M.SAT.consequencia(dados, "guarda", "galeria", 20)); } });
    return R;
  }

  var carregado = !!(M && M.Caso && GE.EVENTOS_MODELO);
  GE.EVENTOS = (GE.EVENTOS_MODELO || []).map(function (m) { return { id: m.id, ordem: m.ordem, conceito: m.conceito, acao: m.acao }; });

  GE.motor = {
    conectado: carregado,
    descricao: carregado ? "Motor próprio em JavaScript (SLD + DPLL), idêntico ao motor em Python (paridade testada)." : "Motor não carregou.",
    obter: function (id) {
      if (cache[id]) return cache[id];
      var m = (GE.EVENTOS_MODELO || []).filter(function (e) { return e.id === id; })[0];
      if (!m) return null;
      if (!carregado) {
        return { id: m.id, ordem: m.ordem, conceito: m.conceito, acao: m.acao, origem: "aguardando",
          aprendiz: { aconteceu: "O motor de inferência não carregou nesta página.", relacao: "" }, tecnico: { aconteceu: "O motor de inferência não carregou nesta página.", relacao: "" }, formal: [] };
      }
      try {
        var parte = m.montar(R || montarR());
        cache[id] = { id: m.id, ordem: m.ordem, conceito: m.conceito, acao: m.acao, origem: "motor",
          aprendiz: parte.aprendiz, tecnico: parte.tecnico, formal: parte.formal, extra: parte.extra, raciocinio: parte.raciocinio };
      } catch (e) {
        if (window.console) console.error("Falha ao montar o evento " + id, e);
        return { id: m.id, ordem: m.ordem, conceito: m.conceito, acao: m.acao, origem: "aguardando",
          aprendiz: { aconteceu: "O motor falhou ao calcular este conceito: " + e.message, relacao: "" }, tecnico: { aconteceu: "O motor falhou ao calcular este conceito: " + e.message, relacao: "" }, formal: [] };
      }
      return cache[id];
    },
    /* cria um caso do motor a partir de dados JSON (usado pelo Laboratório) */
    caso: function (dados) { return new M.Caso(copia(dados)); }
  };

  /* um evento do jogo chega ao painel por aqui; só registra o histórico se for novo */
  GE.disparar = function (id) {
    var ev = GE.motor.obter(id);
    if (!ev) return;
    var novo = GE.estado.historico.indexOf(id) < 0;
    if (novo) GE.estado.historico.push(id);
    GE.estado.atual = id;
    GE.salvar();
    GE.bus.emit("evento", { ev: ev, novo: novo });
  };
})();
