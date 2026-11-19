import json, os, sys
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)


def carregar(nome):
    with open(os.path.join(RAIZ, "casos", nome + ".json"), encoding="utf-8") as f:
        return json.load(f)
