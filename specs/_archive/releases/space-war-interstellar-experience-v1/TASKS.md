# TASKS — Release: space-war-interstellar-experience-v1

> **Status:** Aprovado — 2026-07-04
> **Owner:** main agent (Fable 5) — mandato do operador

- [x] **T-IE-01** — `journeyProfileTrapezoid` (30/40/30) puro + unit node.
  Write set: `space-war/src/celestial/physics.js`,
  `tests/space-war/tools/test-physics-unit.js`.
- [x] **T-IE-02** — journey.js no trapezoide (β 0.995·v/vMax, imunidade a
  colisão [reverte D-1 rc-1], fase) + HUD ACELERANDO/CRUZEIRO/FREANDO.
  Write set: `space-war/src/journey.js`, `space-war/src/hud.js`.
- [x] **T-IE-03** — Starfield: crescimento na passagem (iRad + teto suave 48px),
  riscos tangenciais (ω = v·senθ/d), beaming 9, β teto 0.995, diag starfieldFx.
  Write set: `space-war/src/starfield.js`.
- [x] **T-IE-04** — Testes: unit trapezoide; journey.spec platô; novo
  `journey-experience.spec.js` (coast β≥0.98, streaks/growth uniforms, imunidade);
  suíte completa. Write set: `tests/space-war/**`.
- [x] **T-IE-05** — QA end-of-alpha + security push-verdict + push + PR stacked
  (base main) + CI verde. Write set: `.dadaia/handoff/**`, `specs/**`.
