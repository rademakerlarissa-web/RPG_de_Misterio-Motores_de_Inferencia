/* M4 (JS) — SAT: CNF + DPLL com propagação unitária. Port fiel de motor/sat.py (mesma ordem de decisão). */
(function (root) {
  "use strict";
  const GE = (root.GE = root.GE || {});
  const M = GE.M;
  const TRANSITO = "transito";

  function distancias(caso) {
    const salas = [];
    for (const [a, b] of caso.corredores) for (const s of [a, b]) if (!salas.includes(s)) salas.push(s);
    const d = new Map(); const k = (a, b) => a + "\u0000" + b;
    for (const a of salas) for (const b of salas) d.set(k(a, b), a === b ? 0 : Infinity);
    for (const [a, b, w] of caso.corredores) { d.set(k(a, b), Math.min(d.get(k(a, b)), w)); d.set(k(b, a), Math.min(d.get(k(b, a)), w)); }
    for (const x of salas) for (const i of salas) for (const j of salas)
      if (d.get(k(i, x)) + d.get(k(x, j)) < d.get(k(i, j))) d.set(k(i, j), d.get(k(i, x)) + d.get(k(x, j)));
    return { salas, dist: (a, b) => d.get(k(a, b)) };
  }
  function horizonte(caso) {
    const ts = [caso.janela[0], caso.janela[1], 0];
    caso.registros.forEach((r) => ts.push(r[2]));
    caso.depoimentos.forEach((d) => ts.push(d[2], d[3]));
    return [Math.min(...ts), Math.max(...ts)];
  }

  class Solver {
    constructor(nvars, clausulas) {
      this.n = nvars; this.cl = clausulas.map((c) => [...c]);
      this.val = new Array(nvars + 1).fill(0);
      this.occ = new Map();
      this.cl.forEach((c, i) => c.forEach((l) => { if (!this.occ.has(l)) this.occ.set(l, []); this.occ.get(l).push(i); }));
      this.sat = new Array(this.cl.length).fill(0);
      this.livres = this.cl.map((c) => c.length);
      this.trilha = []; this.fila = [];
      this.stats = { decisoes: 0, propagacoes: 0, conflitos: 0 };
      const o = (l) => (this.occ.get(l) || []).length;
      this.ordem = Array.from({ length: nvars }, (_, i) => i + 1).sort((a, b) => (-o(a) - o(-a)) - (-o(b) - o(-b)));
      this.ok = true;
      for (const c of this.cl) { if (!c.length) this.ok = false; else if (c.length === 1) this.fila.push(c[0]); }
      this.ok = this.ok && this._propagar();
    }
    _valor(l) { const v = this.val[Math.abs(l)]; return l > 0 ? v : -v; }
    _atribuir(l) {
      const v = this._valor(l);
      if (v === 1) return true;
      if (v === -1) return false;
      this.val[Math.abs(l)] = l > 0 ? 1 : -1;
      this.trilha.push(l); this.stats.propagacoes++;
      for (const c of this.occ.get(l) || []) { this.sat[c]++; this.livres[c]--; }
      let conflito = false;
      for (const c of this.occ.get(-l) || []) {
        this.livres[c]--;
        if (this.sat[c] === 0) {
          if (this.livres[c] === 0) conflito = true;
          else if (this.livres[c] === 1) { for (const m of this.cl[c]) if (this.val[Math.abs(m)] === 0) { this.fila.push(m); break; } }
        }
      }
      return !conflito;
    }
    _propagar() {
      while (this.fila.length) {
        const l = this.fila.pop();
        if (!this._atribuir(l)) { this.fila.length = 0; this.stats.conflitos++; return false; }
      }
      return true;
    }
    desfazer(ate) {
      while (this.trilha.length > ate) {
        const l = this.trilha.pop(); this.val[Math.abs(l)] = 0;
        for (const c of this.occ.get(l) || []) { this.sat[c]--; this.livres[c]++; }
        for (const c of this.occ.get(-l) || []) this.livres[c]++;
      }
      this.fila.length = 0;
    }
    supor(l) {
      const marca = this.trilha.length; this.fila.push(l);
      if (this._propagar()) return true;
      this.desfazer(marca); return false;
    }
    resolver() {
      if (!this.ok) return false;
      const base = this.trilha.length, pilha = [];
      for (;;) {
        const v = this.ordem.find((x) => this.val[x] === 0);
        if (v === undefined) return true;
        this.stats.decisoes++;
        pilha.push([this.trilha.length, v, true]);
        this.fila.push(v);
        let ok = this._propagar();
        while (!ok) {
          while (pilha.length && !pilha[pilha.length - 1][2]) pilha.pop();
          if (!pilha.length) { this.desfazer(base); return false; }
          const [marca, vv] = pilha.pop();
          this.desfazer(marca);
          pilha.push([marca, vv, false]);
          this.fila.push(-vv);
          ok = this._propagar();
        }
      }
    }
    resolverEDesfazer() {
      const marca = this.trilha.length, r = this.resolver();
      const modelo = r ? [...this.val] : null;
      this.desfazer(marca);
      return [r, modelo];
    }
  }

  class Codificacao {
    constructor(caso, pessoa) {
      this.caso = caso; this.pessoa = pessoa;
      const D = distancias(caso); this.salas = D.salas; this.dist = D.dist;
      [this.tmin, this.tmax] = horizonte(caso);
      this.locais = [...this.salas, TRANSITO];
      this.idx = new Map(); this.nome = new Map();
      for (let t = this.tmin; t <= this.tmax; t++) for (const s of this.locais) {
        const n = this.idx.size + 1; this.idx.set(s + "@" + t, n);
        this.nome.set(n, "x(" + M.atomoSeguro(pessoa) + "," + M.atomoSeguro(s) + "," + t + ")");
      }
      this.estrutura = []; this._estrutura();
      this.itens = new Map();
      for (const [p, s, t] of caso.registros) if (p === pessoa) this.itens.set("registro: " + s + " no minuto " + t, [[this.x(s, t)]]);
    }
    get nvars() { return this.idx.size; }
    x(s, t) { return this.idx.get(s + "@" + t); }
    _estrutura() {
      const E = this.estrutura;
      for (let t = this.tmin; t <= this.tmax; t++) {
        E.push(this.locais.map((s) => this.x(s, t)));
        for (let i = 0; i < this.locais.length; i++) for (let j = i + 1; j < this.locais.length; j++)
          E.push([-this.x(this.locais[i], t), -this.x(this.locais[j], t)]);
      }
      for (const a of this.salas) for (const b of this.salas) {
        const d = this.dist(a, b);
        if (a === b || d === Infinity) {
          if (d === Infinity) for (let t = this.tmin; t <= this.tmax; t++) for (let t2 = t + 1; t2 <= this.tmax; t2++) E.push([-this.x(a, t), -this.x(b, t2)]);
          continue;
        }
        for (let t = this.tmin; t <= this.tmax; t++) for (let t2 = t + 1; t2 < Math.min(t + d, this.tmax + 1); t2++) E.push([-this.x(a, t), -this.x(b, t2)]);
      }
    }
    depoimento(s, de, ate) { const o = []; for (let t = de; t <= ate; t++) o.push([this.x(s, t)]); return o; }
    clausulas(itens, extras = []) {
      const C = [...this.estrutura];
      for (const [nome, cs] of (itens || this.itens)) C.push(...cs);
      extras.forEach((c) => C.push([...c]));
      return C;
    }
    solver(itens, extras = []) { return new Solver(this.nvars, this.clausulas(itens, extras)); }
    dimacs(itens, extras = []) {
      const C = this.clausulas(itens, extras);
      const L = ["c Gata Estrela — CNF de '" + this.pessoa + "' (minutos " + this.tmin + ".." + this.tmax + ")",
        "c variável x(pessoa,sala,minuto) = a pessoa está na sala naquele minuto"];
      [...this.nome].sort((a, b) => a[0] - b[0]).forEach(([v, n]) => L.push("c " + v + " = " + n));
      L.push("p cnf " + this.nvars + " " + C.length);
      C.forEach((c) => L.push(c.join(" ") + " 0"));
      return L.join("\n") + "\n";
    }
    itensComDepoimento(com) {
      const itens = new Map(this.itens);
      if (com) for (const [p, s, de, ate] of this.caso.depoimentos) if (p === this.pessoa) itens.set("depoimento: " + s + " dos minutos " + de + " a " + ate, this.depoimento(s, de, ate));
      return itens;
    }
  }

  function trajetoria(cod, modelo) {
    const seg = [];
    for (let t = cod.tmin; t <= cod.tmax; t++) {
      const s = cod.locais.find((l) => modelo[cod.x(l, t)] === 1);
      if (seg.length && seg[seg.length - 1][0] === s) seg[seg.length - 1][2] = t; else seg.push([s, t, t]);
    }
    return seg;
  }
  function nucleoMinimo(cod, itens, fixos = []) {
    const nuc = [...itens.keys()];
    for (const nome of [...nuc]) {
      if (fixos.includes(nome)) continue;
      const resto = new Map(nuc.filter((k) => k !== nome).map((k) => [k, itens.get(k)]));
      if (!cod.solver(resto).resolverEDesfazer()[0]) nuc.splice(nuc.indexOf(nome), 1);
    }
    return nuc;
  }
  function consistencia(caso, pessoa, comDepoimento = false) {
    const cod = new Codificacao(caso, pessoa), itens = cod.itensComDepoimento(comDepoimento);
    const sv = cod.solver(itens); const [ok, modelo] = sv.resolverEDesfazer();
    const res = { sat: !!ok, variaveis: cod.nvars, clausulas: cod.clausulas(itens).length, stats: { ...sv.stats } };
    if (ok) { res.trajetoria = trajetoria(cod, modelo); res.nucleo = []; } else res.nucleo = nucleoMinimo(cod, itens);
    return res;
  }
  function consequencia(caso, pessoa, sala, t, comDepoimento = false) {
    const cod = new Codificacao(caso, pessoa), itens = cod.itensComDepoimento(comDepoimento);
    if (!cod.solver(itens).resolverEDesfazer()[0]) return { resposta: "inconsistente", refutacao: null };
    const x = cod.x(sala, t);
    const pode = cod.solver(itens, [[x]]).resolverEDesfazer()[0];
    const nega = cod.solver(itens, [[-x]]).resolverEDesfazer()[0];
    if (!pode) return { resposta: "impossivel", refutacao: "com x verdadeiro a CNF fica insatisfatível" };
    if (!nega) return { resposta: "necessario", refutacao: "somar ¬x à CNF a torna insatisfatível (refutação)" };
    return { resposta: "possivel", refutacao: null };
  }
  function minutosPossiveis(caso, pessoa, sala, a, b, comDepoimento = false) {
    const cod = new Codificacao(caso, pessoa), sv = cod.solver(cod.itensComDepoimento(comDepoimento));
    if (!sv.resolverEDesfazer()[0]) return [];
    const out = [];
    for (let t = Math.max(a, cod.tmin); t <= Math.min(b, cod.tmax); t++) {
      const marca = sv.trilha.length;
      if (sv.supor(cod.x(sala, t)) && sv.resolver()) out.push(t);
      sv.desfazer(marca);
    }
    return out;
  }
  function intervalos(minutos) {
    const seg = [];
    for (const t of minutos) { if (seg.length && seg[seg.length - 1][1] === t - 1) seg[seg.length - 1][1] = t; else seg.push([t, t]); }
    return seg;
  }
  function contarPadroes(caso, pessoa, sala, a, b, limite = 5000) {
    const cod = new Codificacao(caso, pessoa), sv = cod.solver();
    if (!sv.resolverEDesfazer()[0]) return { total: 0, truncado: false };
    const proj = []; for (let t = Math.max(a, cod.tmin); t <= Math.min(b, cod.tmax); t++) proj.push(cod.x(sala, t));
    let cont = 0, estourou = false;
    (function rec(i) {
      if (cont >= limite) { estourou = true; return; }
      if (i === proj.length) { if (sv.resolverEDesfazer()[0]) cont++; return; }
      for (const l of [proj[i], -proj[i]]) {
        const marca = sv.trilha.length;
        if (sv.supor(l)) rec(i + 1);
        sv.desfazer(marca);
      }
    })(0);
    return { total: cont, truncado: estourou };
  }
  function depoimentoRefutadoSat(caso, pessoa, sala, de, ate) {
    const cod = new Codificacao(caso, pessoa), itens = new Map(cod.itens);
    if (!cod.solver(itens).resolverEDesfazer()[0]) return { refutado: null, motivo: "os próprios registros são inconsistentes" };
    const chave = "depoimento: " + sala + " dos minutos " + de + " a " + ate;
    itens.set(chave, cod.depoimento(sala, de, ate));
    if (cod.solver(itens).resolverEDesfazer()[0]) return { refutado: false, nucleo: [] };
    return { refutado: true, nucleo: nucleoMinimo(cod, itens, [chave]) };
  }
  Object.assign(M, { SAT: { Solver, Codificacao, distancias, horizonte, consistencia, consequencia, minutosPossiveis, intervalos, contarPadroes, depoimentoRefutadoSat } });
})(typeof window !== "undefined" ? window : globalThis);
