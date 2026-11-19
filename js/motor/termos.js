/* M3 (JS) — termos, unificação com verificação de ocorrência, composição e leitor de cláusulas.
 * Port fiel de motor/termos.py (a versão em Python é a canônica; a paridade é testada em tests/test_paridade_js.py). */
(function (root) {
  "use strict";
  const GE = (root.GE = root.GE || {});
  const M = (GE.M = GE.M || {});
  let contador = 1;

  class Var { constructor(nome = "_") { this.nome = nome; this.uid = contador++; } }
  class Comp { constructor(f, args = []) { this.f = f; this.args = args; } }
  const NIL = new Comp("[]");
  const ehVar = (t) => t instanceof Var;
  const ehComp = (t) => t instanceof Comp;
  const iguaisFolha = (a, b) => (ehComp(a) && ehComp(b) && a.f === b.f && a.args.length === 0 && b.args.length === 0);

  function lista(itens, cauda = NIL) {
    let r = cauda;
    for (let i = itens.length - 1; i >= 0; i--) r = new Comp(".", [itens[i], r]);
    return r;
  }
  function caminhar(t, s) { while (ehVar(t) && s.has(t)) t = s.get(t); return t; }
  function aplicar(t, s) {
    t = caminhar(t, s);
    if (ehComp(t) && t.args.length) return new Comp(t.f, t.args.map((a) => aplicar(a, s)));
    return t;
  }
  function ocorre(v, t, s) {
    t = caminhar(t, s);
    if (ehVar(t)) return t === v;
    if (ehComp(t)) return t.args.some((a) => ocorre(v, a, s));
    return false;
  }
  function unificar(a, b, s) {
    a = caminhar(a, s); b = caminhar(b, s);
    if (ehVar(a) && ehVar(b) && a === b) return s;
    if (ehVar(a)) { if (ocorre(a, b, s)) return null; const r = new Map(s); r.set(a, b); return r; }
    if (ehVar(b)) return unificar(b, a, s);
    if (ehComp(a) && ehComp(b)) {
      if (a.f !== b.f || a.args.length !== b.args.length) return null;
      for (let i = 0; i < a.args.length; i++) { s = unificar(a.args[i], b.args[i], s); if (s === null) return null; }
      return s;
    }
    return (typeof a === "number" && typeof b === "number" && a === b) ? s : null;
  }
  function compor(s1, s2) {
    const r = new Map();
    for (const [v, t] of s1) r.set(v, aplicar(t, s2));
    for (const [v, t] of s2) if (!r.has(v)) r.set(v, t);
    for (const [v, t] of [...r]) if (t === v) r.delete(v);
    return r;
  }
  function variaveis(t, acc = []) {
    if (ehVar(t)) { if (!acc.includes(t)) acc.push(t); }
    else if (ehComp(t)) t.args.forEach((a) => variaveis(a, acc));
    return acc;
  }
  function renomear(t, mapa) {
    if (ehVar(t)) { if (!mapa.has(t)) mapa.set(t, new Var(t.nome)); return mapa.get(t); }
    if (ehComp(t) && t.args.length) return new Comp(t.f, t.args.map((a) => renomear(a, mapa)));
    return t;
  }
  function variante(a, b) {
    const m1 = new Map(), m2 = new Map();
    function r(x, y) {
      if (ehVar(x) && ehVar(y)) {
        if (!m1.has(x)) m1.set(x, y);
        if (!m2.has(y)) m2.set(y, x);
        return m1.get(x) === y && m2.get(y) === x;
      }
      if (ehComp(x) && ehComp(y)) return x.f === y.f && x.args.length === y.args.length && x.args.every((p, i) => r(p, y.args[i]));
      if (ehVar(x) || ehVar(y) || ehComp(x) || ehComp(y)) return false;
      return x === y;
    }
    return r(a, b);
  }

  const OPS = new Set(["is", "<", ">", "=<", ">=", "=:=", "=\\=", "=", "\\=", "+", "-", "*"]);
  function formatar(t, s) {
    if (s && s.size) t = aplicar(t, s);
    if (ehVar(t)) return t.nome !== "_" ? t.nome : "_G" + t.uid;
    if (typeof t === "number") return String(t);
    if (t.f === "[]" && !t.args.length) return "[]";
    if (t.f === "." && t.args.length === 2) {
      const itens = []; let c = t;
      while (ehComp(c) && c.f === "." && c.args.length === 2) { itens.push(formatar(c.args[0])); c = c.args[1]; }
      const fim = (ehComp(c) && c.f === "[]" && !c.args.length) ? "" : "|" + formatar(c);
      return "[" + itens.join(",") + fim + "]";
    }
    if (t.f === "\\+" && t.args.length === 1) return "\\+ " + formatar(t.args[0]);
    if (OPS.has(t.f) && t.args.length === 2) return formatar(t.args[0]) + " " + t.f + " " + formatar(t.args[1]);
    if (!t.args.length) return /^[a-z][A-Za-z0-9_]*$/.test(t.f) ? t.f : "'" + t.f + "'";
    return t.f + "(" + t.args.map((a) => formatar(a)).join(", ") + ")";
  }

  class Clausula { constructor(cabeca, corpo = []) { this.cabeca = cabeca; this.corpo = corpo; } }

  // ------------------------------------------------------------------ leitor
  const TOK = /\s*(?:(%[^\n]*)|(\d+)|([A-Za-z_][A-Za-z0-9_]*)|'([^']*)'|(:-|\\\+|=\\=|=:=|=<|>=|\\=|[()\[\],.|<>=+\-*]))/y;
  function tokens(txt) {
    let pos = 0; const out = [];
    while (pos < txt.length) {
      if (!txt.slice(pos).trim()) break;
      TOK.lastIndex = pos;
      const m = TOK.exec(txt);
      if (!m) throw new Error("símbolo inesperado perto de: " + txt.slice(pos, pos + 20).trim());
      pos = TOK.lastIndex;
      const [, com, num, ident, quo, pont] = m;
      if (com) continue;
      if (num !== undefined) out.push(["n", parseInt(num, 10)]);
      else if (ident !== undefined) out.push([/[A-Z_]/.test(ident[0]) ? "v" : "a", ident]);
      else if (quo !== undefined) out.push(["a", quo]);
      else out.push(["p", pont]);
    }
    return out;
  }
  const TAB = { "is": 700, "<": 700, ">": 700, "=<": 700, ">=": 700, "=:=": 700, "=\\=": 700, "=": 700, "\\=": 700, "+": 500, "-": 500, "*": 400 };
  class Leitor {
    constructor(toks) { this.t = toks; this.i = 0; this.vars = new Map(); }
    ver() { return this.i < this.t.length ? this.t[this.i] : ["fim", null]; }
    comer(tipo, val) {
      const k = this.ver();
      if ((tipo && k[0] !== tipo) || (val !== undefined && k[1] !== val)) throw new Error("esperava " + (val || tipo) + ", achei " + JSON.stringify(k[1]));
      this.i++; return k;
    }
    eh(tipo, val) { const k = this.ver(); return k[0] === tipo && k[1] === val; }
    termo(prec = 1200) {
      let esq = this.primario();
      for (;;) {
        const k = this.ver();
        const op = (k[0] === "p" || k[0] === "a") ? k[1] : null;
        if (op !== null && Object.prototype.hasOwnProperty.call(TAB, op) && TAB[op] <= prec && !(k[0] === "a" && op !== "is")) {
          this.i++;
          const dir = this.termo(TAB[op] - 1);
          esq = new Comp(op, [esq, dir]);
        } else return esq;
      }
    }
    primario() {
      const k = this.ver();
      if (this.eh("p", "\\+")) { this.i++; return new Comp("\\+", [this.termo(699)]); }
      if (k[0] === "n") { this.i++; return k[1]; }
      if (this.eh("p", "-") && this.t[this.i + 1] && this.t[this.i + 1][0] === "n") { this.i += 2; return -this.t[this.i - 1][1]; }
      if (this.eh("p", "(")) { this.i++; const r = this.termo(); this.comer("p", ")"); return r; }
      if (this.eh("p", "[")) {
        this.i++;
        if (this.eh("p", "]")) { this.i++; return NIL; }
        const itens = [this.termo(999)];
        while (this.eh("p", ",")) { this.i++; itens.push(this.termo(999)); }
        let cauda = NIL;
        if (this.eh("p", "|")) { this.i++; cauda = this.termo(999); }
        this.comer("p", "]");
        return lista(itens, cauda);
      }
      if (k[0] === "v") {
        this.i++;
        if (k[1] === "_") return new Var("_");
        if (!this.vars.has(k[1])) this.vars.set(k[1], new Var(k[1]));
        return this.vars.get(k[1]);
      }
      if (k[0] === "a") {
        this.i++;
        if (this.eh("p", "(")) {
          this.i++;
          const args = [this.termo(999)];
          while (this.eh("p", ",")) { this.i++; args.push(this.termo(999)); }
          this.comer("p", ")");
          return new Comp(k[1], args);
        }
        return new Comp(k[1]);
      }
      throw new Error("termo inesperado: " + JSON.stringify(k[1]));
    }
    corpo() {
      const gs = [this.termo(999)];
      while (this.eh("p", ",")) { this.i++; gs.push(this.termo(999)); }
      return gs;
    }
  }
  function lerObjetivos(txt) {
    const L = new Leitor(tokens(txt.trim().replace(/\.$/, "")));
    const g = L.corpo();
    if (L.i !== L.t.length) throw new Error("sobrou texto: " + L.t[L.i][1]);
    return [g, L.vars];
  }
  function lerTermo(txt) {
    const L = new Leitor(tokens(txt.trim().replace(/\.$/, "")));
    const t = L.termo();
    if (L.i !== L.t.length) throw new Error("sobrou texto: " + L.t[L.i][1]);
    return [t, L.vars];
  }
  function lerPrograma(txt) {
    const toks = tokens(txt), partes = []; let atual = [];
    for (const k of toks) { if (k[0] === "p" && k[1] === ".") { partes.push(atual); atual = []; } else atual.push(k); }
    if (atual.length) throw new Error("cláusula sem ponto final");
    return partes.map((p) => {
      const L = new Leitor(p);
      const cab = L.termo(999);
      let corpo = [];
      if (L.eh("p", ":-")) { L.i++; corpo = L.corpo(); }
      if (L.i !== p.length) throw new Error("cláusula mal formada");
      return new Clausula(cab, corpo);
    });
  }

  Object.assign(M, { Var, Comp, NIL, Clausula, lista, caminhar, aplicar, compor, ocorre, unificar, variaveis, renomear,
    variante, formatar, lerObjetivos, lerTermo, lerPrograma, ehVar, ehComp });
})(typeof window !== "undefined" ? window : globalThis);
