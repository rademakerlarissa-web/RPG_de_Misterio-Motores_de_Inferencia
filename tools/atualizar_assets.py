"""Atualiza assets/ com as imagens enviadas na 2a rodada (Luiza nova, café novo, reserva, diário, câmera).
Reaproveita a limpeza de tools/build_assets.py e edita assets/manifest.json.
Uso: python3 -I tools/atualizar_assets.py --luiza <pasta com 3 retratos + pasta chibi> --cafe <png> --reserva <png> \
         --diario-aberto <png> --diario-fechado <png> --camera <png>"""
import argparse, importlib.util, json, pathlib
from PIL import Image
raiz = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("ba", raiz / "tools" / "build_assets.py")
ba = importlib.util.module_from_spec(spec); spec.loader.exec_module(ba)

ap = argparse.ArgumentParser()
for k in ["luiza_retratos", "luiza_sprites", "cafe", "reserva", "diario_aberto", "diario_fechado", "camera"]:
    ap.add_argument("--" + k.replace("_", "-"), required=True)
a = ap.parse_args()
mpath = raiz / "assets" / "manifest.json"
m = json.loads(mpath.read_text(encoding="utf-8"))
def rel(p): return str(pathlib.Path(p).relative_to(raiz))
def aberta(p): return Image.open(p).convert("RGBA")

# --- Luiza
L = next(p for p in m["personagens"] if p["id"] == "luiza")
base = raiz / "assets/img/personagens/luiza"
for f in base.glob("*.webp"): f.unlink()
L["retratos"] = []
for arq, rid, rot in [("Visitante_Luiza_Sorrindo.png", "sorrindo", "Sorrindo"), ("Visitante_Luiza_Pensativa.png", "pensativa", "Pensativa"), ("Visitante_Luiza_Surpresa.png", "surpresa", "Surpresa")]:
    img = ba.reduzir(ba.cortar_vazio(ba.tirar_ilhas(aberta(pathlib.Path(a.luiza_retratos) / arq))), 900)
    info = ba.salvar(img, str(base / f"retrato-{rid}.webp"))
    L["retratos"].append(dict(id=rid, rotulo=rot, arquivo=rel(info["arquivo"]), w=info["w"], h=info["h"]))
L["sprites"] = {}
for dire, arq in [("frente", "Visitante_Luiza_Frente_Parada.png"), ("passo", "Visitante_Luiza_Andando_Frente.png"), ("esquerda", "Visitante_Luiza_Andando_Esquerda.png"), ("direita", "Visitante_Luiza_Andando_Direita.png"), ("costas", "Visitante_Luiza_Costas.png")]:
    img = ba.reduzir(ba.cortar_vazio(ba.tirar_ilhas(aberta(pathlib.Path(a.luiza_sprites) / arq))), 480)
    info = ba.salvar(img, str(base / f"sprite-{dire}.webp"))
    L["sprites"][dire] = dict(arquivo=rel(info["arquivo"]), w=info["w"], h=info["h"], ancora=dict(x=0.5, y=1.0))

# --- cenários
def cenario(id_, nome, uso, src):
    img = Image.open(src).convert("RGB")
    w = 1600; h = round(img.height * w / img.width)
    img = img.resize((w, h), Image.LANCZOS)
    caminho = raiz / f"assets/img/cenarios/{id_}.webp"
    img.save(caminho, "WEBP", quality=84, method=6)
    d = dict(id=id_, nome=nome, uso=uso, arquivo=rel(caminho), w=w, h=h, origem=pathlib.Path(src).name)
    m["cenarios"] = [c for c in m["cenarios"] if c["id"] != id_] + [d]
cenario("cafe", "Café do Museu", "Depoimentos de Barros e Luiza", a.cafe)
cenario("reserva", "Reserva técnica", "Registros da curadora e do faxineiro", a.reserva)

# --- objetos
obj = {}
img = Image.open(a.diario_aberto).convert("RGB"); img = img.resize((1400, round(img.height * 1400 / img.width)), Image.LANCZOS)
c = raiz / "assets/img/objetos/diario-aberto.webp"; c.parent.mkdir(parents=True, exist_ok=True); img.save(c, "WEBP", quality=86, method=6)
obj["diario-aberto"] = dict(nome="Diário aberto", arquivo=rel(c), w=img.width, h=img.height)
i = ba.reduzir(ba.cortar_vazio(ba.tirar_ilhas(aberta(a.diario_fechado))), 420)
info = ba.salvar(i, str(raiz / "assets/img/objetos/diario-fechado.webp")); obj["diario-fechado"] = dict(nome="Diário fechado", arquivo=rel(info["arquivo"]), w=info["w"], h=info["h"])
i = ba.reduzir(ba.limpar_gata(aberta(a.camera)), 420)   # mesma limpeza da gata: tira a franja vermelha
info = ba.salvar(i, str(raiz / "assets/img/objetos/camera.webp")); obj["camera"] = dict(nome="Câmera de segurança", arquivo=rel(info["arquivo"]), w=info["w"], h=info["h"])
m["objetos"] = obj
m["faltando"] = [f for f in m.get("faltando", []) if f["id"] in ("livro-de-registros", "almofada")]
mpath.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")
print("ok")
