/* painel.js — painel "Lógica em Ação". Só desenha o que o adaptador entrega. */
(function () {
  var GE = window.GE, el = GE.el;
  var host, corpo, areaEvento, areaHist, ariaLive;
  var raciocinioAberto = false;

  var ORIGEM = {
    demo: ["demo", "Exemplo demonstrativo", "Escrito à mão a partir do enunciado. Não foi calculado pelo motor."],
    aguardando: ["aguardando", "Aguardando o motor", "Esta parte só terá conteúdo quando o motor estiver conectado."],
    motor: ["real", "Resultado do motor", "Os valores desta tela foram calculados pelo motor de inferência (SLD e DPLL). Os textos explicativos são fixos."]
  };
  function selo(origem) { var o = ORIGEM[origem] || ORIGEM.demo; return el("span", { class: "selo " + o[0], text: o[1], title: o[2] }); }

  /* realce simples de código: predicado( / Variável / número */
  function realce(txt) {
    return GE.esc(txt).replace(/\b([A-Za-z_][A-Za-z0-9_]*)(\()?|\b(\d+)\b/g, function (m, nome, par, num) {
      if (num) return '<span class="n">' + num + "</span>";
      if (par) return '<span class="p">' + nome + "</span>(";
      return /^[A-Z_]/.test(nome) ? '<span class="v">' + nome + "</span>" : nome;
    });
  }
  GE.realce = realce;
  GE.blocoCodigo = function (rotulo, codigo, nota) {
    var f = el("figure", { class: "codigo" });
    if (rotulo) f.appendChild(el("figcaption", { text: rotulo }));
    f.appendChild(el("pre", { tabindex: "0", html: "<code>" + realce(codigo) + "</code>" }));
    if (nota) f.appendChild(el("p", { class: "nota", text: nota }));
    return f;
  };

  function bloco(titulo, conteudo, extra) {
    return el("section", { class: "bloco " + (extra || "") }, el("h4", { text: titulo }), conteudo);
  }

  function arvoreNo(n, nivel, modo) {
    var rotulo = { regra: "regra", fato: "fato", "embutido": "conta" }[n.tipo] || n.tipo;
    var cab = el("div", { class: "no-cab" }, el("code", { html: realce(n.objetivo) }), el("span", { class: "no-tipo " + n.tipo, text: rotulo }));
    var det = el("div", { class: "no-det" });
    if (modo === "tecnico") {
      if (n.tipo === "regra") det.appendChild(el("code", { class: "no-regra", text: n.regra }));
      if (n.tipo === "embutido") det.appendChild(el("span", { text: n.regra.replace("embutido: ", "") }));
      var u = Object.keys(n.unificador || {}).map(function (k) { return k + "/" + n.unificador[k]; }).join(", ");
      if (u) det.appendChild(el("span", { class: "no-uni", text: "θ = { " + u + " }" }));
    } else if (n.tipo === "regra") {
      det.appendChild(el("span", { text: "Resolvido por uma regra: precisa provar as condições abaixo." }));
    }
    if (!n.filhos.length) return el("li", { role: "treeitem" }, cab, det.childNodes.length ? det : null);
    var d = el("details", { open: nivel < 2 }, el("summary", null, cab), det.childNodes.length ? det : null,
      el("ul", { role: "group" }, n.filhos.map(function (f) { return arvoreNo(f, nivel + 1, modo); })));
    return el("li", { role: "treeitem" }, d);
  }

  GE.arvoreProva = function (nos, modo) { return el("ul", { class: "arvore", role: "tree" }, nos.map(function (n) { return arvoreNo(n, 0, modo || GE.estado.modo); })); };

  function raciocinio(ev) {
    var r = ev.raciocinio, modo = GE.estado.modo, w = el("div", { class: "raciocinio" });
    if (!r) return w;
    if (r.aviso) w.appendChild(el("p", { class: "nota-origem", text: r.aviso }));
    if (r.tipo === "passos") {
      var lista = r[modo] || r.aprendiz;
      w.appendChild(el("ol", { class: "passos" }, lista.map(function (p) {
        return el("li", null, el("div", null, el("b", { text: p.t }), p.d ? el("span", { text: p.d }) : null, p.codigo ? GE.blocoCodigo(null, p.codigo) : null));
      })));
    } else if (r.tipo === "grafo") {
      var caso = window.GE_CASOS.oficial, leg = el("p", { class: "grafo-leg", "aria-live": "polite", text: GE.legendaGrafo(caso, null) });
      w.appendChild(el("div", { class: "grafo" }, GE.grafoSVG(caso, { aoEscolher: function (s) { leg.textContent = GE.legendaGrafo(caso, s); } }), leg));
      if (r.passos) w.appendChild(el("ol", { class: "passos" }, r.passos.map(function (p) {
        return el("li", null, el("div", null, el("b", { text: p.t }), p.d ? el("span", { text: p.d }) : null, p.codigo ? GE.blocoCodigo(null, p.codigo) : null));
      })));
    } else if (r.tipo === "arvore") {
      w.appendChild(el("dl", { class: "campos" }, r.campos.map(function (c) { return el("div", null, el("dt", { text: c[0] }), el("dd", { text: c[1] })); })));
      w.appendChild(el("h5", { class: "arvore-tit", text: "Árvore de prova" }));
      w.appendChild(el("ul", { class: "arvore", role: "tree" }, r.arvore.map(function (n) { return arvoreNo(n, 0, modo); })));
    } else if (r.tipo === "campos") {
      w.appendChild(el("dl", { class: "campos" }, r.campos.map(function (c) { return el("div", null, el("dt", { text: c[0] }), el("dd", { text: c[1] })); })));
    }
    return w;
  }

  function desenhar(ev, novo) {
    var modo = GE.estado.modo;
    GE.limpar(areaEvento);
    if (!ev) {
      var g = GE.sprite("estrela", "sentada");
      areaEvento.appendChild(el("div", { class: "vazio-painel" },
        g ? el("img", { src: g.arquivo, alt: "A gata Estrela, sentada" }) : null,
        el("p", { text: "Os conceitos de lógica aparecem aqui quando você faz algo importante na investigação." }),
        el("p", { class: "legenda-previa", text: "Para ver o painel sem jogar, escolha um conceito em “Abrir um conceito sem jogar”, mais abaixo." })));
      return;
    }
    var o = ORIGEM[ev.origem] || ORIGEM.demo;
    var cl = novo ? " nova" : "";
    areaEvento.appendChild(el("div", { class: "painel-origem" }, selo(ev.origem), el("span", { text: "Conceito " + ev.ordem + " de " + GE.EVENTOS.length }),
      ev.origem === "motor" ? null : el("span", { text: o[2] })));
    areaEvento.appendChild(el("section", { class: "bloco destaque" + cl },
      el("h4", { text: "Conceito atual" }), el("div", { class: "conceito-nome", text: ev.conceito }), el("p", { text: ev.acao })));
    areaEvento.appendChild(el("div", { class: cl }, bloco("O que acabou de acontecer?", el("p", { text: ev[modo].aconteceu }))));
    areaEvento.appendChild(el("div", { class: cl }, bloco("Relação com a disciplina", el("p", { text: ev[modo].relacao }))));

    var formais = (ev.formal || []).filter(function (f) { return modo === "tecnico" || !f.soTecnico; });
    if (formais.length) {
      var cx = el("div");
      formais.forEach(function (f) { cx.appendChild(GE.blocoCodigo(f.rotulo, f.codigo, f.nota)); });
      areaEvento.appendChild(el("div", { class: cl }, bloco("Representação formal", cx)));
    }
    if (ev.extra) {
      areaEvento.appendChild(el("div", { class: cl }, bloco(ev.extra.titulo, el("ul", { class: "passos-simples", style: { margin: 0, paddingLeft: "1.1em", display: "grid", gap: "6px" } },
        ev.extra.itens.map(function (i) { return el("li", null, el("b", { text: i.t + ". " }), i.d); })))));
    }
    var corpoR = el("div", { id: "raciocinio-corpo", hidden: !raciocinioAberto });
    if (raciocinioAberto) corpoR.appendChild(raciocinio(ev));
    var btn = el("button", { class: "expande", type: "button", "aria-expanded": String(raciocinioAberto), "aria-controls": "raciocinio-corpo",
      onclick: function () {
        raciocinioAberto = !raciocinioAberto;
        btn.setAttribute("aria-expanded", String(raciocinioAberto));
        corpoR.hidden = !raciocinioAberto; GE.limpar(corpoR);
        if (raciocinioAberto) corpoR.appendChild(raciocinio(ev));
      } }, el("span", { text: "Ver raciocínio completo" }), el("span", { class: "seta" }));
    areaEvento.appendChild(el("div", { class: cl }, btn, corpoR));
    ariaLive.textContent = "Novo conceito: " + ev.conceito + ". " + ev.acao;
  }

  function mostrar(id, novo) {
    var ev = id ? GE.motor.obter(id) : null;
    GE.estado.atual = id || null; GE.salvar();
    desenhar(ev, novo);
    desenharHistorico();
    if (novo && corpo) corpo.scrollTop = 0;
  }

  function desenharHistorico() {
    GE.limpar(areaHist);
    var h = GE.estado.historico;
    areaHist.appendChild(bloco("Histórico de aprendizado", h.length
      ? el("div", { class: "historico" }, h.map(function (id) {
        var ev = GE.motor.obter(id);
        return el("button", { class: "chip", type: "button", "aria-current": String(GE.estado.atual === id), onclick: function () { mostrar(id, false); } },
          el("span", { class: "ordem", text: ev.ordem }), ev.conceito);
      }))
      : el("p", { text: "Ainda vazio. Cada conceito novo entra aqui uma única vez, então andar pelo museu não enche a lista." })));
    var d = el("details", { class: "bloco" }, el("summary", { style: { cursor: "pointer", fontWeight: "800", color: "var(--vinho)", minHeight: "32px" }, text: "Abrir um conceito sem jogar" }),
      el("p", { class: "legenda-previa", style: { marginTop: "8px" }, text: "Abre qualquer um dos 8 conceitos sem precisar jogar. Os resultados mostrados são calculados pelo motor." }),
      el("div", { class: "historico" }, GE.EVENTOS.map(function (ev) {
        return el("button", { class: "chip", type: "button", onclick: function () { GE.disparar(ev.id); }, title: ev.acao }, el("span", { class: "ordem", text: ev.ordem }), ev.conceito);
      })),
      el("button", { class: "botao papel-btn", type: "button", style: { marginTop: "10px" }, onclick: function () { GE.estado.historico = []; GE.estado.atual = null; GE.salvar(); GE.bus.emit("reiniciar"); mostrar(null, false); }, text: "Limpar histórico" }));
    areaHist.appendChild(d);
  }

  function aplicarModo() {
    [].forEach.call(host.querySelectorAll(".modo button"), function (b) { b.setAttribute("aria-checked", String(b.dataset.modo === GE.estado.modo)); b.tabIndex = b.dataset.modo === GE.estado.modo ? 0 : -1; });
    desenhar(GE.estado.atual ? GE.motor.obter(GE.estado.atual) : null, false);
  }

  GE.painel = {
    iniciar: function (alvo) {
      host = alvo; GE.limpar(host);
      ariaLive = el("div", { class: "so-leitor", "aria-live": "polite" });
      var modo = el("div", { class: "modo", role: "radiogroup", "aria-label": "Nível de explicação" },
        ["aprendiz", "tecnico"].map(function (m) {
          return el("button", { type: "button", role: "radio", "data-modo": m, "aria-checked": "false", text: m === "aprendiz" ? "Aprendiz" : "Técnico",
            onclick: function () { GE.estado.modo = m; GE.salvar(); aplicarModo(); },
            onkeydown: function (e) { if (/Arrow/.test(e.key)) { e.preventDefault(); GE.estado.modo = GE.estado.modo === "aprendiz" ? "tecnico" : "aprendiz"; GE.salvar(); aplicarModo(); host.querySelector('.modo button[aria-checked="true"]').focus(); } } });
        }));
      areaEvento = el("div", { style: { display: "grid", gap: "12px" } });
      areaHist = el("div", { style: { display: "grid", gap: "12px" } });
      corpo = el("div", { class: "painel-corpo", tabindex: "-1" }, areaEvento, areaHist);
      host.appendChild(el("div", { class: "painel-cab" }, el("div", null, el("h3", { text: "Lógica em Ação" }), el("div", { class: "sub", text: "A lógica por trás de cada passo" })), modo));
      host.appendChild(corpo); host.appendChild(ariaLive);
      desenharHistorico();
      aplicarModo();
      GE.bus.on("reiniciar", function () { mostrar(null, false); });
      GE.bus.on("evento", function (d) { mostrar(d.ev.id, d.novo); });
    }
  };
})();
