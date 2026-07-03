# PLAN — Release: space-war-ballistic-war-v1

**Status:** Aprovado
**SPEC:** [Aprovado] · **Created:** 2026-07-03

## Arquitetura

- `ballistics.js` (novo): `solveBallistic({pos, vel, speed, targetPos, targetVel,
  gravityFn, maxT, dt})` → `{ok, dir, tof, points[], miss}`. Alvo virtual iterado
  (≤8), integração Euler semi-implícito dt 0.1. `gravityFn(p, out)` injetável (node).
- `ship.js`: branch `aligning` usa `game.nav.solution.dir` quando existe (alvo de
  missão + solve throttled 0.3 s); senão apontamento direto (fallback).
- `weapons.js`: `launchNuke` consome solução fresca (<1 s) → `aimed: true` (pula a
  guiagem de espiral); bombas inimigas inalteradas.
- `nav.js`: desenha arco (pontos projetados, tracejado) + X de impacto; rótulo
  "SOLUÇÃO" no alvo quando válida.
- `campaign.js`: fases ganham `hunt: N`; gerador de sítios cicla luas→planetas→naves
  do sistema (binário: só naves). `missions.js`: tipo `hunt` com fila sequencial,
  spawn k+1 no kill, escolta via `enemies.spawnEscort(body)`; mesh v2 + capitalShip.
- `fx.js`: `nukeMushroom(pos, up)` (coluna+copa+anel, ~20 s) e duplo flash vácuo;
  `weapons.js` decide superfície×vácuo via `surfaceContact` body.

## Ondas

W1 ballistics.js + node test · W2 C/HUD/launch · W3 hunt chain + meshes + escoltas ·
W4 explosão · W5 testes e2e + QA + security + ship (PR + CI verde).

Rollback: cada onda em commit; solver é aditivo (fallback = comportamento atual).
