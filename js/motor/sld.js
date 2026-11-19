/* M3 (JS) — resolução SLD + meta-interpretador. Port fiel de motor/sld.py. */
(function (root) {
  "use strict";
  const GE = (root.GE = root.GE || {});
  const M = GE.M;
  const { Comp, Var, NIL, caminhar, aplicar, unificar, renomear, variante, formatar, lista } = M;
  const COMPARACOES = new Set(["<", ">", "=<", ">=", "=:=", "=\\="]);

  class ErroDeMotor extends Error {}

  function avaliar(t, s) {
    t = caminhar(t, s);
    if (typeof t === "number") return t;
    if (t instanceof Var) throw new ErroDeMotor("variável sem valor numa expressão aritmética");
    if (t instanceof Comp) {
      if (t.args.length === 2 && ["+", "-", "*", "max", "min"].includes(t.f)) {
        const a = avaliar(t.args[0], s), b = avaliar(t.args[1], s);
        return { "+": a + b, "-": a - b, "*": a * b, "max": Math.max(a, b), "min": Math.min(a, b) }[t.f];
      }
      if (t.args.length === 1 && t.f === "abs") return Math.abs(avaliar(t.args[0], s));
    }
    throw new ErroDeMotor("expressão aritmética inválida: " + formatar(t, s));
  }
  function itens(l, s) {
    const out = []; l = caminhar(l, s);
    while (l instanceof Comp && l.f === "." && l.args.length === 2) { out.push(aplicar(l.args[0], s)); l = caminhar(l.args[1], s); }
    if (!(l instanceof Comp && l.f === "[]")) throw new ErroDeMotor("lista incompleta");
    return out;
  }
  const reprClausula = (c) => (formatar(c.cabeca) + " :- " + c.corpo.map((x) => formatar(x)).join(", ") + ".").replace(/_G\d+/g, "_");

  class Motor {
    constructor(clausulas, limite = 300, maxInf = 2000000) {
      this.limite = limite; this.maxInf = maxInf; this.indice = new Map();
      for (const c of clausulas) {
        const k = c.cabeca.f + "/" + c.cabeca.args.length;
        if (!this.indice.has(k)) this.indice.set(k, []);
        this.indice.get(k).push(c);
      }
      this.inferencias = 0; this.limiteAtingido = false; this.lacosCortados = 0;
      this.trace = null;      // quando for um array, registra as chamadas (para o passo a passo)
    }
    *resolver(objetivos, s) { yield* this._conj([...objetivos], s || new Map(), 0, []); }
    prova(objetivo) { for (const [s, provas] of this.resolver([objetivo])) return [s, provas[0]]; return null; }

    *_conj(goals, s, prof, anc) {
      if (!goals.length) { yield [s, []]; return; }
      const g = goals[0], resto = goals.slice(1);
      for (const [s1, no] of this._um(g, s, prof, anc))
        for (const [s2, nos] of this._conj(resto, s1, prof, anc)) yield [s2, [no, ...nos]];
    }
    _no(g, s, regra, filhos, m) { return { _g: g, _s: s, _regra: regra, _m: m || null, filhos }; }

    *_um(g, s, prof, anc) {
      g = caminhar(g, s);
      if (g instanceof Var) throw new ErroDeMotor("objetivo é uma variável livre");
      if (typeof g === "number") throw new ErroDeMotor("objetivo inválido");
      if (++this.inferencias > this.maxInf) throw new ErroDeMotor("excedeu o máximo de inferências");
      const f = g.f, n = g.args.length;
      if (this.trace) this.trace.push({ tipo: "chamada", prof, objetivo: formatar(g, s) });
      if (f === "is" && n === 2) {
        const v = avaliar(g.args[1], s); const s2 = unificar(g.args[0], v, s);
        if (s2) yield [s2, this._no(g, s2, "embutido: is/2 (avalia a expressão)", [])]; return;
      }
      if (COMPARACOES.has(f) && n === 2) {
        const a = avaliar(g.args[0], s), b = avaliar(g.args[1], s);
        const ok = { "<": a < b, ">": a > b, "=<": a <= b, ">=": a >= b, "=:=": a === b, "=\\=": a !== b }[f];
        if (ok) yield [s, this._no(g, s, "embutido: comparação " + f, [])]; return;
      }
      if (f === "=" && n === 2) {
        const s2 = unificar(g.args[0], g.args[1], s);
        if (s2) yield [s2, this._no(g, s2, "embutido: unificação", [])]; return;
      }
      if (f === "\\=" && n === 2) {
        if (unificar(g.args[0], g.args[1], s) === null) yield [s, this._no(g, s, "embutido: não unifica", [])]; return;
      }
      if (f === "\\+" && n === 1) {
        for (const _ of this._um(g.args[0], s, prof + 1, anc)) return;
        yield [s, this._no(g, s, "negação por falha: o objetivo interno não tem prova", [])]; return;
      }
      if (f === "findall" && n === 3) {
        const achados = []; for (const [s2] of this._um(g.args[1], s, prof + 1, anc)) achados.push(aplicar(g.args[0], s2));
        const s2 = unificar(g.args[2], lista(achados), s);
        if (s2) yield [s2, this._no(g, s2, "embutido: findall/3 (coleta todas as soluções)", [])]; return;
      }
      if ((f === "min_list" || f === "max_list") && n === 2) {
        const xs = itens(g.args[0], s).map((x) => avaliar(x, s));
        if (xs.length) {
          const s2 = unificar(g.args[1], f === "min_list" ? Math.min(...xs) : Math.max(...xs), s);
          if (s2) yield [s2, this._no(g, s2, "embutido: " + f + "/2", [])];
        }
        return;
      }
      if (prof >= this.limite) { this.limiteAtingido = true; return; }
      for (const a of anc) if (variante(aplicar(g, s), a)) { this.lacosCortados++; return; }
      const anc2 = [...anc, aplicar(g, s)];
      for (const c of this.indice.get(f + "/" + n) || []) {
        const m = new Map();
        const cab = renomear(c.cabeca, m);
        const s1 = unificar(g, cab, s);
        if (s1 === null) continue;
        const corpo = c.corpo.map((x) => renomear(x, m));
        for (const [s2, filhos] of this._conj(corpo, s1, prof + 1, anc2)) yield [s2, this._no(g, s2, c, filhos, m)];
      }
    }
  }

  function exportar(no, sFinal) {
    const s = sFinal || no._s;
    const obj = formatar(aplicar(no._g, s));
    const r = no._regra; let regra, tipo;
    if (typeof r === "string") { regra = r; tipo = "embutido"; }
    else if (r.corpo.length) { regra = reprClausula(r); tipo = "regra"; }
    else { regra = "fato"; tipo = "fato"; }
    const uni = {};
    if (no._m) for (const [vo, vn] of no._m) { const val = aplicar(vn, s); if (vo.nome !== "_" && !(val instanceof Var)) uni[vo.nome] = formatar(val); }
    return { objetivo: obj, tipo, regra, unificador: uni, filhos: no.filhos.map((f) => exportar(f, s)) };
  }

  Object.assign(M, { Motor, ErroDeMotor, exportar, avaliar });
})(typeof window !== "undefined" ? window : globalThis);
