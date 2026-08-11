---
slug: james-bond-godot-jogo
title: James Bond (Godot) — o jogo
category: product
tldr: Port falho do FPS web — código perdido (nunca commitado); rebuild do zero pelo contrato web.
summary: Estado do port Godot do james-bond (src/godot/james-bond) auditado em 2026-08-10 contra a versão web (referência boa). Sistemas salváveis; mapas/missões/inimigos/arsenal devem ser reconstruídos a partir de missions.js, weapons.js e guards.js TYPE_STATS.
tags: [product, james-bond, godot, fps]
token_estimate: 0
last_updated: "2026-08-10"
release_origin: v0.7.0
---

## Status: PORT FALHO — código perdido, rebuild do zero pelo contrato

Decisão do operador (2026-08-10): a versão web (`src/web-games/james-bond`) é o
produto de referência ("meu filho ama"); a versão Godot NÃO correspondia a ela.
Auditoria completa: release `v0.4.0` (T-06). ATUALIZAÇÃO (v0.7.0, mesmo dia):
o diretório `src/godot/james-bond/` sumiu da working tree — NUNCA foi rastreado
em git, não há como recuperar. O rebuild parte do zero; o contrato de
portabilidade abaixo é completo e suficiente. A análise "sistemas ~70% fiéis"
se perdeu com o código.

## O que a versão Godot tinha (perdida em 2026-08-10)

- **Sistemas fiéis (salváveis, ~70%)**: máquina de estados da IA
  (patrol/investigate/pursue/engage/search) com as mesmas constantes da web
  (visão 23 m / cos 0,48; melee 2,3 m; máx 2 atiradores), tabela de dificuldade
  idêntica, constantes de player idênticas (4,8/2,6/pulo 4,6/g14; HP 100 +
  colete 50), HUD com radar, menus briefing/debrief, save/unlock.
- **Conteúdo divergente (o problema)**: 4 mapas CS-style construídos à mão via
  `MapBuilder` + 2 fazendas de teste — NENHUMA das 6 operações web (grids ASCII
  33×19, célula 3,6 m); arsenal 2/5 (Deagle + AK; sem faca, sem RPG); inimigos
  3/10 espécies (sem mix de 2 por missão, sem boss T-Rex); modelos KayKit em
  vez dos GLB animados Quaternius; extras que não existem na web (ondas de
  reforço, alarme final).

## Contrato de portabilidade (a fonte da verdade é a web)

1. `src/web-games/james-bond/src/content/missions.js` — as 6 operações: grids
   ASCII, paletas, objetivos A/B/C + extração, `enemyMix` por missão, slabs
   `upper`/escadas/guardas de mezanino.
2. `src/web-games/james-bond/src/content/weapons.js` — os 5 slots com stats (faca 85/2,4 m; Deagle mag 7 dmg 82; AK mag 30 dmg 50;
   RPG projétil visível blast 6,5 m; granada fuse 2,15 s; zonas de dano
   head ×2,4 / torso ×1 / membro ×0,65).
3. `src/ai/guards.js` TYPE_STATS — as 10 espécies (human, vampire, witch,
   phantom, wraith, brute, monster, ghoul, demon, raptor, trex boss hp ×5,5).

## O que o rebuild deve entregar (priorizado)

1. Portar `missions.js` verbatim (6 grids, paletas, objetivos, enemyMix).
2. Grid world builder: vocabulário de tiles, colisores AABB merged, dois pisos
   com escadas caminháveis — aposentar os layouts MapBuilder.
3. Arsenal completo (faca melee + RPG) e roster de 10 espécies com mix por
   missão + boss T-Rex único; GLB Quaternius são CC0 — reuso direto.
4. Nav/A* por nível (térreo e mezanino separados).
5. Paridade de apresentação: paleta/céu/névoa por missão, lanterna tática,
   props explosivos com reação em cadeia, modo criança, áudio synth + drone.
6. Remover (ou gatear como opção) ondas de reforço e alarme final.
