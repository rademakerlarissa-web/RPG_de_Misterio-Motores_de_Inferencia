#!/usr/bin/env python3
"""
Gera os assets otimizados (WebP) e o manifesto a partir dos arquivos originais.

Uso:
  python3 tools/build_assets.py --personagens <pasta_personagens_organizados> \
      --fundos <pasta_fundos> --gata-sentada <png> --gata-andando <png> --saida assets

O script NAO altera os originais. Pode ser executado de novo sempre que um
asset novo chegar (ex.: fundo da reserva tecnica, diario, objetos).
"""
import argparse, json, os, re, shutil, unicodedata
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

# ---------------------------------------------------------------- metadados
PERSONAGENS = {
    # id: (nome, papel, cor de destaque, pasta, retratos[(arquivo, id, rotulo)], prefixo dos sprites)
    "moraes": dict(nome="Detetive Moraes", papel="Protagonista", cor="#C98F4B", pasta="Moraes",
        retratos=[("tres_expresses_de_um_detetive_01", "serio", "Sério"),
                  ("tres_expresses_de_um_detetive_02", "surpreso", "Surpreso"),
                  ("tres_expresses_de_um_detetive_03", "pensando", "Pensando")],
        sprites="cinco_poses_de_detetive_chibi_f_r"),
    "helena": dict(nome="Dona Helena", papel="Diretora do museu", cor="#8E5A7A", pasta="Helena",
        retratos=[("triptico_da_dama_elegante_em_emoces_01", "chorando", "Chorando"),
                  ("triptico_da_dama_elegante_em_emoces_02", "triste", "Triste"),
                  ("triptico_da_dama_elegante_em_emoces_03", "aflita", "Aflita")],
        sprites="turnaround_de_uma_dama_vitoriana"),
    "iris": dict(nome="Dra. Íris", papel="Curadora", cor="#9C4A63", pasta="Iris",
        retratos=[("triptico_da_erudita_em_tres_expresses_01", "sorrindo", "Sorrindo"),
                  ("triptico_da_erudita_em_tres_expresses_02", "surpresa", "Surpresa"),
                  ("triptico_da_erudita_em_tres_expresses_03", "ideia", "Ideia")],
        sprites="folha_de_poses_da_academica_vitoriana"),
    "barros": dict(nome="Seu Barros", papel="Guarda", cor="#5B4A7A", pasta="Barros",
        retratos=[("tres_poses_de_um_guarda_uniformizado_01", "cruzado", "Braços cruzados"),
                  ("tres_poses_de_um_guarda_uniformizado_02", "serio", "Sério"),
                  ("tres_poses_de_um_guarda_uniformizado_03", "assustado", "Assustado"),
                  ("policial_ansioso_ajusta_o_bone_01", "nervoso", "Nervoso (boné abaixado)")],
        sprites="folha_de_poses_de_policial_uniformizado"),
    "tiao": dict(nome="Tião", papel="Faxineiro", cor="#7A4F7E", pasta="Tiao",
        retratos=[("tres_expresses_do_trabalhador_tio_01", "pensando", "Pensando"),
                  ("tres_expresses_do_trabalhador_tio_02", "sorrindo", "Sorrindo"),
                  ("tres_expresses_do_trabalhador_tio_03", "calma", "Pedindo calma")],
        sprites="folha_de_poses_do_trabalhador_simpatico"),
    "luiza": dict(nome="Luiza", papel="Visitante", cor="#B5495B", pasta="Luiza",
        retratos=[("tres_expresses_de_uma_jovem_romantica_01", "sorrindo", "Sorrindo"),
                  ("tres_expresses_de_uma_jovem_romantica_02", "preocupada", "Preocupada"),
                  ("tres_expresses_de_uma_jovem_romantica_03", "surpresa", "Surpresa")],
        sprites="turnaround_de_jovem_em_traje_bordo"),
}
DIRECOES = ["frente", "passo", "esquerda", "direita", "costas"]   # ordem 01..05 (LEIA-ME)

