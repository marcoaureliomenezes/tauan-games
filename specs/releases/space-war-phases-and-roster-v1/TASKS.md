# TASKS — Release: space-war-phases-and-roster-v1

> **Status:** Aprovado — 2026-07-07
> **Owner:** main agent (Fable 5) — mandato /goal do operador

- [x] **T-PR-01** — P0 starfield/journey boundary gating (helper único; floor
  removido; β_vis posicional; postfx tint gateado). Write set:
  `space-war/src/starfield.js`, `journey.js`, `postfx.js`, `main.js`,
  `celestial/system.js|physics.js`, `tests/space-war/**`.
- [x] **T-PR-02** — P0 Higgs profile (Plummer + wellReach; cap só near-core).
  Write set: `space-war/src/gravity.js`, `higgs.js`, `tests/space-war/**`.
- [x] **T-PR-03** — P0 nuke capture gate (v_rel < 1.5·v_esc). Write set:
  `space-war/src/weapons.js`, `tests/space-war/**`.
- [x] **T-PR-04** — P1 config.js literais finais + de-alias (snapshot-diff=0).
  Write set: `space-war/src/config.js`, `universe.js`, `tests/space-war/**`.
- [x] **T-PR-05** — P1 SystemRuntime+dispose; dead-code sweep; rename
  game.phase→game.screen; dados por sistema no SYSTEMS registry. Write set:
  `space-war/src/**`, `tests/space-war/**`.
- [x] **T-PR-06** — P2 fases: build/dispose por sistema na origem; travel
  phase; nav/map/starlod/journey por descritores; debug loadSystem. Write set:
  `space-war/src/**`, `tests/space-war/**`.
- [x] **T-PR-07** — P3 física nova: eggletonLobe/l1Distance + teardrop shader
  + curved Roche stream. Write set: `space-war/src/celestial/**`,
  `tests/space-war/tools/**`.
- [x] **T-PR-08** — P3 roster swap + remaps (campaign/missions/enemies/map/
  starlod/gravity/menu). Write set: `space-war/src/**`, `tests/space-war/**`.
- [x] **T-PR-09** — P4 polish (inimigos×wells; laser worldVel; SOI blend;
  margens detonação; pinch gate; solver dt). Write set: `space-war/src/**`,
  `tests/space-war/**`.
- [x] **T-PR-10** — QA + security push-verdict + push + PR + CI verde. Write
  set: `.dadaia/handoff/**`, `specs/**`. (PR #21, CI verde 2026-07-07.)

## Rodada 2 — feedback do operador em jogo (2026-07-07, evidência `img/`)

- [x] **T-PR-11** — Corredor interestelar = look ORIGINAL restaurado (estrelas
  sólidas, aberração plena 0.995 concentrando no centro em v_max, zero ganho de
  exposição), com riscos/crescimento normalizados p/ a escala de voo (uSpeed ≤
  9k no warp; o cruzeiro de 176k virava borrões) e o gate de fronteira do P0-1
  mantido. Write set: `space-war/src/starfield.js`.
- [x] **T-PR-12** — Higgs = micro buraco negro sob comando: corrente de plasma
  estilo Devorador (tubo curvo + hot spot + teardrop na fonte), drena estrelas
  E discos de acreção, supernova DETERMINÍSTICA por dreno acumulado (∝ raio),
  onda de choque arremessa o jogador ileso com câmera-cinema na explosão.
  Write set: `space-war/src/higgs.js`, `space-war/src/state.js`,
  `space-war/src/ship.js`, `tests/space-war/**`.
- [x] **T-PR-13** — Câmera de observação em FRAME CO-ROTANTE: o corpo dominante
  fica parado na vista durante a órbita; mouse livre p/ passear o olhar sem
  alterar a trajetória. Write set: `space-war/src/ship.js`.
