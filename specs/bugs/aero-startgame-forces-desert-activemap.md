---
name: aero-startgame-forces-desert-activemap
status: Closed
severity: CRITICAL
reported: 2026-06-12
surface: aero-fighters — missions.js startGame / map selection UI
session_id: null
---

**Symptom:** Selecionar QUALQUER mapa pelos botões do menu (MAR DO SUL / RIO /
INHAUMA) roda o jogo com física/colisão do DESERT: `startGame()` força
`game.activeMap = 'desert'` quando não há `?map=` na URL. Verificado live: islands
via botão → mundo oceano renderizado, mas contact='runway' invisível do desert no
meio do mar; decolagem de pista fantasma.

**Repro:** abrir index.html (sem query param) → clicar MAR DO SUL → Space →
`window.game.activeMap` === 'desert'.

**Expected:** O mapa selecionado pelo botão é o mapa ativo para TODAS as camadas
(visual, colisão, aeroporto, layout de alvos).

**Notes:** `src/missions.js:55` e `:92` — `if (!game.runtime?.map) game.activeMap =
'desert'` sobrescreve a seleção feita por `window.selectMap()` (main.js). Os probes
anteriores usaram `?map=` e por isso viram o soft-lock (bug
`aero-islands-realism-softlock`) em vez deste split-brain. Fix → WS-2 do audit
`specs/audits/2026-06-12T220815Z/` (registro por mapa; remover o override).

**Fix (2026-06-12, release aero-fighters-uplift-v1):** Wave 2 (commit eb13fba): override removido de startGame/restartGame; activeMap segue o botão selecionado (U-AC-1 asserts map).
