"""Gera dist/artifact.html: versão em fragmento do index.html (sem doctype/html/head/body),
no formato exigido para publicar como Artifact. Uso: python3 -I tools/make_artifact.py"""
import re, pathlib
raiz = pathlib.Path(__file__).resolve().parent.parent
h = (raiz / "index.html").read_text(encoding="utf-8")
head = re.search(r"<head>(.*?)</head>", h, re.S).group(1)
body = re.search(r"<body>(.*)</body>", h, re.S).group(1)
head = re.sub(r"<meta charset[^>]*>\s*", "", head)
head = re.sub(r"<meta name=\"viewport\"[^>]*>\s*", "", head)
out = head.strip() + "\n" + body.strip() + "\n"
(raiz / "dist").mkdir(exist_ok=True)
(raiz / "dist" / "artifact.html").write_text(out, encoding="utf-8")
print("ok", len(out), "bytes")
