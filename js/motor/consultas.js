/* Camada de perguntas (JS): mesma API de motor/consultas.py. Também inclui o oráculo `referencia` (motor/referencia.py). */
(function (root) {
  "use strict";
  const GE = (root.GE = root.GE || {});
  const M = GE.M, SAT = M.SAT;
  const INF = 1000;

  function referencia(caso, pessoas) {
    const { salas, dist: d } = SAT.distancias(caso);
    const [j1, j2] = caso.janela, crime = caso.local_do_crime;
    if (!pessoas) pessoas = M.pessoasDo(caso);
    const out = { pessoas: {}, suspeitos: [] };
    const cmp = (a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
    for (const p of pessoas) {
      const vistos = new Set(), regs = [];
      for (const [q, s, t] of caso.registros) if (q === p && !vistos.has(t + "|" + s)) { vistos.add(t + "|" + s); regs.push([t, s]); }
      regs.sort(cmp);
      const inter = {}, imp = [];
      for (const x of salas) {
        inter[x] = [];
        if (!regs.length) inter[x].push([-INF, INF]);
        if (regs.length) {
          const [t0, s0] = regs[0];
          if (d(x, s0) !== Infinity && -INF <= t0 - d(x, s0)) inter[x].push([-INF, t0 - d(x, s0)]);
          const [t1, s1] = regs[regs.length - 1];
          if (d(s1, x) !== Infinity) inter[x].push([t1 + d(s1, x), INF]);
        }
        for (let i = 0; i + 1 < regs.length; i++) {
          const [ta, sa] = regs[i], [tb, sb] = regs[i + 1];
          if (ta === tb) continue;
          if (d(sa, x) !== Infinity && d(x, sb) !== Infinity) { const a = ta + d(sa, x), b = tb - d(x, sb); if (a <= b) inter[x].push([a, b]); }
        }
      }
      for (let i = 0; i + 1 < regs.length; i++) {
        const [ta, sa] = regs[i], [tb, sb] = regs[i + 1];
        if (ta !== tb && (d(sa, sb) === Infinity || tb - ta < d(sa, sb))) imp.push([sa, ta, sb, tb]);
      }
      regs.forEach(([ta, sa], i) => regs.slice(i + 1).forEach(([tb, sb]) => { if (ta === tb && sa !== sb) imp.push([sa, ta, sb, tb]); }));
      const janela = {};
      for (const x of salas) {
        const v = new Map();
        for (let [a, b] of inter[x]) { a = Math.max(a, j1); b = Math.min(b, j2); if (a <= b) v.set(a + "," + b, [a, b]); }
        janela[x] = [...v.values()].sort(cmp);
      }
      const refut = [];
      for (const [q, s, de, ate] of caso.depoimentos) if (q === p && regs.some(([t, s2]) => s2 !== s && de <= t && t <= ate)) refut.push([s, de, ate]);
      const lib = caso.depoimentos.some(([q, s, de, ate]) => q === p && !refut.some((r) => r[0] === s && r[1] === de && r[2] === ate) && de <= j1 && j2 <= ate && s !== crime);
      const susp = !lib && janela[crime].length > 0 && imp.length === 0;
      out.pessoas[p] = { liberado: lib, refutados: refut, janela, impossiveis: imp, suspeito: susp };
      if (susp) out.suspeitos.push(p);
    }
    return out;
  }

  const faixas = (v) => v.map(([a, b]) => a + "–" + b).join(", ");
  const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  class Caso {
    constructor(dados) {
      this.dados = M.validar(dados);
      this.nomes = M.nomesDeExibicao(dados);
      this.motor = new M.Motor(M.clausulas(dados));
    }
    nome(a) { return a in this.nomes ? this.nomes[a] : a; }
    atomo(n) {
      for (const orig of Object.values(this.nomes)) if (orig === n || orig.toLowerCase() === String(n).toLowerCase()) return M.atomoSeguro(orig);
      return M.atomoSeguro(n);
    }
    consultar(texto, { maximo = 200, comProva = false, trace = false } = {}) {
      const [objs, vs] = M.lerObjetivos(texto);
      this.motor.inferencias = 0;
      this.motor.trace = trace ? [] : null;
      const sols = [], provas = [], vistos = new Set();
      for (const [s, nos] of this.motor.resolver(objs)) {
        const sol = {};
        for (const [n, v] of vs) if (!n.startsWith("_")) sol[n] = M.formatar(M.aplicar(v, s));
        const chave = JSON.stringify(Object.entries(sol).sort((a, b) => (a[0] < b[0] ? -1 : 1)));
        if (vistos.has(chave)) continue;
        vistos.add(chave); sols.push(sol);
        if (comProva) provas.push(nos.map((n) => M.exportar(n, s)));
        if (sols.length >= maximo) break;
      }
      const r = { consulta: texto, solucoes: sols, inferencias: this.motor.inferencias, provas, limite_atingido: this.motor.limiteAtingido };
      if (trace) r.trace = this.motor.trace;
      this.motor.trace = null;
      return r;
    }
    prova(texto, { trace = false } = {}) {
      const [objs, vs] = M.lerObjetivos(texto);
      this.motor.inferencias = 0; this.motor.trace = trace ? [] : null;
      let r = { consulta: texto, provado: false, valores: {}, arvore: [], inferencias: 0 };
      for (const [s, nos] of this.motor.resolver(objs)) {
        const valores = {};
        for (const [n, v] of vs) if (!n.startsWith("_")) valores[n] = M.formatar(M.aplicar(v, s));
        r = { consulta: texto, provado: true, valores, arvore: nos.map((n) => M.exportar(n, s)), inferencias: this.motor.inferencias };
        break;
      }
      r.inferencias = this.motor.inferencias;
      if (trace) r.trace = this.motor.trace;
      this.motor.trace = null;
      return r;
    }
    distancia(a, b) { const r = this.consultar("distancia(" + this.atomo(a) + ", " + this.atomo(b) + ", D)"); return r.solucoes.length ? parseInt(r.solucoes[0].D, 10) : null; }
    janelas(p, sala) {
      const r = this.consultar("pode_na_janela(" + this.atomo(p) + ", " + this.atomo(sala) + ", I, F)");
      const v = new Map(); r.solucoes.forEach((s) => v.set(s.I + "," + s.F, [parseInt(s.I, 10), parseInt(s.F, 10)]));
      return [...v.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    }
    refutados() { return this.consultar("refutado(P, S, De, Ate)").solucoes.map((s) => [this.nome(s.P), this.nome(s.S), +s.De, +s.Ate]); }
    saiuSozinha() { return this.consultar("saiu_sozinha(O, S, T)").solucoes.map((s) => [s.O, this.nome(s.S), +s.T]); }
    impossiveis() { return this.consultar("registro_impossivel(P, S1, T1, S2, T2)").solucoes.map((s) => [this.nome(s.P), this.nome(s.S1), +s.T1, this.nome(s.S2), +s.T2]); }
    liberados() { return this.consultar("liberado(P)").solucoes.map((s) => this.nome(s.P)); }
    suspeitos() { return this.consultar("suspeito(P)").solucoes.map((s) => this.nome(s.P)); }

    analise() {
      const d = this.dados, crime = d.local_do_crime;
      const refut = this.refutados(), lib = new Set(this.liberados()), susp = this.suspeitos(), imp = this.impossiveis();
      const pessoas = [];
      for (const p of M.pessoasDo(d)) {
        const jan = this.janelas(p, crime), r = refut.filter((x) => x[0] === p);
        let situ, motivo;
        if (imp.some((x) => x[0] === p)) {
          situ = "inconsistente";
          motivo = "os próprios registros se contradizem (" + imp.filter((x) => x[0] === p).map((x) => x[1] + " no minuto " + x[2] + " e " + x[3] + " no minuto " + x[4]).join("; ") + "): dado a conferir, não é acusação";
        } else if (susp.includes(p)) {
          situ = "suspeito";
          motivo = "não foi liberado por depoimento e pode ter estado em " + crime + " nos minutos " + faixas(jan) + " da janela";
          if (r.length) motivo = "o depoimento (" + r[0][1] + ", " + r[0][2] + "–" + r[0][3] + ") foi refutado por um registro; " + motivo;
        } else if (lib.has(p)) { situ = "liberado"; motivo = "depoimento cobre a janela, em outra sala, e nenhum registro o contradiz"; }
        else if (!jan.length) { situ = "descartado"; motivo = "o mapa e os registros não deixam tempo para chegar a " + crime + " durante a janela"; }
        else { situ = "indefinido"; motivo = "sem depoimento que o libere e sem como provar presença"; }
        pessoas.push({ pessoa: p, situacao: situ, motivo, janela_no_crime: jan, refutados: r });
      }
      const inc = [...new Set(imp.map((x) => x[0]))].sort();
      const aviso = inc.length ? " Atenção: registros contraditórios de " + inc.join(", ") + "." : "";
      let concl;
      if (susp.length === 1) concl = { tipo: "unico", texto: susp[0] + " é o único suspeito que sobra." + aviso };
      else if (!susp.length) concl = { tipo: "nenhum", texto: "Nenhum suspeito sobrou: não há como apontar quem esteve em " + crime + " durante a janela com os dados deste caso." + aviso };
      else concl = { tipo: "varios", texto: "Mais de um suspeito sobrou (" + susp.join(", ") + "): os dados não bastam para apontar um só." + aviso };
      return { pessoas, suspeitos: susp, liberados: [...lib].sort(), refutados: refut, impossiveis: imp, conclusao: concl, saiu_sozinha: this.saiuSozinha() };
    }
    satConsistencia(p, comDep = false) { return SAT.consistencia(this.dados, p, comDep); }
    satTodos() {
      const out = {};
      for (const p of M.pessoasDo(this.dados)) {
        const r = SAT.consistencia(this.dados, p);
        if (r.sat) r.minutos_no_crime = SAT.intervalos(SAT.minutosPossiveis(this.dados, p, this.dados.local_do_crime, ...this.dados.janela));
        out[p] = r;
      }
      return out;
    }
    satSuspeitos() {
      const d = this.dados, [j1, j2] = d.janela, out = [];
      for (const p of M.pessoasDo(d)) {
        let lib = false;
        for (const [q, s, de, ate] of d.depoimentos)
          if (q === p && s !== d.local_do_crime && de <= j1 && j2 <= ate && SAT.depoimentoRefutadoSat(d, p, s, de, ate).refutado === false) lib = true;
        if (!lib && SAT.minutosPossiveis(d, p, d.local_do_crime, j1, j2).length) out.push(p);
      }
      return out;
    }
    /* bônus do enunciado: menor conjunto de depoimentos que, se FALSOS, muda o suspeito final */
    depoimentosDecisivos() {
      const d = this.dados, base = [...this.suspeitos()].sort(), deps = d.depoimentos;
      const comb = function* (n, k, ini = 0, atual = []) { if (!k) { yield atual; return; } for (let i = ini; i <= n - k; i++) yield* comb(n, k - 1, i + 1, [...atual, i]); };
      for (let k = 1; k <= deps.length; k++) {
        const achados = [];
        for (const c of comb(deps.length, k)) {
          if (achados.some((a) => a.indices.every((i) => c.includes(i)))) continue;
          const sub = { ...d, depoimentos: deps.filter((_, i) => !c.includes(i)) };
          const novos = [...new Caso(sub).suspeitos()].sort();
          if (!iguais(novos, base)) achados.push({ indices: c, depoimentos: c.map((i) => deps[i]), suspeitos: novos });
        }
        if (achados.length) return { suspeitos_atuais: base, tamanho: k, conjuntos: achados };
      }
      return { suspeitos_atuais: base, tamanho: null, conjuntos: [] };
    }
  }
  Object.assign(M, { Caso, referencia });
})(typeof window !== "undefined" ? window : globalThis);
