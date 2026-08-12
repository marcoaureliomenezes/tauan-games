---
title: aero-killfeed-chunk-rebuild-recovery-v1
status: idea
opened: 2026-08-12
description: Recuperar do PR #22 (tag archive/aero-inhauma-realism-v1) os 2 itens não portados — killFeed HUD (guerra aliada sem leitura na tela) e stepChunkRebuild (rebuild de terreno fatiado em ~10 frames).
---

# aero-killfeed-chunk-rebuild-recovery-v1

## Description

Na auditoria de fechamento do PR #22 (2026-08-12), 4 fixes pequenos foram portados
direto (projectiles×terreno, heal de esquadrão, reparo no service, respawn de
wingmen, prewarm de shader nuclear — commit em feature/0.11.1). Dois itens maiores
ficaram para release por exigirem decisão de design/validação de perf:

1. **killFeed HUD** (~35 linhas + 5 call sites): canal DOM `#kill-feed` com 5
   linhas empilhadas e fade — única leitura na tela da guerra aliada ("ASA-2
   abateu um caça", "esquadrão inimigo entrando no setor"). A develop tem
   air-kills.js (FX 3D cinematográfico) mas ZERO feedback textual.
2. **stepChunkRebuild** (mecanismo): resample de chunk do terreno infinito fatiado
   em ~10 frames (VERTS_PER_SLICE) com upload único no fim — a develop mitiga o
   hitch por tuning de orçamento (D-6: ~11-22 ms/rebuild contra frame de 16 ms),
   não por amortização. Portar exige benchmark antes/depois no Inhaúma atual.

Fonte: tag `archive/aero-inhauma-realism-v1` (5101367), hunks em
`environment/`/`hud.js`/`inhauma-scene.js` pré-reorg.

## Motivation

Feedback de combate é gap de UX real; o hitch de rebuild é o único ponto do PR #22
onde a develop não re-derivou solução equivalente. Ambos pequenos demais para
release própria — anexar a uma release de aero.

## Acceptance criteria

- killFeed: mensagens visíveis nos 5 eventos, fade, sem layout shift; E2E residual
  1 caso DOM (tier LARGE justificado por ser DOM).
- stepChunkRebuild: benchmark comprovando rebuild ≤ orçamento de frame no mapa
  Inhaúma com DEM atual; sem regressão visual (chunk antigo permanece até o swap).
