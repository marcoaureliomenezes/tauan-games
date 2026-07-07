# TASKS — aero-inhauma-realism-v1

**Status:** Aprovado
**Branch:** `feature/aero-inhauma-realism-v1` (stacked sobre space-war-phases-and-roster-v1)
**Origem:** demanda direta do operador (2026-07-07): "foco total no mapa de
Inhaúma" — realismo (montanhas, árvores, água, cidade, fábricas, carros,
nuvens), navegabilidade, e bugs inaceitáveis (mísseis atravessando montanhas,
missão cumprida não recupera dano, aliados invisíveis na guerra). Preparar a
estrutura p/ transferir aos outros 3 mapas.

- [x] **T-AR-01** — BUG mísseis/projéteis atravessando montanhas: colisão de
  superfície correta p/ TODOS os projéteis (terreno + montanhas + estruturas).
  Write set: `aero-fighters/src/projectiles.js`, `aero-fighters/src/world.js`,
  `aero-fighters/src/maps/**`.
- [x] **T-AR-02** — Missão cumprida RECUPERA a nave (e os aliados): heal no
  objetivo completo, feedback na tela. Write set: `aero-fighters/src/missions.js`,
  `aero-fighters/src/player.js`, `aero-fighters/src/wingmen.js`,
  `aero-fighters/src/ally-war.js`, `aero-fighters/src/hud.js`.
- [x] **T-AR-03** — Guerra aliada VISÍVEL: aliados voando/dogfight na cena,
  abatendo e sendo abatidos, com kill-feed na tela do jogador. Write set:
  `aero-fighters/src/wingmen.js`, `aero-fighters/src/ally-war.js`,
  `aero-fighters/src/hud.js`, `aero-fighters/src/targets.js`.
- [x] **T-AR-04** (rodada 1: terreno patchwork+crag+rocha-por-declive, cidade torres/casas texturizadas + tapete urbano, bosques com sub-bosque, água clara, nuvens billboard, galpões corrugados) — REALISMO do mapa de Inhaúma (anti-Lego): montanhas
  (silhueta/materiais), árvores/florestas, água de rios/lagos, cidade
  (prédios/fábricas), carros, nuvens, luz/névoa — como BIBLIOTECA de ambiente
  reutilizável pelos outros 3 mapas. Write set: `aero-fighters/src/maps/**`,
  `aero-fighters/src/environment/**`, `aero-fighters/src/sky.js`,
  `aero-fighters/src/world.js`.
- [ ] **T-AR-05** — Navegabilidade: revisão de pilotagem/leitura de navegação
  no mapa (minimap/bússola/waypoints) conforme achados. Write set:
  `aero-fighters/src/ui/**`, `aero-fighters/src/hud.js`,
  `aero-fighters/src/player.js`.
- [-] **T-AR-06** — Testes (unit + e2e aero verdes, novos pins p/ 01–03),
  QA, security push-verdict, push, PR, CI verde. Write set: `tests/**`,
  `.dadaia/handoff/**`, `specs/**`.
