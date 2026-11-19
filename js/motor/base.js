/* M2 (JS) — base de conhecimento: fatos a partir do JSON + regras (as mesmas de motor/base.py, via regras.js). */
(function (root) {
  "use strict";
  const GE = (root.GE = root.GE || {});
  const M = GE.M;

  function atomoSeguro(nome) {
    let s = String(nome).normalize("NFKD").replace(/[^\x00-\x7f]/g, "").toLowerCase();
    s = s.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "x";
    return /^[a-z]/.test(s) ? s : "n_" + s;
  }
  class CasoInvalido extends Error {}

  function validar(caso) {
    if (!caso || typeof caso !== "object" || Array.isArray(caso)) throw new CasoInvalido("o arquivo precisa ser um objeto JSON");
    for (const ch of ["corredores", "local_do_crime", "janela", "registros", "depoimentos"])
      if (!(ch in caso)) throw new CasoInvalido("falta o campo '" + ch + "'");
    const inteiro = (v, onde) => {
      if (!Number.isInteger(v)) throw new CasoInvalido(onde + ": esperava um número inteiro de minutos, veio " + JSON.stringify(v));
      return v;
    };
    const salas = new Set();
    caso.corredores.forEach((c, i) => {
      if (!(Array.isArray(c) && c.length === 3)) throw new CasoInvalido("corredor " + (i + 1) + ": use [sala, sala, minutos]");
      if (inteiro(c[2], "corredor " + (i + 1)) <= 0) throw new CasoInvalido("corredor " + (i + 1) + ": o tempo precisa ser positivo");
      salas.add(String(c[0])); salas.add(String(c[1]));
    });
    if (!caso.corredores.length) throw new CasoInvalido("o mapa não tem corredores");
    if (!salas.has(String(caso.local_do_crime))) throw new CasoInvalido("local_do_crime '" + caso.local_do_crime + "' não aparece no mapa");
    const j = caso.janela;
    if (!(Array.isArray(j) && j.length === 2)) throw new CasoInvalido("janela: use [início, fim]");
    if (inteiro(j[0], "janela") > inteiro(j[1], "janela")) throw new CasoInvalido("janela: o início é depois do fim");
    caso.registros.forEach((r, i) => {
      if (!(Array.isArray(r) && (r.length === 3 || r.length === 4))) throw new CasoInvalido("registro " + (i + 1) + ": use [pessoa, sala, minuto, fonte] (a fonte é opcional)");
      if (r.length === 4 && typeof r[3] !== "string") throw new CasoInvalido("registro " + (i + 1) + ": a fonte precisa ser um texto (ex.: \"câmera\")");
      inteiro(r[2], "registro " + (i + 1));
      if (!salas.has(String(r[1]))) throw new CasoInvalido("registro " + (i + 1) + ": sala '" + r[1] + "' não está no mapa");
    });
    (caso.avistamentos || []).forEach((a, i) => {
      if (!(Array.isArray(a) && (a.length === 3 || a.length === 4))) throw new CasoInvalido("avistamento " + (i + 1) + ": use [objeto, sala, minuto, fonte] (a fonte é opcional)");
      inteiro(a[2], "avistamento " + (i + 1));
      if (!salas.has(String(a[1]))) throw new CasoInvalido("avistamento " + (i + 1) + ": sala '" + a[1] + "' não está no mapa");
    });
    caso.depoimentos.forEach((d, i) => {
      if (!(Array.isArray(d) && d.length === 4)) throw new CasoInvalido("depoimento " + (i + 1) + ": use [pessoa, sala, de, até]");
      inteiro(d[2], "depoimento " + (i + 1)); inteiro(d[3], "depoimento " + (i + 1));
      if (d[2] > d[3]) throw new CasoInvalido("depoimento " + (i + 1) + ": o início é depois do fim");
      if (!salas.has(String(d[1]))) throw new CasoInvalido("depoimento " + (i + 1) + ": sala '" + d[1] + "' não está no mapa");
    });
    return caso;
  }
  function pessoasDo(caso) {
    const o = [];
    for (const r of caso.registros) if (!o.includes(r[0])) o.push(r[0]);
    for (const d of caso.depoimentos) if (!o.includes(d[0])) o.push(d[0]);
    return o;
  }
  function salasDo(caso) {
    const o = [];
    for (const c of caso.corredores) for (const s of c.slice(0, 2)) if (!o.includes(s)) o.push(s);
    return o;
  }
  function fatosTexto(caso) {
    const a = atomoSeguro, L = [];
    pessoasDo(caso).forEach((p) => L.push("pessoa(" + a(p) + ")."));
    salasDo(caso).forEach((s) => L.push("sala(" + a(s) + ")."));
    caso.corredores.forEach(([x, y, d]) => L.push("corredor(" + a(x) + ", " + a(y) + ", " + d + ")."));
    L.push("local_crime(" + a(caso.local_do_crime) + ").");
    L.push("janela(" + caso.janela[0] + ", " + caso.janela[1] + ").");
    caso.registros.forEach((r) => { const [p, s, t] = r; L.push("registro(" + a(p) + ", " + a(s) + ", " + t + ")."); if (r.length === 4) L.push("fonte(" + a(p) + ", " + a(s) + ", " + t + ", " + a(r[3]) + ")."); });
    (caso.avistamentos || []).forEach((av) => L.push("avistamento(" + a(av[0]) + ", " + a(av[1]) + ", " + av[2] + ", " + (av.length === 4 ? a(av[3]) : "desconhecida") + ")."));
    caso.depoimentos.forEach(([p, s, de, ate]) => L.push("depoimento(" + a(p) + ", " + a(s) + ", " + de + ", " + ate + ")."));
    return L.join("\n") + "\n";
  }
  const programaTexto = (caso) => "% Fatos do caso\n" + fatosTexto(caso) + "\n% Regras gerais\n" + M.REGRAS;
  const clausulas = (caso) => M.lerPrograma(programaTexto(caso));
  function nomesDeExibicao(caso) {
    const m = {};
    for (const x of [...pessoasDo(caso), ...salasDo(caso)]) m[atomoSeguro(x)] = x;
    return m;
  }
  Object.assign(M, { atomoSeguro, CasoInvalido, validar, pessoasDo, salasDo, fatosTexto, programaTexto, clausulas, nomesDeExibicao });
})(typeof window !== "undefined" ? window : globalThis);
