// Calcula, com o motor JavaScript do site, o mesmo resumo que tests/test_paridade_js.py calcula com o Python.
const fs = require("fs"), path = require("path"), vm = require("vm");
const RAIZ = path.join(__dirname, "..");
for (const f of ["termos", "sld", "regras", "base", "sat", "consultas"]) vm.runInThisContext(fs.readFileSync(path.join(RAIZ, "js/motor", f + ".js"), "utf8"), { filename: f });
const M = globalThis.GE.M;
const QUERIES = ["suspeito(P)", "liberado(P)", "pode_na_janela(P, X, I, F)", "refutado(P, S, De, Ate)", "distancia(A, B, D)"];
const dados = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const c = new M.Caso(dados);
const out = { analise: c.analise(), consultas: {}, sat: c.satTodos(), sat_suspeitos: c.satSuspeitos(), dimacs: {}, decisivos: null, prova: null };
for (const q of QUERIES) { const r = c.consultar(q); out.consultas[q] = { solucoes: r.solucoes, inferencias: r.inferencias }; }
for (const p of M.pessoasDo(dados)) out.dimacs[p] = new M.SAT.Codificacao(dados, p).dimacs();
out.decisivos = c.depoimentosDecisivos();
out.sozinha = c.saiuSozinha();
out.prova = c.prova("suspeito(P)");
console.log(JSON.stringify(out));
