/* visuais.js — desenhos feitos a partir dos DADOS do caso (grafo de salas e linha do tempo).
   Nada aqui é inferência: só mostra o que está no JSON de entrada. */
(function () {
  var GE = window.GE, S = GE.S;

  GE.NOME_SALA = { hall: "Hall", galeria: "Galeria", cafe: "Café", reserva: "Reserva técnica" };
  GE.COR_SALA = { hall: "#C58F45", galeria: "#B5708A", cafe: "#6F9A5E", reserva: "#5F86B8" };
  GE.POS_SALA = { hall: [95, 62], galeria: [325, 62], cafe: [95, 198], reserva: [325, 198] };
  GE.nomeSala = function (s) { return GE.NOME_SALA[s] || s; };
  GE.corSala = function (s) { return GE.COR_SALA[s] || "#8A7A6A"; };

  function salasDe(caso) {
    var v = [];
    (caso.corredores || []).forEach(function (c) { [c[0], c[1]].forEach(function (s) { if (v.indexOf(s) < 0) v.push(s); }); });
    return v;
  }
  GE.salasDe = salasDe;

  /* ---------- grafo de salas ---------- */
  GE.grafoSVG = function (caso, opts) {
    opts = opts || {};
    var salas = salasDe(caso), pos = {};
    salas.forEach(function (s, i) {
      pos[s] = GE.POS_SALA[s] || [210 + 120 * Math.cos((i / salas.length) * 6.283), 130 + 80 * Math.sin((i / salas.length) * 6.283)];
    });
    var svg = S("svg", { viewBox: "0 0 420 260", role: "group", "aria-label": "Planta do museu como grafo: salas e corredores com o tempo em minutos" });
    var gA = S("g"), gN = S("g"); svg.appendChild(gA); svg.appendChild(gN);
    var sel = null;
    function marca(el) { if (sel) sel.classList.remove("sel"); sel = el; if (el) el.classList.add("sel"); }

    (caso.corredores || []).forEach(function (c) {
      var a = pos[c[0]], b = pos[c[1]], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      var rotulo = "Corredor entre " + GE.nomeSala(c[0]) + " e " + GE.nomeSala(c[1]) + ": " + c[2] + " minutos";
      var g = S("g", { tabindex: "0", role: "button", "aria-label": rotulo });
      var l = S("line", { class: "aresta", x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
      var r = S("rect", { class: "peso-fundo", x: mx - 17, y: my - 13, width: 34, height: 26, rx: 13 });
      var t = S("text", { class: "peso", x: mx, y: my, text: c[2] });
      g.appendChild(l); g.appendChild(r); g.appendChild(t);
      function ativa() { marca(l); if (opts.aoEscolher) opts.aoEscolher({ tipo: "aresta", a: c[0], b: c[1], d: c[2] }); }
      g.addEventListener("click", ativa);
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ativa(); } });
      gA.appendChild(g);
    });
    salas.forEach(function (s) {
      var p = pos[s];
      var g = S("g", { class: "no", tabindex: "0", role: "button", "aria-label": "Sala " + GE.nomeSala(s) });
      var c = S("circle", { cx: p[0], cy: p[1], r: 38 });
      g.appendChild(c);
      g.appendChild(S("text", { x: p[0], y: p[1], text: GE.nomeSala(s).replace("Reserva técnica", "Reserva") }));
      function ativa() { marca(g); if (opts.aoEscolher) opts.aoEscolher({ tipo: "no", sala: s }); }
      g.addEventListener("click", ativa);
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ativa(); } });
      gN.appendChild(g);
    });
    return svg;
  };

  /* texto da legenda quando alguém clica no grafo */
  GE.legendaGrafo = function (caso, sel) {
    if (!sel) return "Clique em uma sala ou em um corredor para ver os dados de entrada.";
    if (sel.tipo === "aresta") return GE.nomeSala(sel.a) + " e " + GE.nomeSala(sel.b) + " estão ligados por um corredor de " + sel.d + " minutos, nos dois sentidos.";
    var vizinhos = (caso.corredores || []).filter(function (c) { return c[0] === sel.sala || c[1] === sel.sala; })
      .map(function (c) { return GE.nomeSala(c[0] === sel.sala ? c[1] : c[0]) + " (" + c[2] + " min)"; });
    return GE.nomeSala(sel.sala) + " liga-se diretamente a: " + vizinhos.join(", ") + ".";
  };

  /* ---------- linha do tempo ---------- */
  GE.linhaTempoSVG = function (caso) {
    var regs = caso.registros || [], deps = caso.depoimentos || [];
    var pessoas = [];
    regs.concat(deps).forEach(function (r) { if (pessoas.indexOf(r[0]) < 0) pessoas.push(r[0]); });
    var max = 45;
    regs.forEach(function (r) { max = Math.max(max, r[2]); });
    deps.forEach(function (d) { max = Math.max(max, d[3]); });
    if (caso.janela) max = Math.max(max, caso.janela[1]);
    max = Math.ceil((max + 2) / 5) * 5;
    var W = 760, ml = 96, mr = 18, top = 34, linha = 50, H = top + pessoas.length * linha + 30;
    function x(m) { return ml + (m / max) * (W - ml - mr); }
    var svg = S("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Linha do tempo dos registros e depoimentos de cada pessoa, em minutos depois das 21h" });
    for (var m = 0; m <= max; m += 5) {
      svg.appendChild(S("line", { class: "grade", x1: x(m), y1: top - 8, x2: x(m), y2: H - 10 }));
      svg.appendChild(S("text", { class: "t-eixo", x: x(m), y: 16, "text-anchor": "middle", text: GE.hora(m) }));
    }
    if (caso.janela) {
      var a = x(caso.janela[0]), b = x(caso.janela[1]);
      svg.appendChild(S("rect", { class: "janela", x: a, y: top - 8, width: b - a, height: H - top - 2, rx: 6 }));
      svg.appendChild(S("text", { class: "t-eixo", x: (a + b) / 2, y: H - 3, "text-anchor": "middle", text: "janela do sumiço" }));
    }
    pessoas.forEach(function (p, i) {
      var cy = top + i * linha + 22;
      svg.appendChild(S("text", { class: "t-pessoa", x: 4, y: cy + 4, text: p }));
      svg.appendChild(S("line", { class: "eixo", x1: ml, y1: cy, x2: W - mr, y2: cy, opacity: ".35" }));
      deps.filter(function (d) { return d[0] === p; }).forEach(function (d) {
        svg.appendChild(S("rect", { x: x(d[2]), y: cy + 7, width: Math.max(2, x(d[3]) - x(d[2])), height: 8, rx: 4, fill: GE.corSala(d[1]), opacity: ".5" },
          S("title", { text: "Depoimento: " + GE.nomeSala(d[1]) + ", de " + GE.hora(d[2]) + " a " + GE.hora(d[3]) })));
      });
      regs.filter(function (r) { return r[0] === p; }).forEach(function (r) {
        svg.appendChild(S("circle", { cx: x(r[2]), cy: cy - 3, r: 7, fill: GE.corSala(r[1]), stroke: "#3F2A1C", "stroke-width": "2" },
          S("title", { text: "Registro: " + GE.nomeSala(r[1]) + " às " + GE.hora(r[2]) })));
      });
    });
    return svg;
  };
  GE.legendaSalas = function (caso) {
    var d = document.createElement("div"); d.className = "legenda-salas";
    GE.salasDe(caso).forEach(function (s) {
      var sp = document.createElement("span");
      var i = document.createElement("i"); i.style.background = GE.corSala(s);
      sp.appendChild(i); sp.appendChild(document.createTextNode(GE.nomeSala(s))); d.appendChild(sp);
    });
    var r = document.createElement("span"); var i2 = document.createElement("i"); i2.className = "barra"; i2.style.background = "rgba(111,154,94,.5)"; i2.style.borderStyle = "dashed";
    r.appendChild(i2); r.appendChild(document.createTextNode("barra: depoimento · círculo: registro")); d.appendChild(r);
    return d;
  };
})();
