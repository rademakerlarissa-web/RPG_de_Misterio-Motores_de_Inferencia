"""Converte as 2 imagens do final (Helena com a Estrela; Moraes de joinha) e registra em assets/manifest.json -> "finais".
Uso: python3 -I tools/adicionar_final.py --helena-estrela <png> --moraes <png> ; depois: python3 -I tools/empacotar_dados.py"""
import argparse, json, pathlib
from PIL import Image
raiz = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(); ap.add_argument("--helena-estrela", required=True); ap.add_argument("--moraes", required=True); a = ap.parse_args()
m = json.loads((raiz / "assets/manifest.json").read_text(encoding="utf-8")); m["finais"] = {}
for id_, src, nome in [("helena-estrela", a.helena_estrela, "Dona Helena abraçada com a Estrela"), ("moraes-joinha", a.moraes, "Detetive Moraes de joinha")]:
    img = Image.open(src).convert("RGB"); img = img.resize((720, round(img.height * 720 / img.width)), Image.LANCZOS)
    c = raiz / f"assets/img/final/{id_}.webp"; c.parent.mkdir(parents=True, exist_ok=True); img.save(c, "WEBP", quality=86, method=6)
    m["finais"][id_] = dict(nome=nome, arquivo=str(c.relative_to(raiz)), w=img.width, h=img.height)
(raiz / "assets/manifest.json").write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8"); print("ok")
