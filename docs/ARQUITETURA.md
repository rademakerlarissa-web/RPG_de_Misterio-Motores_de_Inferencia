# Arquitetura

## Visão geral
```
casos/*.json ──► motor/ (Python, canônico) ──► main.py (CLI)   ──► tests/ (pytest)
        │              ▲ paridade testada
        └──────► js/motor/ (port em JS) ──► js/engine/adaptador.js ──► painel · docs · laboratório (index.html)
```
- **Regras** ficam num texto único (`motor/base.py`, constante `REGRAS`). `tools/gerar_prolog.py` o exporta para `prolog/regras.pl` e `js/motor/regras.js`, então Python, JavaScript e Prolog leem **as mesmas regras**.
- **Fatos** são gerados do JSON (`fatos_texto` / `fatosTexto`), com nomes normalizados (`Café` → `cafe`).
- **SLD** (`sld.py`): renomeação de variáveis, limite de profundidade, corte de objetivos variantes de um ancestral, embutidos (`is`, comparações, `=`, `\=`, `\+`, `findall`, `min_list`) e árvore de prova.
- **SAT** (`sat.py`): CNF por pessoa, DPLL com propagação unitária por contadores, DIMACS, núcleo mínimo, consequência por refutação, contagem projetada.
- **Oráculo** (`referencia.py`): implementação independente (Floyd–Warshall + intervalos) usada nos testes.

## O site
Scripts clássicos com o espaço de nomes `window.GE` (abre por `file://`). Ordem em `index.html`:
dados → `core/util` → `core/visuais` → `motor/*` → `data/testes.js` → `engine/adaptador` → `panel` → `game` → `docs` → `lab` → `main`.

### Ligação com o motor (`js/engine/adaptador.js`)
- `GE.motor.obter(id)` monta o evento do painel: o texto explicativo vem de `data/painel-textos.js` e **todos os valores** (fatos, intervalos, árvore de prova, números do SAT) são calculados pelo motor sobre o caso oficial. `origem: "motor"`.
- `GE.motor.caso(dados)` cria um caso do motor (usado pelo Laboratório e pelas demonstrações).
- `GE.disparar(id)` — o jogo avisa o painel; registra o histórico só na primeira vez.
- Se o motor não carregar, o evento sai como "aguardando" e sem nenhum valor inventado.

### Jogo
`js/game/palco.js`: cenas em `GE.CENAS`, posições em % da imagem, interações em qualquer ordem, diário em livro, final do caso.

### Imagens
`tools/build_assets.py` converte os originais para WebP com alfa e gera `assets/manifest.json` (não rodar por cima das atualizações; use `atualizar_assets.py`).
