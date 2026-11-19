/* util.js — utilitários, barramento de eventos, estado e acesso ao manifesto de imagens.
   Tudo vive no espaço de nomes global window.GE (scripts clássicos, para abrir via file://). */
(function () {
  var GE = (window.GE = window.GE || {});

  /* ---------- DOM ---------- */
  function add(n, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(n, x); }); return; }
    n.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
  GE.el = function (tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  };
  GE.limpar = function (n) { while (n.firstChild) n.removeChild(n.firstChild); return n; };
  GE.esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  GE.pad = function (n) { return (n < 10 ? "0" : "") + n; };
  GE.hora = function (m) { return m < 60 ? "21h" + GE.pad(m) : "22h" + GE.pad(m - 60); };
  GE.NS = "http://www.w3.org/2000/svg";
  GE.S = function (tag, attrs) {
    var n = document.createElementNS(GE.NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null) return;
      if (k === "text") n.textContent = v; else n.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  };

  /* ---------- barramento ---------- */
  var ouvintes = {};
  GE.bus = {
    on: function (nome, fn) { (ouvintes[nome] = ouvintes[nome] || []).push(fn); },
    emit: function (nome, dado) { (ouvintes[nome] || []).slice().forEach(function (f) { f(dado); }); }
  };

  /* ---------- armazenamento (opcional: a página funciona sem ele) ---------- */
  GE.ler = function (k, padrao) {
    try { var v = localStorage.getItem(k); return v == null ? padrao : JSON.parse(v); } catch (e) { return padrao; }
  };
  GE.guardar = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } };

  GE.estado = Object.assign({ modo: "aprendiz", reduzir: false, historico: [], atual: null }, GE.ler("ge-estado-v1", {}));
  if (GE.estado.modo !== "aprendiz" && GE.estado.modo !== "tecnico") GE.estado.modo = "aprendiz";
  GE.estado.feitos = GE.estado.feitos || {};
  GE.estado.diario = Object.assign({ pistas: [], depoimentos: [], registros: [] }, GE.estado.diario || {});
  GE.salvar = function () { GE.guardar("ge-estado-v1", GE.estado); };

  /* ---------- manifesto de imagens ---------- */
  var M = (GE.M = window.GE_MANIFEST || { personagens: [], cenarios: [] });
  GE.pers = function (id) { return M.personagens.filter(function (p) { return p.id === id; })[0]; };
  GE.retrato = function (pid, rid) {
    var p = GE.pers(pid); if (!p) return null;
    var r = p.retratos.filter(function (x) { return x.id === rid; })[0] || p.retratos[0];
    return r ? r.arquivo : null;
  };
  /* personagens do caso: chave usada no motor -> personagem do jogo */
  GE.PERSONAGEM = {
    guarda: { pid: "barros", nome: "Seu Barros", papel: "guarda", expr: "serio" },
    curadora: { pid: "iris", nome: "Dra. Íris", papel: "curadora", expr: "sorrindo" },
    faxineiro: { pid: "tiao", nome: "Tião", papel: "faxineiro", expr: "sorrindo" },
    visitante: { pid: "luiza", nome: "Luiza", papel: "visitante", expr: "sorrindo" },
    moraes: { pid: "moraes", nome: "Detetive Moraes", papel: "detetive", expr: "pensando" }
  };
  /* retrato redondo; devolve null se a pessoa não for um personagem conhecido */
  GE.avatar = function (chave, tam, expr) {
    var c = GE.PERSONAGEM[chave]; if (!c) return null;
    var src = GE.retrato(c.pid, expr || c.expr); if (!src) return null;
    return GE.el("img", { class: "avatar avatar-" + (tam || "p"), src: src, alt: "", "aria-hidden": "true", loading: "lazy" });
  };
  /* "retrato + nome" para tabelas e textos */
  GE.pessoaRotulo = function (chave) {
    var c = GE.PERSONAGEM[chave], a = GE.avatar(chave, "p");
    return GE.el("span", { class: "pessoa-rot" }, a, GE.el("span", { text: c ? c.nome + " (" + c.papel + ")" : chave }));
  };
  GE.sprite = function (pid, dir) {
    var p = GE.pers(pid); if (!p) return null;
    return (p.sprites || {})[dir || "frente"] || null;
  };
  GE.objeto = function (id) { return (M.objetos || {})[id]; };
  GE.final = function (id) { return (M.finais || {})[id]; };
  GE.cenaImg = function (id) { return M.cenarios.filter(function (c) { return c.id === id; })[0]; };

  /* ---------- ícones (traço simples, herdam a cor do texto) ---------- */
  var base = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  GE.ICONES = {
    lupa: base + '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/></svg>',
    livro: base + '<path d="M3 5.5C5.5 4.5 9 4.5 12 6.5c3-2 6.5-2 9-1v13c-2.500-1-6-1-9 1-3-2-6.500-2-9-1z"/><path d="M12 6.500v13"/></svg>',
    camera: base + '<rect x="3" y="7" width="18" height="12" rx="3"/><circle cx="12" cy="13" r="3.200"/><path d="M8 7l1.500-2.500h5L16 7"/></svg>',
    pin: base + '<path d="M12 21s7-6.200 7-11.500A7 7 0 0 0 5 9.500C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/></svg>',
    pedestal: base + '<path d="M6 20h12M8 20V9h8v11M6 9h12"/><path d="M12 2.500l1.200 2.600 2.800.3-2.100 1.900.6 2.800-2.500-1.400-2.500 1.400.6-2.800-2.100-1.900 2.800-.3z"/></svg>',
    mapa: base + '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
    fala: base + '<path d="M4 5h16v11H9l-5 4z"/></svg>',
    estrela: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1.500l2.700 6.700 7.100.6-5.400 4.700 1.700 7-6.100-3.800-6.100 3.800 1.700-7L2.200 8.800l7.100-.6z"/></svg>'
  };
  GE.icone = function (nome) { var s = GE.el("span", { html: GE.ICONES[nome] || "", style: { display: "contents" } }); return s; };
})();
