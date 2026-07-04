# TASKS — Release: space-war-photometric-stars-v1

> **Status:** Aprovado — 2026-07-04
> **Owner:** main agent (Fable 5) — mandato do operador (definição, implementação
> e revisão no agente principal)

- [x] **T-PS-01** — Leis fotométricas puras em `celestial/physics.js`
  (pointIntensity/pointPx/discPx/lodStep/lumForStar) + bloco unit node.
  Write set: `space-war/src/celestial/physics.js`, `tests/space-war/tools/test-physics-unit.js`.
- [x] **T-PS-02** — Atributos `lum` declarados (config.js: NS/Betelgeuse;
  universe.js: Sol, Siwarha, caótico, palette core, Véu).
  Write set: `space-war/src/config.js`, `space-war/src/universe.js`.
- [x] **T-PS-03** — Starfield fotométrico em quads instanciados (AC-01): rewrite
  de `starfield.js` (wrap+aberração+Doppler+beaming preservados; I=L(D0/d)²;
  fade de borda; núcleo fixo + glare √(I−1)).
  Write set: `space-war/src/starfield.js`.
- [x] **T-PS-04** — LOD ponto↔disco + glows de sistema (AC-02/04/05): novo
  `celestial/starlod.js`; beacons removidos de `system.js`; wire em `main.js`;
  diagnósticos `game.starLod`/`game.sysGlow`.
  Write set: `space-war/src/celestial/starlod.js`, `space-war/src/celestial/system.js`,
  `space-war/src/main.js`.
- [x] **T-PS-05** — Corona com teto de pixels + flare ∝ fluxo (AC-03) em
  `stars.js` (aplicação do teto no starlod; flare em Star.fx).
  Write set: `space-war/src/celestial/stars.js`.
- [x] **T-PS-06** — Sanitize NaN/overbright no lens pass (AC-06).
  Write set: `space-war/src/postfx.js`.
- [x] **T-PS-07** — E2E `photometric.spec.js` (AC-01..05) + suíte completa local
  verde (AC-07).
  Write set: `tests/space-war/photometric.spec.js`.
- [-] **T-PS-08** — Revisões (QA end-of-alpha + security push-verdict), push,
  PR stacked (base feature/space-war-interstellar-journey-v1), CI verde.
  Write set: `.dadaia/handoff/**`, `specs/**` (docs).