CENARIOS = [
    # id, nome, trecho do nome do arquivo original, uso
    ("escritorio", "Escritório do Detetive", "Escrit", "Capítulo 1 (o chamado)"),
    ("hall", "Hall principal", "Sal", "Capítulo 2 (o museu) e conclusão"),
    ("galeria", "Galeria de Arte", "Galeria", "Registro das 21h20 (Barros)"),
    ("cafe", "Café do Museu", "Caf", "Depoimentos de Barros e Luiza"),
    ("mapa", "Planta do museu (pixel art)", "Mapa", "Mapa / grafo de salas"),
]
FALTANDO = [
    dict(id="reserva", tipo="cenario", nome="Reserva técnica",
         nota="Sala explorável exigida pelo roteiro. Não veio nenhum arquivo. A sala inferior direita da planta pixel art parece um escritório/biblioteca."),
    dict(id="diario-fechado", tipo="objeto", nome="Diário de investigação (fechado)", nota="Ícone do diário. Não veio no zip."),
    dict(id="diario-aberto", tipo="objeto", nome="Diário de investigação (aberto, páginas vazias)", nota="Base para as abas Personagens / Pistas / Depoimentos / Registros / Linha do tempo / Deduções."),
    dict(id="livro-de-registros", tipo="objeto", nome="Livro de registros", nota="Evento 1 do painel (primeiro registro)."),
    dict(id="camera", tipo="objeto", nome="Câmera de segurança", nota="Aparece pequena na galeria, mas não como objeto separado."),
    dict(id="almofada", tipo="objeto", nome="Almofada do pedestal", nota="Já existe no cenário do hall; só precisa de área clicável."),
]

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

# ---------------------------------------------------------------- limpeza
def tirar_ilhas(rgba, frac=0.02):
    """Remove pedacos soltos (restos do painel vizinho) menores que `frac` da maior parte."""
    a = np.array(rgba.getchannel("A"))
    lab, n = ndi.label(a > 8)
    if n <= 1:
        return rgba
    areas = ndi.sum(np.ones_like(lab), lab, index=range(1, n + 1))
    keep = [i + 1 for i, ar in enumerate(areas) if ar >= frac * areas.max()]
    mask = np.isin(lab, keep)
    arr = np.array(rgba)
    arr[~mask, 3] = 0
    return Image.fromarray(arr)

def limpar_gata(img):
    """A gata original tem alfa ~253 no corpo + brilho fraco e franja avermelhada nas bordas."""
    arr = np.array(img.convert("RGBA"))
    core = arr[..., 3] > 200
    # preenche so buracos pequenos (furinhos); o vao do rabo e transparente de verdade
    buracos, nb = ndi.label(ndi.binary_fill_holes(core) & ~core)
    for i in range(1, nb + 1):
        if (buracos == i).sum() < 600:
            core |= buracos == i
    lab, n = ndi.label(core)
    if n > 1:
        areas = ndi.sum(core, lab, index=range(1, n + 1))
        core = lab == (1 + int(np.argmax(areas)))
    core = ndi.binary_erosion(core, iterations=2)         # come a franja
    alfa = Image.fromarray((core * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.1))
    arr[..., 3] = np.array(alfa)
    out = Image.fromarray(arr)
    return out.crop(out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())

def cortar_vazio(img, margem=2):
    bb = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bb:
        return img
    x0, y0, x1, y1 = bb
    return img.crop((max(0, x0 - margem), max(0, y0 - margem), min(img.width, x1 + margem), min(img.height, y1 + margem)))

def reduzir(img, altura_max):
    if img.height <= altura_max:
        return img
    w = round(img.width * altura_max / img.height)
    return img.resize((w, altura_max), Image.LANCZOS)

def salvar(img, caminho, q=88):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    img.save(caminho, "WEBP", quality=q, method=6, alpha_quality=95)
    return dict(arquivo=caminho, w=img.width, h=img.height, kb=round(os.path.getsize(caminho) / 1024))

