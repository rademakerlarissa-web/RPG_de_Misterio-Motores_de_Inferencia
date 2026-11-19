#!/usr/bin/env python3
"""
Empacota os JSON em arquivos .js para o site abrir com duplo clique (file://),
onde o navegador bloqueia fetch() de arquivos locais.

  assets/manifest.json  ->  data/manifest.js   (window.GE_MANIFEST)
  casos/*.json     ->  data/casos.js      (window.GE_CASOS)

Os .json continuam sendo a fonte da verdade (e servem para a CLI Python).
Rode de novo depois de mudar qualquer um deles.
"""
import json, glob, os
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(raiz, "assets/manifest.json"), encoding="utf-8") as f:
    man = json.load(f)
with open(os.path.join(raiz, "data/manifest.js"), "w", encoding="utf-8") as f:
    f.write("/* GERADO por tools/empacotar_dados.py a partir de assets/manifest.json. Nao edite. */\n")
    f.write("window.GE_MANIFEST = " + json.dumps(man, ensure_ascii=False, indent=1) + ";\n")
casos = {}
for p in sorted(glob.glob(os.path.join(raiz, "casos/*.json"))):
    with open(p, encoding="utf-8") as f:
        casos[os.path.splitext(os.path.basename(p))[0]] = json.load(f)
with open(os.path.join(raiz, "data/casos.js"), "w", encoding="utf-8") as f:
    f.write("/* GERADO por tools/empacotar_dados.py a partir de casos/*.json. Nao edite. */\n")
    f.write("window.GE_CASOS = " + json.dumps(casos, ensure_ascii=False, indent=1) + ";\n")
print("OK:", len(man["personagens"]), "personagens;", len(casos), "casos:", ", ".join(casos))
