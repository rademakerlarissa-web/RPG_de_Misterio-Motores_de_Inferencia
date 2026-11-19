/* main.js — liga tudo. Ordem de scripts: dados → core → engine → painel → jogo → docs → lab → main. */
(function () {
  var GE = window.GE, $ = function (s, r) { return (r || document).querySelector(s); };

  function aplicarReduzir() {
    var on = !!GE.estado.reduzir;
    document.documentElement.classList.toggle("sem-animacao", on);
    var b = $("#alterna-anim"); if (b) b.setAttribute("aria-pressed", String(on));
  }

  function iniciar() {
    GE.painel.iniciar($("#painel-raiz"));
    GE.palco.iniciar($("#palco-raiz"));
    GE.intro.iniciar($("#intro-raiz"));
    /* A introdução (#introducao, hidden no HTML) está desativada. Para reativá-la: tirar o hidden de #introducao,
       pôr hidden em #jogar e usar INTRO_ATIVA = true. */
    var INTRO_ATIVA = false;
    if (INTRO_ATIVA && !GE.estado.introVista) $("#jogar").hidden = true;
    GE.docsFluxo($("#fluxo-raiz"));
    GE.docsModulos($("#modulos-raiz"));
    GE.lab.iniciar($("#lab-raiz"));
    GE.docsSobre($("#sobre-raiz"));
    GE.heroArte($("#hero-arte"));

    /* reduzir animações */
    aplicarReduzir();
    $("#alterna-anim").addEventListener("click", function () { GE.estado.reduzir = !GE.estado.reduzir; GE.salvar(); aplicarReduzir(); });

    /* menu móvel */
    var topo = $(".topo"), mb = $(".menu-btn");
    mb.addEventListener("click", function () { var a = topo.classList.toggle("aberto"); mb.setAttribute("aria-expanded", String(a)); });
    [].forEach.call(document.querySelectorAll(".menu a"), function (a) { a.addEventListener("click", function () { topo.classList.remove("aberto"); mb.setAttribute("aria-expanded", "false"); }); });

    /* alternância Jogo / Lógica (tablet e celular) */
    var jogo = $("#jogo"), abas = document.querySelectorAll(".abas-vista button"), ponto = $(".ponto-novo");
    function vista(v) {
      jogo.dataset.vista = v;
      [].forEach.call(abas, function (b) { b.setAttribute("aria-selected", String(b.dataset.vista === v)); });
      if (v === "logica") ponto.hidden = true;
    }
    [].forEach.call(abas, function (b) { b.addEventListener("click", function () { vista(b.dataset.vista); }); });
    vista("jogo");
    GE.bus.on("evento", function (d) { if (jogo.dataset.vista === "jogo" && d.novo && getComputedStyle($(".abas-vista")).display !== "none") ponto.hidden = false; });

    /* botão do início leva à introdução; o jogo só aparece depois dela */
    $("#btn-iniciar").addEventListener("click", function (e) {
      e.preventDefault();
      var alvo = INTRO_ATIVA && $("#jogar").hidden ? $("#introducao") : $("#jogar");
      alvo.scrollIntoView({ behavior: GE.estado.reduzir ? "auto" : "smooth" });
      if (alvo.id === "jogar") { vista("jogo"); setTimeout(function () { var b = $("#btn-comecar"); if (b) b.focus({ preventScroll: true }); }, GE.estado.reduzir ? 0 : 500); }
    });
    [].forEach.call(document.querySelectorAll('a[href="#jogar"]'), function (a) {
      a.addEventListener("click", function (e) {
        if (INTRO_ATIVA && $("#jogar").hidden) { e.preventDefault(); $("#introducao").scrollIntoView({ behavior: GE.estado.reduzir ? "auto" : "smooth" }); }
      });
    });

    /* item atual do menu */
    var links = {};
    [].forEach.call(document.querySelectorAll(".menu a"), function (a) { links[a.getAttribute("href").slice(1)] = a; });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { Object.keys(links).forEach(function (k) { links[k].removeAttribute("aria-current"); }); if (links[e.target.id]) links[e.target.id].setAttribute("aria-current", "true"); }
        });
      }, { rootMargin: "-40% 0px -55% 0px" });
      Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
    }
  }

  /* arte da introdução: Estrela sentada + medalhões das pessoas do caso */
  GE.heroArte = function (alvo) {
    var el = GE.el, g = GE.sprite("estrela", "sentada");
    alvo.appendChild(el("div", { class: "brilho" }));
    alvo.appendChild(el("svg", { class: "constelacao", viewBox: "0 0 100 100", "aria-hidden": "true", html: '<g stroke="#D7A45B" stroke-opacity=".28" stroke-width=".35" fill="none"><path d="M12 22 L30 12 L52 18 L74 9 L90 24"/><path d="M8 62 L22 78 L16 92"/><path d="M92 62 L80 80 L90 94"/></g><g fill="#EBC888" opacity=".8"><circle cx="12" cy="22" r=".9"/><circle cx="30" cy="12" r=".7"/><circle cx="52" cy="18" r="1"/><circle cx="74" cy="9" r=".7"/><circle cx="90" cy="24" r=".9"/><circle cx="22" cy="78" r=".7"/><circle cx="80" cy="80" r=".7"/></g>' }));
    [["estrelinha", { left: "46%", top: "3%" }], ["estrelinha", { left: "86%", top: "34%", animationDelay: "1.2s" }], ["estrelinha", { left: "8%", top: "36%", animationDelay: "2.1s" }]].forEach(function (e) {
      alvo.appendChild(el("span", { class: e[0], style: e[1], html: GE.ICONES.estrela, "aria-hidden": "true" }));
    });
    alvo.appendChild(el("div", { class: "gata-sombra" }));
    if (g) alvo.appendChild(el("img", { class: "gata", src: g.arquivo, alt: "Estrela, a gata do museu, sentada" }));
    [["m1", "barros", "serio", "Seu Barros"], ["m2", "iris", "sorrindo", "Dra. Íris"], ["m3", "tiao", "sorrindo", "Tião"], ["m4", "luiza", "sorrindo", "Luiza"]].forEach(function (m) {
      var r = GE.retrato(m[1], m[2]); if (!r) return;
      alvo.appendChild(el("figure", { class: "medalhao " + m[0], style: { margin: "0" } }, el("img", { src: r, alt: m[3] }), el("figcaption", { text: m[3] })));
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