# ---------------------------------------------------------------- principal
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--personagens", required=True)
    ap.add_argument("--fundos", required=True)
    ap.add_argument("--gata-sentada")
    ap.add_argument("--gata-andando")
    ap.add_argument("--saida", default="assets")
    a = ap.parse_args()
    saida = a.saida
    rel = lambda p: os.path.relpath(p, os.path.dirname(saida)).replace(os.sep, "/")
    manifesto = dict(versao=1, descricao="Manifesto de assets de O Mistério da Gata Estrela. Gerado por tools/build_assets.py.",
                     convencoes=dict(
                         sprites_ordem="frente, passo, esquerda, direita, costas (arquivos 01..05 do LEIA-ME)",
                         ancora_sprite="base-centro (x=0.5, y=1.0): os pés ficam no ponto de posicionamento",
                         dimensoes="Cada imagem tem tamanho próprio; o palco deve ler w/h daqui e nunca assumir um tamanho único."),
                     personagens=[], cenarios=[], faltando=FALTANDO)
    total = 0
    # personagens
    for pid, m in PERSONAGENS.items():
        pasta = os.path.join(a.personagens, m["pasta"])
        d = dict(id=pid, nome=m["nome"], papel=m["papel"], cor=m["cor"], retratos=[], sprites={})
        for orig, rid, rot in m["retratos"]:
            im = Image.open(os.path.join(pasta, "retratos", orig + ".png")).convert("RGBA")
            im = reduzir(tirar_ilhas(im), 900)
            r = salvar(im, os.path.join(saida, "img/personagens", pid, f"retrato-{rid}.webp")); total += r["kb"]
            d["retratos"].append(dict(id=rid, rotulo=rot, arquivo=rel(r["arquivo"]), w=r["w"], h=r["h"]))
        for i, dire in enumerate(DIRECOES, 1):
            im = Image.open(os.path.join(pasta, "sprites", f"{m['sprites']}_{i:02d}.png")).convert("RGBA")
            im = reduzir(cortar_vazio(tirar_ilhas(im)), 480)
            r = salvar(im, os.path.join(saida, "img/personagens", pid, f"sprite-{dire}.webp")); total += r["kb"]
            d["sprites"][dire] = dict(arquivo=rel(r["arquivo"]), w=r["w"], h=r["h"], ancora=dict(x=0.5, y=1.0))
        manifesto["personagens"].append(d)
    # gata
    g = dict(id="estrela", nome="Estrela", papel="Gata desaparecida", cor="#D7A45B", retratos=[], sprites={},
             nota="A pasta Estrela/ citada no LEIA-ME não veio no zip. Só existem 2 poses (sentada e andando), recortadas aqui a partir de imagens soltas.")
    for chave, arq, dire in (("sentada", a.gata_sentada, "sentada"), ("andando", a.gata_andando, "andando")):
        if arq and os.path.exists(arq):
            im = reduzir(limpar_gata(Image.open(arq)), 480)
            r = salvar(im, os.path.join(saida, "img/gata", f"estrela-{chave}.webp")); total += r["kb"]
            g["sprites"][dire] = dict(arquivo=rel(r["arquivo"]), w=r["w"], h=r["h"], ancora=dict(x=0.5, y=1.0))
    manifesto["personagens"].append(g)
    # cenarios
    fundos = sorted(os.listdir(a.fundos))
    for cid, nome, trecho, uso in CENARIOS:
        achou = [f for f in fundos if trecho.lower() in unicodedata.normalize("NFKD", f).encode("ascii", "ignore").decode().lower()
                 or trecho.lower() in f.lower()]
        if not achou:
            achou = [f for f in fundos if f.lower().startswith(trecho[:3].lower())]
        if not achou:
            print("AVISO: cenario nao encontrado:", cid); continue
        im = Image.open(os.path.join(a.fundos, achou[0])).convert("RGB")
        if im.width > 1600:
            im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        r = salvar(im, os.path.join(saida, "img/cenarios", f"{cid}.webp"), q=84); total += r["kb"]
        manifesto["cenarios"].append(dict(id=cid, nome=nome, uso=uso, arquivo=rel(r["arquivo"]), w=r["w"], h=r["h"], origem=achou[0].encode("ascii", "replace").decode()))
    with open(os.path.join(saida, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifesto, f, ensure_ascii=False, indent=2)
    print(f"OK: {len(manifesto['personagens'])} personagens, {len(manifesto['cenarios'])} cenarios, ~{total} KB de imagens")

if __name__ == "__main__":
    main()
