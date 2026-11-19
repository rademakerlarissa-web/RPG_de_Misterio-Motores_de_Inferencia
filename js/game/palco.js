/* palco.js — área do RPG: cenas, atores, pontos de interação, diálogo e diário.
   Cada cena é fundo + sprites + pontos
   clicáveis, em % da imagem. Os eventos do painel saem por GE.disparar(id) (engine/adaptador.js).
   Troca de cena: a história leva o jogador sozinha (`vaiPara`), e a Planta permite ir a qualquer sala. */
(function () {
  var GE = window.GE, el = GE.el;
  var palco, mundo, hud, camadaIntro, dlg, estado = { cena: null, missao: "Ainda sem missão.", feitos: {}, iniciou: false };

  /* ---------- cenas e interações ----------
     Cada interação (ponto ou conversa) pode ser feita em QUALQUER ordem. Os dados vêm do caso
     oficial de exemplo (casos/oficial.json): 4 depoimentos e 11 registros no total. */
  GE.CENAS = {
    escritorio: { nome: "Escritório do Detetive", atores: [{ p: "moraes", x: .30, pe: .93, h: .58, dir: "frente", nome: "Detetive Moraes", conv: "moraes" }],
      pontos: [{ id: "livro", x: .50, y: .60, rotulo: "Livro sobre a mesa", icone: "livro" }] },
    hall: { nome: "Hall principal", atores: [{ p: "helena", x: .27, pe: .95, h: .56, dir: "direita", nome: "Dona Helena", conv: "helena" }, { p: "moraes", x: .70, pe: .95, h: .56, dir: "esquerda", nome: "Detetive Moraes", conv: "moraes" }],
      pontos: [{ id: "pedestal", x: .50, y: .74, rotulo: "Pedestal vazio", icone: "pedestal" },
        { id: "cameraHall", x: .88, y: .22, rotulo: "Câmera escondida", icone: "camera", requer: "camera-hall" }] },
    galeria: { nome: "Galeria de Arte", atores: [], pontos: [{ id: "camera", x: .80, y: .25, rotulo: "Câmera da galeria", icone: "camera" }] },
    cafe: { nome: "Café do Museu", atores: [{ p: "barros", x: .15, pe: .95, h: .56, dir: "frente", nome: "Seu Barros", conv: "barros" }, { p: "luiza", x: .80, pe: .95, h: .52, dir: "esquerda", nome: "Luiza", conv: "luiza" }],
      pontos: [{ id: "comanda", x: .34, y: .64, rotulo: "Comanda do café", icone: "livro" }] },
    mapa: { nome: "Planta do museu", atores: [], pontos: [],
      pinos: [{ cena: "hall", x: .27, y: .27, rotulo: "Hall" }, { cena: "galeria", x: .72, y: .24, rotulo: "Galeria" }, { cena: "cafe", x: .27, y: .70, rotulo: "Café" }, { cena: "reserva", x: .72, y: .70, rotulo: "Reserva técnica" }] },
    reserva: { nome: "Reserva técnica", atores: [{ p: "iris", x: .20, pe: .97, h: .5, dir: "frente", nome: "Dra. Íris", conv: "iris" }, { p: "tiao", x: .70, pe: .97, h: .5, dir: "frente", nome: "Tião", conv: "tiao" }],
      pontos: [{ id: "mesa", x: .47, y: .50, rotulo: "Mesa da curadora", icone: "lupa" }, { id: "caixote", x: .90, y: .70, rotulo: "Planilha de limpeza", icone: "livro" }] }
  };
  /* ordem em que o jogo sugere salas com coisas pendentes (só sugere; a Planta leva a qualquer lugar) */
  var ROTA = ["hall", "cafe", "galeria", "reserva", "escritorio"];

  /* pontos de interação: texto, retrato do Moraes, dados que vão ao diário e evento do painel */
  var PONTOS = {
    livro: { ret: "pensando", texto: "Entre os papéis há uma cópia do livro de registros do museu. Uma linha chama a atenção: guarda, café, 21h05.", evento: "registro",
      diario: { pistas: ["Livro de registros do museu"], registros: [["guarda", "cafe", 5]] } },
    pedestal: { ret: "pensando", texto: "O pedestal da Estrela está vazio. Ela sumiu entre 21h14 e 21h30. Quem estava perto do hall nessa janela?", evento: "presenca",
      diario: { pistas: ["Pedestal vazio (sumiço entre 21h14 e 21h30)"] } },
    cameraHall: { ret: "surpreso", obj: "camera", evento: "avistamento",
      texto: "A câmera estava escondida num canto do teto, atrás de um vaso. A gravação marca 21h24 e mostra a Estrela saindo por uma janela aberta, sem pressa nenhuma. Não aparece ninguém na imagem.",
      diario: { pistas: ["Câmera escondida do hall"] } },
    camera: { ret: "surpreso", obj: "camera", evento: null,
      texto: function () { return temDep("guarda") ? "A câmera registrou o guarda Barros nesta galeria às 21h20, e a Dra. Íris às 21h13. " : "A câmera registrou o guarda Barros nesta galeria às 21h20, e a Dra. Íris às 21h13. Vale perguntar a ele onde estava."; },
      diario: { pistas: ["Câmera da galeria"], registros: [["guarda", "galeria", 20], ["curadora", "galeria", 13]] } },
    comanda: { ret: "pensando", texto: "A comanda do café marca a Luiza às 21h25 e às 21h40, e o guarda Barros às 21h40.", evento: "registro",
      diario: { pistas: ["Comanda do café"], registros: [["visitante", "cafe", 25], ["visitante", "cafe", 40], ["guarda", "cafe", 40]] } },
    mesa: { ret: "pensando", texto: "O controle de acesso da reserva anotou a Dra. Íris às 21h20 e às 21h31.", evento: "registro",
      diario: { pistas: ["Controle de acesso da reserva"], registros: [["curadora", "reserva", 20], ["curadora", "reserva", 31]] } },
    caixote: { ret: "pensando", texto: "A planilha de limpeza marca o Tião na reserva às 21h10 e às 21h35.", evento: "registro",
      diario: { pistas: ["Planilha de limpeza"], registros: [["faxineiro", "reserva", 10], ["faxineiro", "reserva", 35]] } }
  };

  /* conversas: cada pergunta pode ser feita uma vez e em qualquer ordem. `dep`/`reg` alimentam o diário. */
  var CONVERSAS = {
    barros: { quem: "barros", ret: "serio", abertura: "Detetive. Pode perguntar.", opcoes: [
      { t: "Onde o senhor estava?", ret: "cruzado", fala: "Fiquei aqui no café das 21h05 às 21h40. Não saí nem por um minuto.", dep: ["guarda", "cafe", 5, 40], evento: "depoimento" },
      { t: "O senhor viu a Estrela?", ret: "nervoso", fala: "Não vi. Se tivesse visto, já teria avisado a Dona Helena." }] },
    luiza: { quem: "luiza", ret: "surpresa", abertura: "Ai! Detetive, o senhor me assustou. Pode perguntar. Se for sobre o chocolate quente, eu confesso.", opcoes: [
      { t: "Onde você estava?", ret: "sorrindo", fala: "Entrei pelo hall às 21h00 e depois fiquei por aqui, tomando um chocolate quente, das 21h08 às 21h40. O chocolate estava ótimo. A noite, nem tanto.", dep: ["visitante", "cafe", 8, 40], evento: "depoimento" },
      { t: "Notou algo estranho?", ret: "pensativa", fala: "Só aquela cadeira caída. Ninguém levantou, e eu não quis mexer. Num museu, a gente nunca sabe se é obra de arte." }] },
    iris: { quem: "iris", ret: "surpresa", abertura: "Detetive Moraes! Que situação terrível. Em que posso ajudar?", opcoes: [
      { t: "Onde a senhora estava?", ret: "ideia", fala: "Estava na reserva técnica, catalogando peças, das 21h20 às 21h31.", dep: ["curadora", "reserva", 20, 31], evento: "depoimento" },
      { t: "Quem mais estava por aqui?", ret: "sorrindo", fala: "O Tião estava cuidando da limpeza da reserva, até onde sei. Ele canta enquanto limpa, dá para saber de longe." }] },
    tiao: { quem: "tiao", ret: "sorrindo", abertura: "Boa noite, seu detetive. Pode falar. Só cuidado com o chão, que acabei de passar pano.", opcoes: [
      { t: "Onde você estava?", ret: "pensando", fala: "Limpando a reserva técnica, das 21h10 às 21h35. Na reserva, a poeira volta mais rápido do que eu limpo.", dep: ["faxineiro", "reserva", 10, 35], evento: "depoimento" },
      { t: "Viu algo fora do lugar?", ret: "calma", fala: "Nada fora do lugar, seu detetive. Se tivesse, eu já tinha arrumado, é meu defeito. E se a Estrela passou por aqui, foi de pantufa, porque eu não ouvi nada. Nossa, se nem a câmera secreta do hall viu alguma coisa, eu muito menos, haha!", camera: true }] },
    helena: { quem: "helena", ret: "aflita", abertura: "Detetive, o senhor encontrou alguma coisa?", opcoes: [
      { t: "Quando a Luiza entrou no museu?", ret: "triste", fala: "Pelo hall, às 21h00. Está no livro de entrada. Ela cumprimentou até a estátua da entrada, o que foi simpático.", reg: [["visitante", "hall", 0]], pista: "Livro de entrada do hall", evento: "registro" },
      { t: "Quem tem acesso à reserva técnica?", ret: "aflita", fala: "Só a equipe: a Dra. Íris e o Tião." }] }
  };

  /* ---------- diário: dados reunidos durante o jogo ---------- */
  function guardaDiario(d) {
    if (!d) return;
    var b = GE.estado.diario;
    ["pistas", "depoimentos", "registros"].forEach(function (k) {
      (d[k] || []).forEach(function (x) { if (!b[k].some(function (y) { return JSON.stringify(y) === JSON.stringify(x); })) b[k].push(x); });
    });
    GE.salvar();
  }

  /* ---------- diálogo ---------- */
  var fundoGif = null;
  function tiraGif() { if (fundoGif) { fundoGif.remove(); fundoGif = null; } if (palco) palco.classList.remove("com-gif"); }
  function fechaDialogo() { if (dlg) { dlg.remove(); dlg = null; } if (palco) palco.classList.remove("dialogando"); tiraGif(); }
  function falar(falas, aoFim) {
    fechaDialogo();
    palco.classList.add("dialogando");   // os bonequinhos somem enquanto há conversa
    var i = 0;
    function passo() {
      var f = falas[i];
      if (!f) { fechaDialogo(); if (aoFim) aoFim(); return; }
      var antigo = dlg; dlg = el("div", { class: "dialogo", role: "group", "aria-label": "Diálogo" });
      var ret = f.quem ? GE.retrato(f.quem, f.ret) : null;
      if (ret) dlg.appendChild(el("img", { class: "dialogo-retrato", src: ret, alt: "" }));
      var ob = f.obj ? GE.objeto(f.obj) : null;
      if (ob) dlg.appendChild(el("img", { class: "dialogo-objeto", src: ob.arquivo, alt: ob.nome }));
      if (f.gif && !fundoGif) {   /* o gif vira o cenário e o texto fica discreto */
        fundoGif = el("img", { class: "fundo-gif", src: f.gif, alt: "A Estrela volta ao hall e é abraçada por Dona Helena" });
        palco.insertBefore(fundoGif, palco.firstChild.nextSibling); palco.classList.add("com-gif");
      }
      var nome = f.quem ? GE.pers(f.quem).nome : "Narração";
      var cx = el("div", { class: "dialogo-caixa" }, el("div", { class: "dialogo-nome", text: nome }),
        el("p", { class: "dialogo-texto " + (f.narra ? "narra" : "fala"), text: f.texto, "aria-live": "polite" }));
      if (f.escolhas) {
        cx.appendChild(el("div", { class: "escolhas" }, f.escolhas.map(function (c) {
          return el("button", { type: "button", disabled: !!c.feito, text: c.t, onclick: function () { c.acao(); } });
        })));
      } else {
        cx.appendChild(el("button", { class: "dialogo-prox", type: "button", text: i === falas.length - 1 ? "Fechar" : "Continuar", onclick: function () { i++; passo(); } }));
      }
      dlg.appendChild(cx); palco.appendChild(dlg);
      if (antigo) antigo.remove();
      var foco = dlg.querySelector("button:not([disabled])"); if (foco) foco.focus({ preventScroll: true });
    }
    passo();
  }

  /* ---------- capítulo 1 (roteiro do briefing; respostas curtas são provisórias) ---------- */
  function capitulo1() {
    estado.iniciou = true;
    if (camadaIntro) { camadaIntro.remove(); camadaIntro = null; }
    irPara("escritorio");
    var feito = {};
    function ronda() {
      falar([{ quem: "helena", ret: "aflita", texto: "Não sabemos exatamente. Acreditamos que tenha desaparecido entre 21h14 e 21h30.", escolhas: [
        { t: "Aceitar o caso", acao: aceitar },
        { t: "Perguntar quem estava no museu", feito: feito.quem, acao: function () { feito.quem = true; falar([{ quem: "helena", ret: "triste", texto: "O Seu Barros, o guarda. A Dra. Íris, a curadora. O Tião, do serviço de limpeza. E a Luiza, uma visitante." }], ronda); } },
        { t: "Perguntar sobre a Estrela", feito: feito.gata, acao: function () { feito.gata = true; falar([{ quem: "helena", ret: "chorando", texto: "A Estrela é a gata do museu. Ela não costuma sair do hall. Por favor, encontre-a." }], ronda); } }
      ] }]);
    }
    function aceitar() {
      falar([{ quem: "moraes", ret: "serio", texto: "Conte comigo, Dona Helena. Vou ao museu agora." }], function () {
        estado.missao = "Investigue o desaparecimento de Estrela.";
        irPara("hall");
      });
    }
    falar([
      { quem: "helena", ret: "chorando", texto: "Detetive Moraes? Graças a Deus! Preciso da sua ajuda! A Estrela desapareceu! Já procurei por todo lado!" },
      { quem: "moraes", ret: "serio", texto: "Acalme-se. Quando foi a última vez que alguém a viu?" }
    ], ronda);
  }

  /* ---------- cenas ---------- */
  function desenharHud() {
    if (mundo) [].forEach.call(mundo.querySelectorAll(".ator[data-conv]"), function (n) { n.classList.toggle("feito", feito(n.dataset.conv)); });
    GE.limpar(hud);
    function btn(id, rotulo, icone) {
      return el("button", { class: "hud-btn", type: "button", "aria-current": String(estado.cena === id), onclick: function () { if (camadaIntro) { camadaIntro.remove(); camadaIntro = null; } irPara(id); } }, GE.icone(icone), rotulo);
    }
    hud.appendChild(el("div", { class: "hud-botoes", role: "group", "aria-label": "Ir para" }, btn("escritorio", "Escritório", "livro"), btn("mapa", "Planta", "mapa")));
    hud.appendChild(el("div", { class: "placa cena" }, el("b", { text: estado.cena ? GE.CENAS[estado.cena].nome : "" }), el("small", { text: progresso() })));
  }

  function irPara(id) {
    var c = GE.CENAS[id]; if (!c) return;
    fechaDialogo();
    estado.cena = id;
    var img = GE.cenaImg(id);
    if (mundo) mundo.remove();
    mundo = el("div", { class: "mundo entra" });
    mundo.style.setProperty("--ar", img ? (img.w / img.h).toFixed(4) : "1.7778");
    if (img) mundo.appendChild(el("img", { class: "fundo", src: img.arquivo, alt: "Cenário: " + c.nome }));
    else mundo.appendChild(el("div", { class: "fundo", style: { background: "linear-gradient(180deg,#2A2130,#150F19)" } }));

    c.atores.forEach(function (a) {
      var sp = GE.sprite(a.p, a.dir); if (!sp) return;
      var estilo = { left: (a.x * 100) + "%", top: ((a.pe - a.h) * 100) + "%", height: (a.h * 100) + "%" };
      var n = el(a.conv ? "button" : "div", { class: "ator" + (a.conv ? " clicavel" : "") + (a.conv === "moraes" ? " resumo" : "") + (a.conv && feito(a.conv) ? " feito" : ""), style: estilo, type: a.conv ? "button" : null,
        "aria-label": a.conv ? (a.conv === "moraes" ? "Pedir um resumo ao " : "Falar com ") + a.nome : null, "data-conv": a.conv || null, onclick: a.conv ? function () { conversar(a.conv); } : null }, el("img", { src: sp.arquivo, alt: a.nome, draggable: "false" }), el("span", { class: "nome", text: a.nome }));
      mundo.appendChild(n);
    });
    c.pontos.filter(visivel).forEach(function (p) {
      var b = el("button", { class: "ponto" + (feito(p.id) ? " feito" : ""), type: "button", style: { left: p.x * 100 + "%", top: p.y * 100 + "%" }, "aria-label": p.rotulo,
        onclick: function () { usarPonto(p.id, b); } }, GE.icone(p.icone), el("span", { class: "rotulo", text: p.rotulo }));
      mundo.appendChild(b);
    });
    (c.pinos || []).forEach(function (p) {
      mundo.appendChild(el("button", { class: "pino", type: "button", style: { left: p.x * 100 + "%", top: p.y * 100 + "%" }, onclick: function () { irPara(p.cena); } }, GE.icone("pin"), p.rotulo));
    });
    palco.insertBefore(mundo, palco.firstChild);
    desenharHud();
    if (id === "mapa" && GE.estado.historico.indexOf("mapa") < 0) GE.disparar("mapa");
  }

  /* ---------- progresso e história adaptável ---------- */
  function temDep(pes) { return GE.estado.diario.depoimentos.some(function (d) { return d[0] === pes; }); }
  function temReg(pes, sala, min) { return GE.estado.diario.registros.some(function (r) { return r[0] === pes && r[1] === sala && r[2] === min; }); }
  function visivel(p) { return !p.requer || !!GE.estado.feitos[p.requer]; }
  function feito(id) { return !!GE.estado.feitos[id]; }
  function dispara(ev) { if (ev && GE.estado.historico.indexOf(ev) < 0) GE.disparar(ev); }
  function interacoesDe(cena) {
    var c = GE.CENAS[cena], v = [];
    c.pontos.filter(visivel).forEach(function (p) { v.push(p.id); });
    c.atores.forEach(function (a) { if (a.conv && a.conv !== "moraes") v.push(a.conv); });
    return v;
  }
  function pendentes(cena) { return interacoesDe(cena).filter(function (i) { return !feito(i); }); }
  function totalInter() { return ROTA.reduce(function (n, c) { return n + interacoesDe(c).length; }, 0); }
  function progresso() { return "Depoimentos " + GE.estado.diario.depoimentos.length + "/4 · Registros " + GE.estado.diario.registros.length + "/11"; }
  function proximaSala() { for (var i = 0; i < ROTA.length; i++) if (ROTA[i] !== estado.cena && pendentes(ROTA[i]).length) return ROTA[i]; return null; }

  /* contradição: aparece quando o jogador JÁ TEM o depoimento do guarda e o registro da câmera, em qualquer ordem */
  function checaContradicao() {
    if (temDep("guarda") && temReg("guarda", "galeria", 20) && GE.estado.historico.indexOf("contradicao") < 0) {
      dispara("contradicao");
      return [{ quem: "moraes", ret: "surpreso", texto: "Espere. O guarda disse que ficou no café, mas a câmera o registrou na galeria às 21h20. Alguém aqui está errado. Pelo menos a câmera não tem motivo para mentir.", narra: true }];
    }
    return [];
  }

  /* depois de cada interação: se a sala acabou, a história leva o detetive à próxima com pendências */
  function seguir() {
    desenharHud();
    if (pendentes(estado.cena).length || estado.cena === "mapa") return;
    var prox = proximaSala();
    if (prox) { falar([{ quem: "moraes", ret: "pensando", texto: "Por aqui já vi o que dava. Hora de ir para: " + GE.CENAS[prox].nome + ".", narra: true }], function () { irPara(prox); }); }
    else if (!estado.fim) { estado.fim = true; encerramento(); }
  }

  /* final: tudo foi investigado -> o guarda confessa a janela, a Estrela volta. A explicação da gata é história, não dedução. */
  function encerramento() {
    irPara("hall");
    falar([
      { quem: "moraes", ret: "serio", texto: "Seu Barros, a câmera o registrou na galeria às 21h20. O senhor disse que não saiu do café." },
      { quem: "barros", ret: "nervoso", texto: "Eu errei, detetive. Fui à galeria por um instante e abri uma janela para arejar. Fiquei com vergonha de contar." },
      { quem: "moraes", ret: "pensando", texto: feito("cameraHall") ? "Uma janela aberta e uma gata curiosa. A câmera do hall mostra a Estrela saindo por ela, sem pressa nenhuma. Isso explica o sumiço." : "Uma janela aberta e uma gata curiosa. Isso explica o sumiço." },
      { quem: "luiza", ret: "surpresa", texto: "Olhem! Ali, no peitoril!" },
      { quem: null, texto: "A Estrela voltou do seu passeio, olhou para todos como quem diz \"o que foi?\" e saltou direto para os braços de Dona Helena.", narra: true, gif: "assets/img/estrela-volta.gif" }
    ], function () { dispara("conclusao"); abrirFinal(); });
  }
  function abrirFinal() {
    var d = document.getElementById("final"), f1 = GE.final("helena-estrela"), f2 = GE.final("moraes-joinha");
    if (f1) { var i1 = d.querySelector("#final-img1"); i1.src = f1.arquivo; i1.alt = f1.nome; }
    if (f2) { var i2 = d.querySelector("#final-img2"); i2.src = f2.arquivo; i2.alt = f2.nome; }
    d.querySelector("#final-fechar").onclick = function () { d.close(); };
    d.querySelector("#final-diario").onclick = function () { d.close(); abrirDiario(); };
    d.querySelector("#final-denovo").onclick = function () { d.close(); GE.estado.historico = []; GE.estado.atual = null; GE.salvar(); GE.bus.emit("reiniciar"); irPara("escritorio"); };
    if (d.showModal) d.showModal();
  }

  function usarPonto(id, btn) {
    var d = PONTOS[id], novo = !feito(id);
    GE.estado.feitos[id] = true; btn.classList.add("feito");
    if (novo) guardaDiario(d.diario);
    var falas = [{ quem: "moraes", ret: d.ret, texto: typeof d.texto === "function" ? d.texto() : d.texto, narra: true, obj: d.obj }];
    if (novo) { dispara(d.evento); falas = falas.concat(checaContradicao()); }
    GE.salvar();
    falar(falas, seguir);
  }

  function resumoMoraes() {
    var d = GE.estado.diario, prox = proximaSala(), falas = [];
    var t = "Até agora: " + d.depoimentos.length + " de 4 depoimentos e " + d.registros.length + " de 11 registros.";
    t += prox ? " Ainda tem coisa por ver em: " + GE.CENAS[prox].nome + "." : (pendentes(estado.cena).length ? " Ainda tem coisa por ver aqui mesmo." : " Já vi tudo o que dava.");
    falas.push({ quem: "moraes", ret: "pensando", texto: t });
    falar(falas);
  }

  function conversar(id) {
    if (id === "moraes") return resumoMoraes();
    var c = CONVERSAS[id];
    function menu(abertura) {
      falar([{ quem: c.quem, ret: c.ret, texto: abertura, escolhas: c.opcoes.map(function (o, i) {
        return { t: o.t, feito: !!GE.estado.feitos[id + ":" + i], acao: function () { pergunta(o, i); } };
      }).concat([{ t: "Encerrar a conversa", acao: function () { fechaDialogo(); seguir(); } }]) }]);
    }
    function pergunta(o, i) {
      GE.estado.feitos[id + ":" + i] = true;
      var novo = false;
      if (o.dep && !temDep(o.dep[0])) { guardaDiario({ depoimentos: [o.dep] }); novo = true; }
      if (o.reg) { guardaDiario({ registros: o.reg, pistas: o.pista ? [o.pista] : [] }); novo = true; }
      if (o.dep || o.reg) GE.estado.feitos[id] = true;   // a conversa "rendeu" quando traz um dado novo
      if (novo) dispara(o.evento);
      GE.salvar();
      var falas = [{ quem: c.quem, ret: o.ret, texto: o.fala }];
      if (novo) falas = falas.concat(checaContradicao());
      if (o.camera) {
        GE.estado.feitos["camera-hall"] = true; GE.salvar();
        falas.push({ quem: "moraes", ret: "surpreso", texto: "Espere. Tem uma câmera no hall? Ninguém me contou isso. Vamos lá investigar agora mesmo!" });
        return falar(falas, function () { irPara("hall"); });
      }
      falar(falas, function () { desenharHud(); if (c.opcoes.every(function (x, j) { return GE.estado.feitos[id + ":" + j]; })) seguir(); else menu("Mais alguma pergunta?"); });
    }
    menu(c.abertura);
  }

  /* ---------- diário (livro aberto, texto sobre a imagem, setas para virar a página) ---------- */
  var dpos = 0;
  function hora(m) { return GE.hora(m); }
  function lista(itens, vazio) {
    return itens.length ? el("ul", { class: "folha-lista" }, itens.map(function (t) { return el("li", { text: t }); })) : el("p", { class: "folha-vazio", text: vazio });
  }
  function ordenaEventos() {
    var d = GE.estado.diario, ev = [];
    d.registros.forEach(function (r) { ev.push([r[2], "Registro: " + r[0] + " em " + GE.nomeSala(r[1]).toLowerCase() + ", " + hora(r[2])]); });
    d.depoimentos.forEach(function (x) { ev.push([x[2], "Depoimento: " + x[0] + " diz ter ficado em " + GE.nomeSala(x[1]).toLowerCase() + " de " + hora(x[2]) + " a " + hora(x[3])]); });
    return ev.sort(function (a, b) { return a[0] - b[0]; }).map(function (e) { return e[1]; });
  }
  function folhas() {
    var d = GE.estado.diario, P = GE.M.personagens;
    function cartaPers(p) {
      var r = p.retratos[0], s = r ? r.arquivo : (p.sprites.sentada || p.sprites.frente).arquivo;
      return el("figure", { class: "carta-pers" }, el("img", { src: s, alt: p.nome }), el("figcaption", null, el("b", { text: p.nome }), el("small", { text: p.papel })));
    }
    function F(titulo, filhos) { return el("div", null, el("h3", { text: titulo }), filhos); }
    return [
      F("Personagens", el("div", { class: "grade-pers" }, P.slice(0, 4).map(cartaPers))),
      F("Quem mais está no caso", el("div", { class: "grade-pers" }, P.slice(4).map(cartaPers))),
      F("Pistas", lista(d.pistas, "Nenhuma pista guardada ainda. Examine os pontos brilhantes das cenas.")),
      F("Objetos", GE.estado.diario.pistas.indexOf("Câmera da galeria") >= 0
        ? el("figure", { class: "carta-pers" }, el("img", { src: GE.objeto("camera").arquivo, alt: "Câmera da galeria" }), el("figcaption", null, el("b", { text: "Câmera da galeria" }), el("small", { text: "registrou o guarda às 21h20" })))
        : el("p", { class: "folha-vazio", text: "Os objetos que você examinar aparecem aqui." })),
      F("Depoimentos", lista(d.depoimentos.map(function (x) { return x[0] + ": " + GE.nomeSala(x[1]).toLowerCase() + ", de " + hora(x[2]) + " a " + hora(x[3]); }), "Nenhum depoimento anotado ainda. Converse com as pessoas.")),
      F("Sobre depoimentos", el("p", { class: "folha-texto", text: "Um depoimento é uma afirmação. Ainda não é prova: precisa ser confrontado com os registros confiáveis." })),
      F("Registros", lista(d.registros.map(function (r) { return r[0] + ": " + GE.nomeSala(r[1]).toLowerCase() + ", " + hora(r[2]); }), "Nenhum registro encontrado ainda.")),
      F("Sobre registros", el("p", { class: "folha-texto", text: "Registros vêm de câmeras e cartões de acesso. São fatos confiáveis: dizem quem, onde e quando." })),
      F("Linha do tempo", lista(ordenaEventos(), "A linha do tempo se monta sozinha com o que você encontrar.")),
      F("Como ler", el("p", { class: "folha-texto", text: "Os horários contam minutos depois das 21h. A janela do sumiço vai das 21h14 às 21h30." })),
      F("Deduções", el("p", { class: "folha-texto", text: "Quando você terminar de investigar, o painel Lógica em Ação mostra o que o motor concluiu a partir dos registros e depoimentos, com a prova." }))
    ];
  }
  function abrirDiario() {
    var d = document.getElementById("diario"), livro = d.querySelector(".livro"), fe = d.querySelector(".folha-e"), fd = d.querySelector(".folha-d"),
      ant = d.querySelector(".diario-ant"), prox = d.querySelector(".diario-prox"), cont = d.querySelector(".diario-cont"), fundo = d.querySelector(".livro-fundo");
    var mq = window.matchMedia("(max-width: 640px)"), fl = folhas();
    fundo.src = GE.objeto("diario-aberto").arquivo;
    function desenha(virou) {
      var uma = mq.matches, passo = uma ? 1 : 2;
      if (!uma) dpos -= dpos % 2;
      dpos = Math.max(0, Math.min(fl.length - 1, dpos));
      GE.limpar(fe); GE.limpar(fd);
      livro.dataset.modo = uma ? "uma" : "duas";
      livro.style.setProperty("--ox", dpos % 2 ? "80%" : "21%");
      fe.hidden = false; fd.hidden = uma ? true : false;
      if (uma) { (dpos % 2 ? fd : fe).hidden = false; (dpos % 2 ? fe : fd).hidden = true; (dpos % 2 ? fd : fe).appendChild(fl[dpos].cloneNode(true)); }
      else { fe.appendChild(fl[dpos].cloneNode(true)); if (fl[dpos + 1]) fd.appendChild(fl[dpos + 1].cloneNode(true)); }
      ant.disabled = dpos <= 0; prox.disabled = dpos + passo >= fl.length;
      cont.textContent = uma ? "Página " + (dpos + 1) + " de " + fl.length : "Páginas " + (dpos + 1) + " e " + (dpos + 2) + " de " + fl.length;
      if (virou) { livro.classList.remove("vira"); void livro.offsetWidth; livro.classList.add("vira"); }
    }
    ant.onclick = function () { dpos -= mq.matches ? 1 : 2; desenha(true); };
    prox.onclick = function () { dpos += mq.matches ? 1 : 2; desenha(true); };
    d.onkeydown = function (e) { if (e.key === "ArrowLeft" && !ant.disabled) ant.click(); if (e.key === "ArrowRight" && !prox.disabled) prox.click(); };
    d.querySelector(".diario-fechar").onclick = function () { d.close(); };
    mq.onchange = function () { desenha(false); };
    desenha(false);
    if (d.showModal) d.showModal();
  }

  /* ---------- montagem ---------- */
  GE.palco = {
    iniciar: function (alvo) {
      GE.limpar(alvo);
      palco = el("div", { class: "palco", role: "region", "aria-label": "Cena do jogo", tabindex: "-1" });
      hud = el("div", { class: "hud" });
      palco.appendChild(hud);
      camadaIntro = el("div", { class: "palco-camada" }, el("div", { class: "cartao-cap" },
        el("h3", { text: "Capítulo 1: o chamado" }),
        el("p", { text: "Dona Helena, diretora do museu, liga para o Detetive Moraes: a gata Estrela sumiu." }),
        el("button", { class: "botao", type: "button", id: "btn-comecar", text: "Começar investigação", onclick: capitulo1 }),
        el("p", { class: "nota", text: "Use os botões Escritório e Planta, no alto da cena, para visitar as salas, e converse com as pessoas na ordem que quiser." })));
      palco.appendChild(camadaIntro);
      var moldura = el("div", { class: "moldura" }, palco);
      ["c1", "c2", "c3", "c4"].forEach(function (c) { moldura.appendChild(el("span", { class: "canto " + c, html: GE.ICONES.estrela, "aria-hidden": "true" })); });
      var icone = GE.objeto("diario-fechado");
      var bancada = el("div", { class: "bancada" },
        el("span", { class: "titulo", text: "Bancada" }),
        el("button", { class: "botao com-icone", type: "button", onclick: abrirDiario }, icone ? el("img", { src: icone.arquivo, alt: "" }) : null, "Abrir diário"),
        el("button", { class: "botao secundario", type: "button", text: "Painel: resolução SLD", onclick: function () { GE.disparar("prova"); } }),
        el("button", { class: "botao secundario", type: "button", text: "Painel: SAT", onclick: function () { GE.disparar("sat"); } }),
        el("button", { class: "botao secundario", type: "button", text: "Painel: conclusão", onclick: function () { GE.disparar("conclusao"); } }),
        el("button", { class: "botao secundario", type: "button", text: "Ver o final do caso", onclick: function () { if (camadaIntro) { camadaIntro.remove(); camadaIntro = null; } encerramento(); } }),
        el("span", { class: "teclas" }, el("kbd", { text: "Tab" }), " navegar ", el("kbd", { text: "Enter" }), " agir ", el("kbd", { text: "Esc" }), " fechar"));
      alvo.appendChild(moldura); alvo.appendChild(bancada);
      irPara("escritorio");
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && dlg) fechaDialogo(); });
      GE.bus.on("reiniciar", function () { GE.estado.feitos = {}; estado.fim = false; GE.estado.diario = { pistas: [], depoimentos: [], registros: [] }; GE.salvar(); irPara(estado.cena); });
    },
    comecar: function () { if (camadaIntro && !estado.iniciou) capitulo1(); }
  };
})();
