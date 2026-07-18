# TASKS — aero-fighters-inhauma-campaign-v1

> **Status:** Aprovado
> **Aprovação:** 2026-07-18 — operador (diretiva detalhada).
> **Owner:** sessão coordenadora kimi — ondas sequenciais, write sets disjuntos.
> Markers: `[ ]` OPEN · `[-]` IN PROGRESS · `[x]` DONE

## Onda 1 — Componentes de formação (fundação)

- [ ] T-C-01: `src/formations/units.js` (novo) — builders reutilizáveis: tank, apc,
      truck, troops, artillery, sam (+ stats). InstancedMesh para lotes >5.
      Write set: `src/formations/units.js`
- [ ] T-C-02: `src/formations/formation.js` (novo) — controlador de formação:
      path estrada/terreno, offsets coluna/linha/cunha, snap de altura + pitch,
      exclusões duras (cidades/rio/aeroporto), rng seedado, API de spawn/dano por
      unidade integrada a `game.targets`. Write set: `src/formations/formation.js`
- [ ] T-C-03: validador Node de formações (pathing fora das exclusões, spawn
      determinístico por seed) em `tests/aero-fighters/tools/`.
      Write set: `tests/aero-fighters/tools/test-aero-formations.mjs`

## Onda 2 — Cachoeira da Prata ocupada

- [ ] T-C-04: construir Cachoeira (shelf próprio, keep-outs, `registerStructure`,
      casas com telhado via `inhauma-city.js`) + sync `INHAUMA_CITIES/LANDMARKS`.
      Write set: `src/maps/inhauma-scene.js`, `src/maps/inhauma-city.js`,
      `src/maps/inhauma.js`
- [ ] T-C-05: guarnição de ocupação (zeppelins, helis, aaNests nas montanhas,
      blindados circulando, QG). Write set: `src/maps/inhauma-garrison.js` (novo),
      `src/formations/units.js`, `src/formations/formation.js`

## Onda 3 — Diretor de campanha + remoção do boss/waves

- [ ] T-C-06: `src/campaign.js` (novo) — 2 atos, objetivos, spawn-over-time seedado,
      progressão/vitória, HUD de objetivo do ato, integração ao service loop.
      Write set: `src/campaign.js`, `src/main.js`, `src/hud.js`, `src/state.js`
- [ ] T-C-07: remover boss (`boss.js` + flags + HUD bar + gate de pouso + imports)
      e o loop de waves (`WAVE_SIZES`, `targetCountForMission`, overlay MISSÃO N).
      Write set: `src/missions.js`, `src/main.js`, `src/hud.js`, `src/player.js`,
      `src/state.js`, `src/targets.js`, `src/boss.js` (delete), `src/config.js`
- [ ] T-C-08: míssil leve infinito (guard/decremento/HUD ∞; pickups passam a dropar
      heavy/nuke). Write set: `src/main.js`, `src/hud.js`, `src/projectiles.js`,
      `src/service-scene.js`, `src/config.js`

## Onda 4 — Guerra urbana

- [ ] T-C-09: `src/city-war.js` (novo) — artilharia bombardeia prédios de Inhaúma
      (projétil balístico visível, impacto→explosão+`spawnPropFire`+smoke emitter,
      scorch, fogo persistente enquanto a bateria viver).
      Write set: `src/city-war.js`, `src/fx.js`, `src/prop-fire.js`
- [ ] T-C-10: modelo de fogo inimigo no jogador (acerto por distância: AA 80% a
      <50 m; engajamento ≤200-220 m; projéteis retos desviáveis ~70-90 m/s, tracers).
      Write set: `src/targets.js`, `src/projectiles.js`, `src/config.js`,
      `src/formations/units.js`
- [ ] T-C-11: tráfego militar na MG-060 (caminhões inimigos rumo a Inhaúma,
      integrado ao supplyConvoy, sem conflito com tráfego civil/aeroporto).
      Write set: `src/maps/inhauma-traffic.js`, `src/formations/formation.js`

## Onda 5 — Design visual

- [ ] T-C-12: redesign multi-parte dos inimigos (tank, apc, truck, troops,
      artillery, sam, aaGun, helicopter, zeppelin). Write set: `src/formations/units.js`,
      `src/targets.js`
- [ ] T-C-13: wingmen — meshes melhores + voo em formação com o jogador + engajam
      inimigos do jogador; polish do F-35. Write set: `src/wingmen.js`,
      `src/player.js`, `src/ally-war.js`

## Onda 6 — Verificação + evidências

- [ ] T-C-14: adaptar specs browser do fluxo antigo (smoke AC-3/11/12/13,
      diagnostics, map, review-fixes, uplift U-AC-8, flight-combat, service,
      auto-sortie) ao contrato de campanha + tools/test-aero-sim.
      Write set: `tests/aero-fighters/**`
- [ ] T-C-15: bateria de evidências — prints de cada formação em movimento,
      artilharia vs prédio em chamas, Cachoeira ocupada, wingmen em formação,
      redesigns; medir calls/tris em batalha cheia (≤450/≤800k).
- [ ] T-C-16: grep final (`spawnBoss|bossAlive` = 0 em src/), `node --check` geral,
      Node suites verdes, README atualizado, handoff.
