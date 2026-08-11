# SPEC — Release: far-west-uplift-v1

> **Status:** Aprovado
> **Aprovação:** 2026-07-18 — operator playtest feedback, mandato direto
> ("o cavalo deveria correr, pular, eu deveria ficar sentado no cavalo, a mira
> deveria se movimentar com o mouse, estilo counter strike 1.6, mais real").
> **Release ID:** far-west-uplift-v1
> **Owner:** product-engineer
> **Opened:** 2026-07-18
> **Depends on:** far-west-open-world-v1 (entregue)

## 1. Problema

Playtest do operador (2026-07-18): (a) o cavaleiro fica **em pé atravessando o
cavalo** em vez de sentado; (b) o cavalo não corre o bastante e **não pula**;
(c) a mira não segue o mouse — impossível atirar em movimento estilo CS 1.6;
(d) visual "desenho animado" — falta textura, luz e detalhe.

## 2. Requisitos

- **R-01 — Cavaleiro sentado:** pose de montaria real (pernas abertas abaixadas,
  tronco ereto) via pose óssea do rig ou clip adequado; zero clipping com o cavalo
  em todas as marchas e nas duas câmeras.
- **R-02 — Cavalo corre de verdade:** galope ~14 m/s com aceleração esperta, FOV
  kick no galope, shake leve de câmera, poeira nos cascos, som de vento por
  velocidade.
- **R-03 — Pulo:** [espaço] pula (arco balístico, altura ~1.6 m, só no chão,
  atravessa cercas/obstáculos baixos, animação Gallop_Jump do GLB se disponível).
- **R-04 — Mira CS 1.6:** pointer lock permanente após o start; crosshair sempre
  visível; mouse move a mira/câmera livremente (yaw+pitch) em AMBAS as câmeras;
  **botão esquerdo do mouse atira** (inclusive em movimento e no galope);
  [F] = aim-down-sights (zoom + precisão); [R] recarrega. O cavalo segue o rumo
  do mouse suavemente quando não se está mirando; ao mirar, o cavalo mantém o rumo
  e a mira é livre.
- **R-05 — Uplift visual:** terreno texturizado (splat grama/terra/rocha/neve com
  texturas procedurais geradas em canvas — offline), sombras PCF corrigidas,
  bloom sutil, água reflexiva (Water.js já vendorado), mais densidade de detalhe
  perto da câmera (grama/arbustos), modelos com materiais corrigidos (sem branco
  estourado, roughness adequado).
- **R-06 — Regressão zero:** suíte `tests/far-west/` segue verde (atualizar o
  teste de tiro: espaço agora é pulo — tiro é mouse; atualizar WASD se necessário).

## 3. Fora de escopo

Novos modelos realistas de cavalo/cowboy (pesquisa de assets melhores fica para
release futura se o uplift de materiais não bastar), multiplayer, save.
