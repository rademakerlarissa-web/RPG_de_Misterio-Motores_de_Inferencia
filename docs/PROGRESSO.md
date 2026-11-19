# Progresso
- [x] 1. Planejamento
- [x] 2. Layout visual
- [x] 3. Integração com o jogo (cenários, planta, diário, diálogos em qualquer ordem, final do caso)
- [x] 4. Eventos educacionais com dados do motor
- [x] 5. Documentação interativa executando o motor (M1–M6)
- [x] 6. Laboratório consultando o motor
- [x] 7. Testes e revisão (pytest; ver "Honestidade" no README)

Motor: Python canônico (`motor/`) + port em JavaScript (`js/motor/`) com paridade testada; SAT/DPLL próprio; CLI (`main.py`); 12 casos em `casos/`.
Não executado: conferência com SWI-Prolog (programa não instalado no ambiente de desenvolvimento; teste pronto em `tests/test_prolog.py`).

Histórico das rodadas visuais: 2 (Luiza, café, reserva, diário, câmera), 3 (interações em qualquer ordem), 4 (final do caso, fotos finais).
Estudantes: Larissa Gabriel e Isabel Shiffler. Falas além das do briefing são texto nosso, provisório.

## Revisão final (2026-11-16)
- Bônus real: `depoimentos_decisivos` (Python e JS) substitui o antigo "conjunto mínimo"; CLI `--pergunta depoimentos-decisivos`.
- Registros aceitam 4º campo opcional `fonte` (vira `fonte/4`); caso oficial usa "câmera".
- Novo `prolog/prova.pl` (meta-interpretador com árvore de prova; não executado, sem swipl).
- Laboratório fixo no caso do jogo (sem upload de JSON). "Sobre o projeto" reduzido ao que o enunciado pede.
- Câmera escondida do hall modelada no motor: campo `avistamentos`, regras `acompanhada/2` e `saiu_sozinha/3`, evento 9 do painel, testes e paridade JS.
