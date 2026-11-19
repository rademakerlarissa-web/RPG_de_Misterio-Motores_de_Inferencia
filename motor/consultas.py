"""Camada de perguntas sobre o caso (usa o motor SLD e o SAT) — é o que a CLI e o site chamam."""
import itertools
from .base import clausulas, atomo_seguro, nomes_de_exibicao, pessoas_do, salas_do, validar, programa_texto
from .sld import Motor, exportar, ErroDeMotor
from .termos import ler_objetivos, aplicar, formatar, variaveis, Var
from . import sat as SAT
from . import referencia


class Caso:
    def __init__(self, dados):
        self.dados = validar(dados)
        self.nomes = nomes_de_exibicao(dados)
        self.motor = Motor(clausulas(dados))

    # --- utilidades
    def nome(self, a):
        return self.nomes.get(a, a)

    def atomo(self, n):
        for orig in self.nomes.values():
            if orig == n or orig.lower() == str(n).lower():
                return atomo_seguro(orig)
        return atomo_seguro(n)

    def consultar(self, texto, maximo=200, com_prova=False):
        """Executa uma consulta Prolog. Retorna {'solucoes':[{var: valor}], 'inferencias': n, 'provas': [...]}"""
        objs, vs = ler_objetivos(texto)
        self.motor.inferencias = 0
        sols, provas, vistos = [], [], set()
        for s, nos in self.motor.resolver(objs):
            sol = {n: formatar(aplicar(v, s)) for n, v in vs.items() if not n.startswith("_")}
            chave = tuple(sorted(sol.items()))
            if chave in vistos:
                continue
            vistos.add(chave)
            sols.append(sol)
            if com_prova:
                provas.append([exportar(n, s) for n in nos])
            if len(sols) >= maximo:
                break
        return {"consulta": texto, "solucoes": sols, "inferencias": self.motor.inferencias, "provas": provas,
                "limite_atingido": self.motor.limite_atingido}

    def prova(self, texto):
        """Meta-interpretador: árvore de prova da primeira solução."""
        objs, vs = ler_objetivos(texto)
        self.motor.inferencias = 0
        for s, nos in self.motor.resolver(objs):
            return {"consulta": texto, "provado": True,
                    "valores": {n: formatar(aplicar(v, s)) for n, v in vs.items() if not n.startswith("_")},
                    "arvore": [exportar(n, s) for n in nos], "inferencias": self.motor.inferencias}
        return {"consulta": texto, "provado": False, "valores": {}, "arvore": [], "inferencias": self.motor.inferencias}

    # --- perguntas de alto nível
    def distancia(self, a, b):
        r = self.consultar(f"distancia({self.atomo(a)}, {self.atomo(b)}, D)")
        return int(r["solucoes"][0]["D"]) if r["solucoes"] else None

    def janelas(self, pessoa, sala):
        r = self.consultar(f"pode_na_janela({self.atomo(pessoa)}, {self.atomo(sala)}, I, F)")
        return sorted({(int(s["I"]), int(s["F"])) for s in r["solucoes"]})

    def refutados(self):
        r = self.consultar("refutado(P, S, De, Ate)")
        return [(self.nome(s["P"]), self.nome(s["S"]), int(s["De"]), int(s["Ate"])) for s in r["solucoes"]]

    def saiu_sozinha(self):
        """Objetos vistos saindo do local do crime, na janela, sem ninguém registrado ali (regra saiu_sozinha)."""
        r = self.consultar("saiu_sozinha(O, S, T)")
        return [(s["O"], self.nome(s["S"]), int(s["T"])) for s in r["solucoes"]]

    def impossiveis(self):
        r = self.consultar("registro_impossivel(P, S1, T1, S2, T2)")
        return [(self.nome(s["P"]), self.nome(s["S1"]), int(s["T1"]), self.nome(s["S2"]), int(s["T2"])) for s in r["solucoes"]]

    def liberados(self):
        return [self.nome(s["P"]) for s in self.consultar("liberado(P)")["solucoes"]]

    def suspeitos(self):
        return [self.nome(s["P"]) for s in self.consultar("suspeito(P)")["solucoes"]]

    def analise(self):
        """Resumo por pessoa + conclusão, tudo vindo do motor SLD."""
        d = self.dados
        crime = d["local_do_crime"]
        refut = self.refutados()
        lib = set(self.liberados())
        susp = self.suspeitos()
        imp = self.impossiveis()
        pessoas = []
        for p in pessoas_do(d):
            jan = self.janelas(p, crime)
            r = [x for x in refut if x[0] == p]
            if any(x[0] == p for x in imp):
                situ = "inconsistente"
                motivo = "os próprios registros se contradizem (" + "; ".join(
                    f"{x[1]} no minuto {x[2]} e {x[3]} no minuto {x[4]}" for x in imp if x[0] == p) + "): dado a conferir, não é acusação"
            elif p in susp:
                situ = "suspeito"
                motivo = f"não foi liberado por depoimento e pode ter estado em {crime} nos minutos " + \
                         ", ".join(f"{a}–{b}" for a, b in jan) + " da janela"
                if r:
                    motivo = f"o depoimento ({r[0][1]}, {r[0][2]}–{r[0][3]}) foi refutado por um registro; " + motivo
            elif p in lib:
                situ = "liberado"
                motivo = "depoimento cobre a janela, em outra sala, e nenhum registro o contradiz"
            elif not jan:
                situ = "descartado"
                motivo = f"o mapa e os registros não deixam tempo para chegar a {crime} durante a janela"
            else:
                situ = "indefinido"
                motivo = "sem depoimento que o libere e sem como provar presença"
            pessoas.append({"pessoa": p, "situacao": situ, "motivo": motivo, "janela_no_crime": jan, "refutados": r})
        inc = sorted({x[0] for x in imp})
        aviso = (" Atenção: registros contraditórios de " + ", ".join(inc) + ".") if inc else ""
        if len(susp) == 1:
            concl = {"tipo": "unico", "texto": f"{susp[0]} é o único suspeito que sobra." + aviso}
        elif not susp:
            concl = {"tipo": "nenhum", "texto": "Nenhum suspeito sobrou: não há como apontar quem esteve em " + crime +
                     " durante a janela com os dados deste caso." + aviso}
        else:
            concl = {"tipo": "varios", "texto": "Mais de um suspeito sobrou (" + ", ".join(susp) +
                     "): os dados não bastam para apontar um só." + aviso}
        return {"pessoas": pessoas, "suspeitos": susp, "liberados": sorted(lib), "refutados": refut,
                "impossiveis": imp, "conclusao": concl, "saiu_sozinha": self.saiu_sozinha()}

    # --- SAT
    def sat_consistencia(self, pessoa, com_depoimento=False):
        return SAT.consistencia(self.dados, pessoa, com_depoimento)

    def sat_todos(self):
        out = {}
        for p in pessoas_do(self.dados):
            r = SAT.consistencia(self.dados, p)
            if r["sat"]:
                m = SAT.minutos_possiveis(self.dados, p, self.dados["local_do_crime"], *self.dados["janela"])
                r["minutos_no_crime"] = SAT.intervalos(m)
            out[p] = r
        return out

    def sat_suspeitos(self):
        """Suspeitos pelo caminho SAT: nenhum depoimento 'liberador' sobrevive e há modelo com a pessoa no crime."""
        d = self.dados
        j1, j2 = d["janela"]
        out = []
        for p in pessoas_do(d):
            lib = False
            for q, s, de, ate in d["depoimentos"]:
                if q == p and s != d["local_do_crime"] and de <= j1 and j2 <= ate:
                    ref = SAT.depoimento_refutado_sat(d, p, s, de, ate)
                    if ref["refutado"] is False:
                        lib = True
            if not lib and SAT.minutos_possiveis(d, p, d["local_do_crime"], j1, j2):
                out.append(p)
        return out

    # --- bônus do enunciado: menor conjunto de depoimentos que, se FALSOS, muda o suspeito final
    def depoimentos_decisivos(self):
        d = self.dados
        base = sorted(self.suspeitos())
        deps = d["depoimentos"]
        for k in range(1, len(deps) + 1):
            achados = []
            for comb in itertools.combinations(range(len(deps)), k):
                if any(set(a["indices"]) < set(comb) for a in achados):
                    continue
                sub = {**d, "depoimentos": [x for i, x in enumerate(deps) if i not in comb]}
                novos = sorted(Caso(sub).suspeitos())
                if novos != base:
                    achados.append({"indices": list(comb), "depoimentos": [deps[i] for i in comb], "suspeitos": novos})
            if achados:
                return {"suspeitos_atuais": base, "tamanho": k, "conjuntos": achados}
        return {"suspeitos_atuais": base, "tamanho": None, "conjuntos": []}
